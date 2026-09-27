import { z } from 'zod';

const id = z.string().uuid();

export const PAYMENT_METHODS = ['CASH', 'QRIS', 'GOPAY', 'DANA', 'FLIP', 'BCA', 'MAESTRO', 'MASTERCARD'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  CASH: 'Tunai',
  QRIS: 'QRIS',
  GOPAY: 'GoPay',
  DANA: 'DANA',
  FLIP: 'Flip',
  BCA: 'BCA',
  MAESTRO: 'Maestro',
  MASTERCARD: 'Mastercard',
};

export const orderLineInputSchema = z.union([
  z.object({ productId: id, qty: z.number().int().positive().max(999) }),
  /** Open-price item from the keypad; deducts no stock. */
  z.object({ name: z.string().trim().min(1).max(60), unitPrice: z.number().int().positive(), qty: z.number().int().positive().max(999) }),
]);
export type OrderLineInput = z.infer<typeof orderLineInputSchema>;

export const createOrderSchema = z
  .object({
    /** Client-generated id; retrying with the same id returns the same order. */
    clientId: id,
    outletId: id,
    lines: z.array(orderLineInputSchema).min(1, 'Keranjang kosong').max(100),
    payment: z.object({
      method: z.enum(PAYMENT_METHODS),
      /** Cash handed over; required for CASH. */
      tendered: z.number().int().min(0).optional(),
    }),
  })
  .refine((v) => v.payment.method !== 'CASH' || v.payment.tendered !== undefined, {
    message: 'Masukkan jumlah uang tunai',
    path: ['payment', 'tendered'],
  });
export type CreateOrderInput = z.infer<typeof createOrderSchema>;

export const orderSchema = z.object({
  id,
  clientId: id,
  number: z.string(),
  total: z.number(),
  itemCount: z.number(),
  method: z.enum(PAYMENT_METHODS),
  tendered: z.number(),
  change: z.number(),
  simulated: z.boolean(),
  createdAt: z.string(),
  cashierName: z.string(),
  lines: z.array(z.object({ name: z.string(), qty: z.number(), unitPrice: z.number(), lineTotal: z.number() })),
  /** Ingredients that reached critical or ran out because of this sale. */
  alerts: z.array(z.object({ ingredientId: id, name: z.string(), kind: z.enum(['CRITICAL', 'STOCKOUT']) })),
});
export type Order = z.infer<typeof orderSchema>;
