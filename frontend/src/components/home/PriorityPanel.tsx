import { Link } from 'react-router-dom';
import clsx from 'clsx';
import type { ReactNode } from 'react';

export interface PriorityItem {
  /** Unique key (typically the record id) */
  key: string;
  /** Optional route to drill in (typically /account/:id or /opportunity/:id) */
  to?: string;
  /** Severity drives the colored left-bar */
  severity: 'critical' | 'warning' | 'opportunity' | 'info';
  /** Primary line — usually the account or deal name */
  title: string;
  /** Optional secondary line — usually owner / stage / context */
  subtitle?: string;
  /** Right-aligned chip — usually a number (days, ARR, score) */
  metric?: string;
  /** Optional bottom line — usually the recommended action */
  recommendation?: string;
  /** Optional pill (e.g. "At Risk", "Hot") */
  badge?: ReactNode;
}

const SEVERITY_BAR: Record<PriorityItem['severity'], string> = {
  critical:    'bg-rose-500',
  warning:     'bg-amber-500',
  opportunity: 'bg-violet-500',
  info:        'bg-primary-500',
};

interface PriorityPanelProps {
  title: string;
  subtitle?: string;
  items: PriorityItem[];
  isLoading?: boolean;
  emptyMessage?: string;
  /** "View all" link in the panel header */
  viewAllTo?: string;
  viewAllLabel?: string;
  /** Cap visible items; the rest collapse behind a "+N more" footer */
  maxVisible?: number;
}

export default function PriorityPanel({
  title,
  subtitle,
  items,
  isLoading,
  emptyMessage = 'Nothing needs attention right now.',
  viewAllTo,
  viewAllLabel = 'View all',
  maxVisible = 5,
}: PriorityPanelProps) {
  const visible = items.slice(0, maxVisible);
  const hiddenCount = Math.max(0, items.length - visible.length);

  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="flex items-start justify-between border-b border-gray-200 px-4 py-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
        </div>
        {viewAllTo && (
          <Link
            to={viewAllTo}
            className="text-sm font-medium text-primary-600 hover:underline"
          >
            {viewAllLabel} →
          </Link>
        )}
      </div>
      <div>
        {isLoading ? (
          <div className="px-4 py-8 text-center text-sm text-slate-500">Loading…</div>
        ) : items.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-slate-500">{emptyMessage}</div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {visible.map((item) => {
              const body = (
                <>
                  <span className={clsx('w-1 flex-shrink-0 rounded-full', SEVERITY_BAR[item.severity])} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0 truncate text-sm font-medium text-slate-900">
                        {item.title}
                      </div>
                      <div className="flex flex-shrink-0 items-center gap-2">
                        {item.badge}
                        {item.metric && (
                          <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs font-semibold tabular-nums text-slate-700">
                            {item.metric}
                          </span>
                        )}
                      </div>
                    </div>
                    {item.subtitle && (
                      <div className="mt-0.5 truncate text-xs text-slate-500">{item.subtitle}</div>
                    )}
                    {item.recommendation && (
                      <div className="mt-1 text-xs text-slate-600">
                        <span className="font-medium text-slate-700">→ </span>
                        {item.recommendation}
                      </div>
                    )}
                  </div>
                </>
              );
              return (
                <li key={item.key}>
                  {item.to ? (
                    <Link to={item.to} className="flex gap-3 px-4 py-3 hover:bg-gray-50">
                      {body}
                    </Link>
                  ) : (
                    <div className="flex gap-3 px-4 py-3">{body}</div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {hiddenCount > 0 && viewAllTo && (
          <div className="border-t border-gray-100 px-4 py-2 text-center">
            <Link to={viewAllTo} className="text-xs font-medium text-primary-600 hover:underline">
              +{hiddenCount} more
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
