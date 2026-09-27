import type { AuthTokens, SessionUser } from '@organa/shared';
import { create } from 'zustand';
import { storage } from './storage';

const KEYS = {
  refreshToken: 'organa.refreshToken',
  user: 'organa.user',
  deviceToken: 'organa.deviceToken',
  onboardingSeen: 'organa.onboardingSeen',
  activeOutletId: 'organa.activeOutletId',
  setupPending: 'organa.setupPending',
} as const;

interface SessionState {
  hydrated: boolean;
  accessToken: string | null;
  refreshToken: string | null;
  user: SessionUser | null;
  /** Set on a shared device an owner bound to an outlet; enables employee PIN login. */
  deviceToken: string | null;
  onboardingSeen: boolean;
  activeOutletId: string | null;
  /** True between business setup and finishing employee setup, so the setup flow stays open. */
  setupPending: boolean;

  hydrate: () => Promise<void>;
  signIn: (tokens: AuthTokens) => Promise<void>;
  setTokens: (tokens: AuthTokens) => Promise<void>;
  setUser: (user: SessionUser) => Promise<void>;
  signOut: () => Promise<void>;
  setDeviceToken: (token: string | null) => Promise<void>;
  markOnboardingSeen: () => Promise<void>;
  setActiveOutlet: (outletId: string) => Promise<void>;
  setSetupPending: (pending: boolean) => Promise<void>;
}

export const useSession = create<SessionState>((set, get) => ({
  hydrated: false,
  accessToken: null,
  refreshToken: null,
  user: null,
  deviceToken: null,
  onboardingSeen: false,
  activeOutletId: null,
  setupPending: false,

  async hydrate() {
    const [refreshToken, userJson, deviceToken, onboardingSeen, activeOutletId, setupPending] = await Promise.all([
      storage.get(KEYS.refreshToken),
      storage.get(KEYS.user),
      storage.get(KEYS.deviceToken),
      storage.get(KEYS.onboardingSeen),
      storage.get(KEYS.activeOutletId),
      storage.get(KEYS.setupPending),
    ]);
    let user: SessionUser | null = null;
    try {
      user = userJson ? (JSON.parse(userJson) as SessionUser) : null;
    } catch {
      user = null;
    }
    set({
      hydrated: true,
      // The access token is not persisted; the API client refreshes it on first use.
      refreshToken: user ? refreshToken : null,
      user: refreshToken ? user : null,
      deviceToken,
      onboardingSeen: onboardingSeen === '1',
      activeOutletId,
      setupPending: setupPending === '1',
    });
  },

  async signIn(tokens) {
    await get().setTokens(tokens);
    const current = get().activeOutletId;
    if (!current || !tokens.user.outletIds.includes(current)) {
      await get().setActiveOutlet(tokens.user.outletIds[0] ?? '');
    }
  },

  async setTokens({ accessToken, refreshToken, user }) {
    set({ accessToken, refreshToken, user });
    await Promise.all([storage.set(KEYS.refreshToken, refreshToken), storage.set(KEYS.user, JSON.stringify(user))]);
  },

  async setUser(user) {
    set({ user });
    await storage.set(KEYS.user, JSON.stringify(user));
  },

  async signOut() {
    set({ accessToken: null, refreshToken: null, user: null, setupPending: false });
    await Promise.all([
      storage.set(KEYS.refreshToken, null),
      storage.set(KEYS.user, null),
      storage.set(KEYS.setupPending, null),
    ]);
  },

  async setDeviceToken(deviceToken) {
    set({ deviceToken });
    await storage.set(KEYS.deviceToken, deviceToken);
  },

  async markOnboardingSeen() {
    set({ onboardingSeen: true });
    await storage.set(KEYS.onboardingSeen, '1');
  },

  async setActiveOutlet(activeOutletId) {
    set({ activeOutletId: activeOutletId || null });
    await storage.set(KEYS.activeOutletId, activeOutletId || null);
  },

  async setSetupPending(setupPending) {
    set({ setupPending });
    await storage.set(KEYS.setupPending, setupPending ? '1' : null);
  },
}));
