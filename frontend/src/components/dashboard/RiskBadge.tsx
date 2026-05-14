import clsx from 'clsx';

export type RiskSignal = 'high' | 'med' | 'expand' | 'ok';

const COLORS: Record<RiskSignal, string> = {
  high:   'bg-rose-100 text-rose-700 border-rose-200',
  med:    'bg-amber-100 text-amber-700 border-amber-200',
  expand: 'bg-violet-100 text-violet-700 border-violet-200',
  ok:     'bg-emerald-100 text-emerald-700 border-emerald-200',
};

const LABELS: Record<RiskSignal, string> = {
  high:   'High Risk',
  med:    'At Risk',
  expand: 'Expansion',
  ok:     'Healthy',
};

interface RiskBadgeProps {
  signal: RiskSignal;
  label?: string;
}

export default function RiskBadge({ signal, label }: RiskBadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold',
        COLORS[signal],
      )}
    >
      {label ?? LABELS[signal]}
    </span>
  );
}
