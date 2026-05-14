import clsx from 'clsx';

interface KpiTileProps {
  label: string;
  value: string;
  sub?: string;
  variant?: 'default' | 'positive' | 'negative' | 'warn' | 'brand';
  count?: number;
}

const VARIANT_CLASSES: Record<NonNullable<KpiTileProps['variant']>, string> = {
  default:  'border-gray-200 bg-white',
  positive: 'border-emerald-200 bg-emerald-50',
  negative: 'border-rose-200 bg-rose-50',
  warn:     'border-amber-200 bg-amber-50',
  brand:    'border-primary-200 bg-primary-50',
};

const VALUE_CLASSES: Record<NonNullable<KpiTileProps['variant']>, string> = {
  default:  'text-gray-800',
  positive: 'text-emerald-700',
  negative: 'text-rose-700',
  warn:     'text-amber-700',
  brand:    'text-primary-600',
};

export default function KpiTile({ label, value, sub, variant = 'default', count }: KpiTileProps) {
  return (
    <div className={clsx('rounded-lg border px-4 py-3 shadow-sm', VARIANT_CLASSES[variant])}>
      <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-gray-500">
        <span>{label}</span>
        {count !== undefined && (
          <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-bold text-gray-600">
            {count}
          </span>
        )}
      </div>
      <div className={clsx('mt-1 text-xl font-bold tabular-nums', VALUE_CLASSES[variant])}>{value}</div>
      {sub && <div className="text-xs text-gray-500">{sub}</div>}
    </div>
  );
}
