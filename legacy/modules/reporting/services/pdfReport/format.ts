// ── Formatting (da-DK) ───────────────────────────────────────────────────────

export const formatNumber = (n: number, decimals = 0): string =>
  n.toLocaleString('da-DK', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

export const formatDkk = (n: number): string => `${formatNumber(n, 2)} kr.`;

export const formatDate = (value?: string | null): string => {
  if (!value) return '–';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '–';
  return d.toLocaleDateString('da-DK', { day: 'numeric', month: 'short', year: 'numeric' });
};
