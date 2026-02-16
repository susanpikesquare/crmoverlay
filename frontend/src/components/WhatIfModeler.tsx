import { useState, useMemo } from 'react';

interface WhatIfDeal {
  id: string;
  name: string;
  accountName: string;
  amount: number;
  stage: string;
  probability: number;
  closeDate: string;
  forecastCategory?: string;
}

interface WhatIfModelerProps {
  deals: WhatIfDeal[];
  quotaTarget: number;
  closedWon: number;
  isLoading?: boolean;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);

export default function WhatIfModeler({ deals, quotaTarget, closedWon, isLoading }: WhatIfModelerProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedIds.size === deals.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(deals.map(d => d.id)));
    }
  };

  const { projectedTotal, selectedAmount, currentPct, projectedPct, gap } = useMemo(() => {
    const selected = deals.filter(d => selectedIds.has(d.id));
    const selectedAmt = selected.reduce((sum, d) => sum + d.amount, 0);
    const projected = closedWon + selectedAmt;
    const curPct = quotaTarget > 0 ? (closedWon / quotaTarget) * 100 : 0;
    const projPct = quotaTarget > 0 ? (projected / quotaTarget) * 100 : 0;
    const remaining = Math.max(0, quotaTarget - projected);
    return {
      projectedTotal: projected,
      selectedAmount: selectedAmt,
      currentPct: curPct,
      projectedPct: projPct,
      gap: remaining,
    };
  }, [selectedIds, deals, closedWon, quotaTarget]);

  const getBarColor = (pct: number) => {
    if (pct >= 100) return 'bg-green-500';
    if (pct >= 70) return 'bg-blue-500';
    if (pct >= 40) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-lg font-bold text-slate-900 mb-4">Quota & What-If Modeler</h2>
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="animate-pulse bg-gray-100 h-12 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6 h-full flex flex-col">
      <h2 className="text-lg font-bold text-slate-900 mb-1">Quota & What-If Modeler</h2>
      <p className="text-sm text-slate-500 mb-4">Toggle deals to see projected attainment</p>

      {/* Current Attainment */}
      <div className="mb-3">
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="text-slate-500">Current: {formatCurrency(closedWon)}</span>
          <span className="font-medium text-slate-700">{Math.round(currentPct)}% of {formatCurrency(quotaTarget)}</span>
        </div>
        <div className="w-full bg-slate-100 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all ${getBarColor(currentPct)}`}
            style={{ width: `${Math.min(100, currentPct)}%` }}
          />
        </div>
      </div>

      {/* Projected Attainment */}
      {selectedIds.size > 0 && (
        <div className="mb-3">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-blue-600 font-medium">Projected: {formatCurrency(projectedTotal)}</span>
            <span className="font-bold text-blue-700">{Math.round(projectedPct)}%</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2.5">
            <div
              className="h-2.5 rounded-full bg-blue-500 transition-all"
              style={{ width: `${Math.min(100, projectedPct)}%` }}
            />
          </div>
        </div>
      )}

      {/* Summary Box */}
      <div className="bg-slate-50 rounded-lg p-3 mb-4 border border-slate-200">
        {selectedIds.size > 0 ? (
          <p className="text-sm text-slate-700">
            Close <span className="font-bold">{selectedIds.size} deal{selectedIds.size !== 1 ? 's' : ''}</span> ({formatCurrency(selectedAmount)})
            {' '}&rarr; <span className="font-bold text-blue-700">{Math.round(projectedPct)}%</span> of quota
            {gap > 0 && (
              <span className="block mt-1 text-xs text-slate-500">
                You still need <span className="font-medium text-red-600">{formatCurrency(gap)}</span> more to hit target
              </span>
            )}
            {gap === 0 && (
              <span className="block mt-1 text-xs text-green-600 font-medium">
                Target achieved with selected deals!
              </span>
            )}
          </p>
        ) : (
          <p className="text-sm text-slate-500">
            Select deals below to model your quota attainment.
            {quotaTarget - closedWon > 0 && (
              <span className="block mt-1">
                Gap to target: <span className="font-medium text-red-600">{formatCurrency(quotaTarget - closedWon)}</span>
              </span>
            )}
          </p>
        )}
      </div>

      {/* Deals List */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Open Deals</span>
        <button
          onClick={selectAll}
          className="text-xs text-blue-600 hover:text-blue-800 font-medium"
        >
          {selectedIds.size === deals.length ? 'Deselect All' : 'Select All'}
        </button>
      </div>

      <div className="space-y-1.5 overflow-y-auto flex-1 max-h-[300px]">
        {deals.length === 0 ? (
          <div className="text-center py-6 text-slate-500 text-sm">No open deals found</div>
        ) : (
          deals.map(deal => {
            const isSelected = selectedIds.has(deal.id);
            return (
              <label
                key={deal.id}
                className={`flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                  isSelected
                    ? 'bg-blue-50 border-blue-200'
                    : 'bg-white border-slate-200 hover:bg-slate-50'
                }`}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggle(deal.id)}
                  className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-slate-900 truncate">{deal.name}</div>
                  <div className="text-xs text-slate-500 truncate">
                    {deal.accountName} &middot; {deal.stage}
                    {deal.probability > 0 && ` &middot; ${deal.probability}%`}
                  </div>
                </div>
                <span className="text-sm font-bold text-slate-900 whitespace-nowrap">
                  {formatCurrency(deal.amount)}
                </span>
              </label>
            );
          })
        )}
      </div>
    </div>
  );
}
