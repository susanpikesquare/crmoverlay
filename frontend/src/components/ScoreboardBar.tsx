interface ScoreboardBarProps {
  quotaAttainment: number;
  pipelineCoverage: number;
  atRiskCount: number;
  signalsCount: number;
  onAtRiskClick?: () => void;
  onSignalsClick?: () => void;
}

export default function ScoreboardBar({
  quotaAttainment,
  pipelineCoverage,
  atRiskCount,
  signalsCount,
  onAtRiskClick,
  onSignalsClick,
}: ScoreboardBarProps) {
  const getQuotaColor = (pct: number) => {
    if (pct >= 80) return 'bg-green-500';
    if (pct >= 50) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getCoverageColor = (ratio: number) => {
    if (ratio >= 3) return 'text-green-700 bg-green-50';
    if (ratio >= 2) return 'text-yellow-700 bg-yellow-50';
    return 'text-red-700 bg-red-50';
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 px-6 py-4 mb-6">
      <div className="flex items-center gap-8 flex-wrap">
        {/* Quota Attainment */}
        <div className="flex-1 min-w-[180px]">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Quota Attainment</span>
            <span className="text-sm font-bold text-slate-900">{Math.round(quotaAttainment)}%</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2.5">
            <div
              className={`h-2.5 rounded-full transition-all ${getQuotaColor(quotaAttainment)}`}
              style={{ width: `${Math.min(100, quotaAttainment)}%` }}
            />
          </div>
        </div>

        {/* Divider */}
        <div className="h-10 w-px bg-slate-200 hidden sm:block" />

        {/* Pipeline Coverage */}
        <div className="flex items-center gap-2 min-w-[140px]">
          <div>
            <div className="text-xs font-medium text-slate-500 uppercase tracking-wide">Pipeline Coverage</div>
            <div className={`inline-block px-2 py-0.5 rounded text-sm font-bold mt-0.5 ${getCoverageColor(pipelineCoverage)}`}>
              {pipelineCoverage.toFixed(1)}x
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="h-10 w-px bg-slate-200 hidden sm:block" />

        {/* At-Risk Count */}
        <button
          onClick={onAtRiskClick}
          className="flex items-center gap-2 min-w-[120px] group cursor-pointer hover:bg-amber-50 rounded-lg px-3 py-1.5 -mx-3 -my-1.5 transition-colors"
        >
          <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center group-hover:bg-amber-200 transition-colors">
            <span className="text-amber-700 text-sm font-bold">{atRiskCount}</span>
          </div>
          <div>
            <div className="text-xs font-medium text-slate-500 uppercase tracking-wide">At-Risk</div>
            <div className="text-xs text-slate-600">Deals</div>
          </div>
        </button>

        {/* Divider */}
        <div className="h-10 w-px bg-slate-200 hidden sm:block" />

        {/* Active Signals */}
        <button
          onClick={onSignalsClick}
          className="flex items-center gap-2 min-w-[120px] group cursor-pointer hover:bg-blue-50 rounded-lg px-3 py-1.5 -mx-3 -my-1.5 transition-colors"
        >
          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center group-hover:bg-blue-200 transition-colors">
            <span className="text-blue-700 text-sm font-bold">{signalsCount}</span>
          </div>
          <div>
            <div className="text-xs font-medium text-slate-500 uppercase tracking-wide">Active</div>
            <div className="text-xs text-slate-600">Signals</div>
          </div>
        </button>
      </div>
    </div>
  );
}
