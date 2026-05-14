// Currency / number / date formatting helpers used across dashboard views.

export function formatMoney(n: number, opts: { compact?: boolean; signed?: boolean } = {}): string {
  if (!isFinite(n)) return '—';
  const abs = Math.abs(n);
  let formatted: string;
  if (opts.compact) {
    if (abs >= 1_000_000) formatted = `$${(n / 1_000_000).toFixed(abs >= 10_000_000 ? 1 : 2)}M`;
    else if (abs >= 1_000) formatted = `$${(n / 1_000).toFixed(abs >= 100_000 ? 0 : 1)}K`;
    else formatted = `$${Math.round(n).toLocaleString('en-US')}`;
  } else {
    formatted = `$${Math.round(n).toLocaleString('en-US')}`;
  }
  if (opts.signed && n > 0) formatted = `+${formatted}`;
  return formatted;
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
