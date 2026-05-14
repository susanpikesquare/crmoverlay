// Currency / number / date formatting helpers used across dashboard views.

export function formatMoney(n: number, opts: { compact?: boolean; signed?: boolean } = {}): string {
  if (!isFinite(n)) return '—';
  // Snap near-zero values to 0 so the sign agrees with the rounded body —
  // otherwise -0.3 would render as "-$0" (rounds to 0 but sign survives).
  if (Math.abs(n) < 0.5) n = 0;
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : opts.signed && n > 0 ? '+' : '';
  let body: string;
  if (opts.compact) {
    if (abs >= 1_000_000) body = `$${(abs / 1_000_000).toFixed(abs >= 10_000_000 ? 1 : 2)}M`;
    else if (abs >= 1_000) body = `$${(abs / 1_000).toFixed(abs >= 100_000 ? 0 : 1)}K`;
    else body = `$${Math.round(abs).toLocaleString('en-US')}`;
  } else {
    body = `$${Math.round(abs).toLocaleString('en-US')}`;
  }
  return sign + body;
}

export function formatNumber(n: number): string {
  return Math.round(n).toLocaleString('en-US');
}

export function formatPct(n: number, digits = 1): string {
  return `${n.toFixed(digits)}%`;
}

export function formatDate(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function formatDateShort(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
