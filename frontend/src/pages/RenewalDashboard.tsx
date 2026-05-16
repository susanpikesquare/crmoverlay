import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from '@tanstack/react-table';
import clsx from 'clsx';
import apiClient from '../services/api';
import KpiTile from '../components/dashboard/KpiTile';
import Money from '../components/dashboard/Money';
import RiskBadge from '../components/dashboard/RiskBadge';
import { formatMoney } from '../lib/format';

interface RenewalAccount {
  Id: string;
  Name: string;
  Owner?: { Name?: string };
  daysToRenewal: number;
  contractValue: number;
  healthScore: number;
  renewalRisk: 'At Risk' | 'On Track' | 'Expansion Opportunity';
  keySignals: string[];
  aiRecommendation: string;
}

interface RenewalsResponse {
  success: boolean;
  data: RenewalAccount[];
}

const col = createColumnHelper<RenewalAccount>();

function riskToBadgeSignal(r: RenewalAccount['renewalRisk']) {
  if (r === 'At Risk') return 'high' as const;
  if (r === 'Expansion Opportunity') return 'expand' as const;
  return 'ok' as const;
}

function daysToColor(days: number): string {
  if (days <= 30) return 'text-rose-700 font-semibold';
  if (days <= 90) return 'text-amber-700 font-medium';
  return 'text-gray-700';
}

function healthToColor(score: number): string {
  if (score >= 80) return 'text-emerald-700';
  if (score >= 60) return 'text-amber-700';
  return 'text-rose-700';
}

