import type {
  Analysis,
  AppNotification,
  CountLinesInput,
  CreateOrderInput,
  CreateProductCategoryInput,
  CreateStockCategoryInput,
  Dashboard,
  ExpiryRow,
  Forecast,
  Ingredient,
  IngredientDetail,
  Insight,
  Order,
  Product,
  ProductCategory,
  ProductDetail,
  SaveProductInput,
  StockCategory,
  StockCount,
  StockInInput,
  StockItem,
  StockStatus,
  StockSummary,
  UpdateIngredientInput,
  AuthTokens,
  BusinessSetupInput,
  CreateEmployeeInput,
  Employee,
  EmployeeLoginInput,
  EmployeeLoginOption,
  OtpChallenge,
  OtpVerifyInput,
  Outlet,
  OwnerLoginInput,
  RegisterOwnerInput,
  SessionUser,
} from '@organa/shared';
import { useSession } from './session';

export const BASE_URL = (process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly issues: { path: string; message: string }[] = [],
  ) {
    super(message);
  }
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  auth?: boolean;
  device?: boolean;
};

async function rawRequest<T>(path: string, opts: RequestOptions, accessToken: string | null): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  if (opts.auth !== false && accessToken) headers.Authorization = `Bearer ${accessToken}`;
  const deviceToken = useSession.getState().deviceToken;
  if (opts.device && deviceToken) headers['X-Device-Token'] = deviceToken;

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}/v1${path}`, {
      method: opts.method ?? 'GET',
      headers,
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    });
  } catch {
    throw new ApiError(0, 'Tidak dapat terhubung ke server. Periksa koneksi internet.');
  }
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const message = Array.isArray(data?.message) ? data.message.join(', ') : (data?.message ?? 'Terjadi kesalahan');
    throw new ApiError(res.status, message, data?.issues ?? []);
  }
  return data as T;
}

let refreshing: Promise<string | null> | null = null;

/** Single-flight refresh so parallel 401s trigger one rotation. */
function refreshAccessToken(): Promise<string | null> {
  refreshing ??= (async () => {
    const { refreshToken, setTokens, signOut } = useSession.getState();
    if (!refreshToken) return null;
    try {
      const tokens = await rawRequest<AuthTokens>('/auth/refresh', { method: 'POST', body: { refreshToken }, auth: false }, null);
      await setTokens(tokens);
      return tokens.accessToken;
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) await signOut();
      return null;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

export async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  if (opts.auth === false) return rawRequest<T>(path, opts, null);
  let token = useSession.getState().accessToken ?? (await refreshAccessToken());
  try {
    return await rawRequest<T>(path, opts, token);
  } catch (e) {
    if (!(e instanceof ApiError) || e.status !== 401) throw e;
    token = await refreshAccessToken();
    if (!token) throw e;
    return rawRequest<T>(path, opts, token);
  }
}

export const api = {
  register: (body: RegisterOwnerInput) => request<AuthTokens>('/auth/register', { method: 'POST', body, auth: false }),
  ownerLogin: (body: OwnerLoginInput) => request<OtpChallenge>('/auth/owner/login', { method: 'POST', body, auth: false }),
  verifyOtp: (body: OtpVerifyInput) => request<AuthTokens>('/auth/otp/verify', { method: 'POST', body, auth: false }),
  deviceEmployees: () => request<EmployeeLoginOption[]>('/auth/employees', { auth: false, device: true }),
  employeeLogin: (body: EmployeeLoginInput) =>
    request<AuthTokens>('/auth/employee/login', { method: 'POST', body, auth: false, device: true }),
  logout: (refreshToken: string) => request<void>('/auth/logout', { method: 'POST', body: { refreshToken }, auth: false }),
  me: () => request<SessionUser>('/auth/me'),
  registerDevice: (outletId: string, name?: string) =>
    request<{ deviceToken: string }>('/auth/devices', { method: 'POST', body: { outletId, name } }),

  setupBusiness: (body: BusinessSetupInput) => request<unknown>('/tenant/setup', { method: 'PUT', body }),
  outlets: () => request<Outlet[]>('/outlets'),
  employees: (outletId?: string) =>
    request<Employee[]>(`/employees${outletId ? `?outletId=${encodeURIComponent(outletId)}` : ''}`),
  createEmployee: (body: CreateEmployeeInput) => request<Employee>('/employees', { method: 'POST', body }),

  // stock
  stockCategories: () => request<StockCategory[]>('/stock-categories'),
  createStockCategory: (body: CreateStockCategoryInput) => request<StockCategory>('/stock-categories', { method: 'POST', body }),
  ingredients: (categoryId?: string) => request<Ingredient[]>(`/ingredients${qs({ categoryId })}`),
  updateIngredient: (id: string, body: UpdateIngredientInput) => request<Ingredient>(`/ingredients/${id}`, { method: 'PATCH', body }),
  ingredientStock: (id: string, outletId: string) => request<IngredientDetail>(`/ingredients/${id}/stock${qs({ outletId })}`),
  stock: (outletId: string, filter: { categoryId?: string; status?: StockStatus } = {}) =>
    request<StockItem[]>(`/stock${qs({ outletId, ...filter })}`),
  stockSummary: (outletId: string) => request<StockSummary>(`/stock/summary${qs({ outletId })}`),
  expiring: (outletId: string) => request<ExpiryRow[]>(`/stock/expiring${qs({ outletId })}`),
  expired: (outletId: string) => request<ExpiryRow[]>(`/stock/expired${qs({ outletId })}`),
  stockIn: (body: StockInInput) => request<{ ingredientId: string; batchId: string }>('/stock-ins', { method: 'POST', body }),
  alerts: (outletId: string, since?: string) => request<AppNotification[]>(`/alerts${qs({ outletId, since })}`),

  // catalog
  productCategories: () => request<ProductCategory[]>('/product-categories'),
  createProductCategory: (body: CreateProductCategoryInput) =>
    request<ProductCategory>('/product-categories', { method: 'POST', body }),
  products: (outletId: string, filter: { categoryId?: string; active?: boolean } = {}) =>
    request<Product[]>(`/products${qs({ outletId, categoryId: filter.categoryId, active: filter.active?.toString() })}`),
  product: (id: string, outletId: string) => request<ProductDetail>(`/products/${id}${qs({ outletId })}`),
  saveProduct: (outletId: string, body: SaveProductInput, id?: string) =>
    request<ProductDetail>(`/products${id ? `/${id}` : ''}${qs({ outletId })}`, { method: id ? 'PUT' : 'POST', body }),
  upload: (dataUrl: string) => request<{ url: string }>('/uploads', { method: 'POST', body: { dataUrl } }),

  // pos
  createOrder: (body: CreateOrderInput) => request<Order>('/orders', { method: 'POST', body }),
  orders: (outletId: string, date?: string) => request<Order[]>(`/orders${qs({ outletId, date })}`),

  // counts
  startCount: (outletId: string, categoryId: string) => request<StockCount>('/stock-counts', { method: 'POST', body: { outletId, categoryId } }),
  saveCountLines: (id: string, body: CountLinesInput) => request<StockCount>(`/stock-counts/${id}/lines`, { method: 'PUT', body }),
  commitCount: (id: string) => request<StockCount>(`/stock-counts/${id}/commit`, { method: 'POST' }),
  latestCount: (outletId: string, categoryId?: string) =>
    request<{ count: StockCount | null }>(`/stock-counts/latest${qs({ outletId, categoryId })}`),

  // insights
  analysis: (outletId: string, period: string) => request<Analysis>(`/analysis${qs({ outletId, period })}`),
  forecast: (outletId: string, month: string) => request<Forecast>(`/forecast${qs({ outletId, month })}`),
  insight: (outletId: string, kind: 'analysis' | 'forecast', period: string) =>
    request<Insight>(`/insights${qs({ outletId, kind, period })}`),
  regenerateInsight: (outletId: string, kind: 'analysis' | 'forecast', period: string) =>
    request<Insight>(`/insights/regenerate${qs({ outletId, kind, period })}`, { method: 'POST' }),
  dashboard: (outletId: string) => request<Dashboard>(`/dashboard${qs({ outletId })}`),
};

/** Absolute URL for a path the API returned (e.g. an uploaded photo). */
export function assetUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  return path.startsWith('http') ? path : `${BASE_URL}${path}`;
}

function qs(params: Record<string, string | undefined>): string {
  const parts = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v!)}`);
  return parts.length ? `?${parts.join('&')}` : '';
}
