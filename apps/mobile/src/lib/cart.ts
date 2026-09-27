import type { Order, Product } from '@organa/shared';
import { create } from 'zustand';

export type CartLine =
  | { key: string; kind: 'product'; productId: string; name: string; unitPrice: number; qty: number }
  | { key: string; kind: 'manual'; name: string; unitPrice: number; qty: number };

interface CartState {
  lines: CartLine[];
  /** Kept so a retried checkout reuses the same id and the API does not double-charge. */
  checkoutId: string | null;
  lastOrder: Order | null;
  add: (p: Product) => void;
  addManual: (name: string, unitPrice: number) => void;
  setQty: (key: string, qty: number) => void;
  clear: () => void;
  setCheckoutId: (id: string | null) => void;
  finish: (order: Order) => void;
}

let manualSeq = 0;

export const useCart = create<CartState>((set) => ({
  lines: [],
  checkoutId: null,
  lastOrder: null,
  add: (p) =>
    set((s) => {
      const existing = s.lines.find((l) => l.kind === 'product' && l.productId === p.id);
      return {
        checkoutId: null,
        lines: existing
          ? s.lines.map((l) => (l === existing ? { ...l, qty: l.qty + 1 } : l))
          : [...s.lines, { key: p.id, kind: 'product', productId: p.id, name: p.name, unitPrice: p.price, qty: 1 }],
      };
    }),
  addManual: (name, unitPrice) =>
    set((s) => ({ checkoutId: null, lines: [...s.lines, { key: `manual-${manualSeq++}`, kind: 'manual', name, unitPrice, qty: 1 }] })),
  setQty: (key, qty) =>
    set((s) => ({ checkoutId: null, lines: qty <= 0 ? s.lines.filter((l) => l.key !== key) : s.lines.map((l) => (l.key === key ? { ...l, qty } : l)) })),
  clear: () => set({ lines: [], checkoutId: null }),
  setCheckoutId: (checkoutId) => set({ checkoutId }),
  finish: (order) => set({ lines: [], checkoutId: null, lastOrder: order }),
}));

export const cartTotal = (lines: CartLine[]) => lines.reduce((s, l) => s + l.unitPrice * l.qty, 0);
export const cartCount = (lines: CartLine[]) => lines.reduce((s, l) => s + l.qty, 0);