export default function RenewalDashboard() {
  const [sorting, setSorting] = useState<SortingState>([{ id: 'daysToRenewal', desc: false }]);
  const [scope, setScope] = useState<'my' | 'team' | 'all'>('my');
  const [riskFilter, setRiskFilter] = useState<'all' | RenewalAccount['renewalRisk']>('all');

  const { data, isLoading, error } = useQuery<RenewalsResponse>({
    queryKey: ['renewal-dashboard', scope],
    queryFn: async () => {
      const response = await apiClient.get(`/api/hub/am/renewals?scope=${scope}`);
      return response.data;
    },
  });

  const records = useMemo(() => {
    const all = data?.data ?? [];
    if (riskFilter === 'all') return all;
    return all.filter((r) => r.renewalRisk === riskFilter);
  }, [data, riskFilter]);

  // KPI tile aggregates
  const kpis = useMemo(() => {
    const all = data?.data ?? [];
    const atRisk = all.filter((r) => r.renewalRisk === 'At Risk');
    const onTrack = all.filter((r) => r.renewalRisk === 'On Track');
    const expansion = all.filter((r) => r.renewalRisk === 'Expansion Opportunity');
    const totalContractValue = all.reduce((s, r) => s + (r.contractValue || 0), 0);
    const atRiskValue = atRisk.reduce((s, r) => s + (r.contractValue || 0), 0);
    const expansionValue = expansion.reduce((s, r) => s + (r.contractValue || 0), 0);
    const dueIn30 = all.filter((r) => r.daysToRenewal <= 30).length;
    return {
      totalCount: all.length,
      atRiskCount: atRisk.length,
      onTrackCount: onTrack.length,
      expansionCount: expansion.length,
      totalContractValue,
      atRiskValue,
      expansionValue,
      dueIn30,
    };
  }, [data]);

  const columns = useMemo(() => [
    col.accessor('Name', {
      header: 'Account',
      cell: (c) => (
        <Link
          to={`/account/${c.row.original.Id}`}
          className="font-medium text-primary-600 hover:underline"
        >
          {c.getValue()}
        </Link>
      ),
    }),
    col.accessor('Owner.Name' as any, {
      id: 'owner',
      header: 'Owner',
      cell: (c) => <span className="text-gray-700">{c.row.original.Owner?.Name ?? '—'}</span>,
    }),
    col.accessor('renewalRisk', {
      header: 'Risk',
      cell: (c) => <RiskBadge signal={riskToBadgeSignal(c.getValue())} label={c.getValue()} />,
    }),
    col.accessor('healthScore', {
      header: 'Health',
      cell: (c) => {
        const score = c.getValue();
        return (
          <span className={clsx('tabular-nums font-medium', healthToColor(score))}>
            {score ?? '—'}
          </span>
        );
      },
    }),
    col.accessor('daysToRenewal', {
      header: 'Days to Renewal',
      cell: (c) => {
        const d = c.getValue();
        return <span className={clsx('tabular-nums', daysToColor(d))}>{d}</span>;
      },
    }),
    col.accessor('contractValue', {
      header: 'Contract Value',
      cell: (c) => <Money value={c.getValue() || 0} compact />,
    }),
    col.accessor('keySignals', {
      header: 'Key Signals',
      cell: (c) => {
        const signals = c.getValue() || [];
        if (signals.length === 0) return <span className="text-gray-400">—</span>;
        return (
          <div className="flex flex-wrap gap-1">
            {signals.slice(0, 3).map((s, i) => (
              <span key={i} className="inline-block rounded bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-700">
                {s}
              </span>
            ))}
            {signals.length > 3 && (
              <span className="inline-block text-[11px] text-gray-500">+{signals.length - 3}</span>
            )}
          </div>
        );
      },
      enableSorting: false,
    }),
    col.accessor('aiRecommendation', {
      header: 'Recommended Action',
      cell: (c) => {
        const rec = c.getValue();
        if (!rec) return <span className="text-gray-400">—</span>;
        return (
          <span className="line-clamp-2 text-sm text-gray-700" title={rec}>
            {rec}
          </span>
        );
      },
      enableSorting: false,
    }),
  ], []);

  const table = useReactTable({
    data: records,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Renewal Dashboard</h1>
            <p className="mt-1 text-sm text-slate-600">
              Renewals coming up in the next 180 days, scored by risk and expansion opportunity.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Scope</span>
            <div className="inline-flex rounded-md border border-gray-200 bg-white">
              {(['my', 'team', 'all'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setScope(s)}
                  className={clsx(
                    'px-3 py-1.5 text-sm font-medium first:rounded-l-md last:rounded-r-md',
                    scope === s
                      ? 'bg-primary-500 text-white'
                      : 'text-gray-700 hover:bg-gray-50',
                  )}
                >
                  {s === 'my' ? 'My' : s === 'team' ? 'Team' : 'All'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* KPI tiles */}
        <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
          <KpiTile
            label="Total Pipeline"
            value={formatMoney(kpis.totalContractValue, { compact: true })}
            sub={`${kpis.totalCount} accounts`}
            variant="brand"
          />
          <KpiTile
            label="At Risk"
            value={String(kpis.atRiskCount)}
            sub={formatMoney(kpis.atRiskValue, { compact: true })}
            variant="negative"
          />
          <KpiTile
            label="On Track"
            value={String(kpis.onTrackCount)}
            variant="positive"
          />
          <KpiTile
            label="Expansion"
            value={String(kpis.expansionCount)}
            sub={formatMoney(kpis.expansionValue, { compact: true })}
            variant="warn"
          />
          <KpiTile
            label="Due in 30 Days"
            value={String(kpis.dueIn30)}
            sub="renewals closing soon"
          />
          <KpiTile
            label="Avg Contract Value"
            value={formatMoney(
              kpis.totalCount > 0 ? kpis.totalContractValue / kpis.totalCount : 0,
              { compact: true },
            )}
          />
        </div>

        {/* Filter row */}
        <div className="mb-4 flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Filter</span>
          <div className="inline-flex rounded-md border border-gray-200 bg-white">
            {(['all', 'At Risk', 'On Track', 'Expansion Opportunity'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setRiskFilter(f)}
                className={clsx(
                  'px-3 py-1.5 text-sm font-medium first:rounded-l-md last:rounded-r-md',
                  riskFilter === f
                    ? 'bg-primary-500 text-white'
                    : 'text-gray-700 hover:bg-gray-50',
                )}
              >
                {f === 'all' ? 'All' : f}
              </button>
            ))}
          </div>
          <div className="ml-auto text-sm text-gray-500">
            {records.length} {records.length === 1 ? 'account' : 'accounts'}
          </div>
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          {isLoading ? (
            <div className="px-6 py-12 text-center text-sm text-gray-500">Loading renewals…</div>
          ) : error ? (
            <div className="px-6 py-12 text-center text-sm text-rose-600">
              Failed to load renewals. Try refreshing or check your Salesforce connection.
            </div>
          ) : records.length === 0 ? (
            <div className="px-6 py-12 text-center text-sm text-gray-500">
              No renewals match the current filters.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-left">
                  {table.getHeaderGroups().map((hg) => (
                    <tr key={hg.id} className="border-b border-gray-200">
                      {hg.headers.map((h) => {
                        const canSort = h.column.getCanSort();
                        return (
                          <th
                            key={h.id}
                            onClick={canSort ? h.column.getToggleSortingHandler() : undefined}
                            className={clsx(
                              'px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500',
                              canSort && 'cursor-pointer select-none hover:text-gray-800',
                            )}
                          >
                            <span className="inline-flex items-center gap-1">
                              {flexRender(h.column.columnDef.header, h.getContext())}
                              {h.column.getIsSorted() === 'asc' && <span>↑</span>}
                              {h.column.getIsSorted() === 'desc' && <span>↓</span>}
                            </span>
                          </th>
                        );
                      })}
                    </tr>
                  ))}
                </thead>
                <tbody>
                  {table.getRowModel().rows.map((row) => (
                    <tr key={row.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                      {row.getVisibleCells().map((cell) => (
                        <td key={cell.id} className="px-4 py-3 align-top">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
