import clsx from 'clsx';
import { formatMoney } from '../../lib/format';

interface MoneyProps {
  value: number;
  compact?: boolean;
  signed?: boolean;
  className?: string;
  dimWhenZero?: boolean;
}

export default function Money({ value, compact, signed, className, dimWhenZero }: MoneyProps) {
  const dimmed = dimWhenZero && (value === 0 || !value);
  return (
    <span className={clsx('tabular-nums', dimmed && 'text-gray-400', className)}>
      {formatMoney(value, { compact, signed })}
    </span>
  );
}
