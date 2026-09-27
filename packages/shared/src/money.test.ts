import { describe, expect, it } from 'vitest';
import { formatPercent, formatRupiah } from './money.js';
import { canAccess } from './roles.js';

describe('formatRupiah', () => {
  it('uses dot thousands separators', () => {
    expect(formatRupiah(120000)).toBe('Rp120.000');
    expect(formatRupiah(3870000, { space: true })).toBe('Rp 3.870.000');
    expect(formatRupiah(-8750)).toBe('-Rp8.750');
    expect(formatRupiah(500)).toBe('Rp500');
  });
});

describe('formatPercent', () => {
  it('rounds half up with a decimal comma', () => {
    expect(formatPercent(56500 / 120000)).toBe('47,1%');
    expect(formatPercent(0.4665)).toBe('46,7%');
  });
});

describe('canAccess', () => {
  it('limits cashiers to the POS', () => {
    expect(canAccess('CASHIER', 'pos')).toBe(true);
    expect(canAccess('CASHIER', 'stock')).toBe(false);
    expect(canAccess('HEAD_CHEF', 'pos')).toBe(false);
    expect(canAccess('OWNER', 'settings')).toBe(true);
  });
});
