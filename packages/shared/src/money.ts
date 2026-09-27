/** Money is integer rupiah everywhere. */
export function formatRupiah(value: number, opts: { space?: boolean } = {}): string {
  const sign = value < 0 ? '-' : '';
  const digits = Math.abs(Math.round(value))
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${sign}Rp${opts.space ? ' ' : ''}${digits}`;
}

/** Percentage with Indonesian decimal comma, rounded half up to `decimals`. */
export function formatPercent(ratio: number, decimals = 1): string {
  const factor = 10 ** decimals;
  const rounded = Math.round(ratio * 100 * factor + Number.EPSILON) / factor;
  return `${rounded.toFixed(decimals).replace('.', ',')}%`;
}
