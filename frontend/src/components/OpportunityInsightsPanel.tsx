import { useState } from 'react';
import { Link } from 'react-router-dom';

interface RiskReason {
  category: 'no-exec-sponsor' | 'stalling' | 'few-stakeholders' | 'strong-competition' | 'missing-success-criteria' | 'missing-business-impact' | 'negative-sentiment' | 'no-engagement';
  label: string;
  detail: string;
  severity: 'critical' | 'high' | 'medium';
}

interface EnhancedAtRiskDeal {
  dealId: string;
  dealName: string;
  accountName: string;
  accountId: string;
  amount: number;
  stage: string;
  closeDate: string;
  daysInStage: number;
  overallRiskScore: number;
  riskReasons: RiskReason[];
}

interface StalledDeal {
  dealId: string;
  dealName: string;
  accountName: string;
  accountId: string;
  amount: number;
  stage: string;
  closeDate: string;
  daysInStage: number;
  lastActivityDate: string;
}

interface WatchlistDeal {
  dealId: string;
  dealName: string;
  accountName: string;
  accountId: string;
  amount: number;
  stage: string;
  closeDate: string;
  forecastCategory: string;
}

interface OpportunityInsightsPanelProps {
  atRiskDeals: EnhancedAtRiskDeal[];
  stalledDeals: StalledDeal[];
  watchlistDeals: WatchlistDeal[];
  watchlistIds: Set<string>;
  onToggleWatchlist: (dealId: string) => void;
  isLoading?: boolean;
}

type TabKey = 'at-risk' | 'stalled' | 'watchlist';

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);

const formatDate = (dateStr: string) => {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

function StarButton({ dealId, watchlistIds, onToggle }: { dealId: string; watchlistIds: Set<string>; onToggle: (id: string) => void }) {
  const isWatched = watchlistIds.has(dealId);
  return (
    <button
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggle(dealId); }}
      className={`text-lg leading-none flex-shrink-0 transition-colors ${
        isWatched ? 'text-yellow-500 hover:text-yellow-600' : 'text-slate-300 hover:text-yellow-400'
      }`}
      title={isWatched ? 'Remove from watchlist' : 'Add to watchlist'}
    >
      {isWatched ? '\u2605' : '\u2606'}
    </button>
  );
}

function RiskBadge({ reason }: { reason: RiskReason }) {
  const colorMap: Record<string, string> = {
    'no-exec-sponsor': 'bg-red-100 text-red-700',
    'stalling': 'bg-amber-100 text-amber-700',
    'few-stakeholders': 'bg-orange-100 text-orange-700',
    'strong-competition': 'bg-purple-100 text-purple-700',
    'missing-success-criteria': 'bg-blue-100 text-blue-700',
    'missing-business-impact': 'bg-teal-100 text-teal-700',
    'negative-sentiment': 'bg-rose-100 text-rose-700',
    'no-engagement': 'bg-gray-100 text-gray-700',
  };
  return (
    <span
      className={`px-1.5 py-0.5 text-xs font-medium rounded ${colorMap[reason.category] || 'bg-gray-100 text-gray-700'}`}
      title={reason.detail}
    >
      {reason.label}
    </span>
  );
}

export default function OpportunityInsightsPanel({
  atRiskDeals,
  stalledDeals,
  watchlistDeals,
  watchlistIds,
  onToggleWatchlist,
  isLoading,
}: OpportunityInsightsPanelProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('at-risk');

  const tabs: { key: TabKey; label: string; count: number }[] = [
    { key: 'at-risk', label: 'At Risk', count: atRiskDeals.length },
    { key: 'stalled', label: 'Stalled', count: stalledDeals.length },
    { key: 'watchlist', label: 'My Watchlist', count: watchlistDeals.length },
  ];

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-lg font-bold text-slate-900 mb-4">Opportunity Insights</h2>
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="animate-pulse bg-gray-100 h-20 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6 h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Opportunity Insights</h2>
          <p className="text-sm text-slate-500">Deal health and risk analysis</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 mb-4">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.key
                ? 'border-blue-500 text-blue-700'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab.label} ({tab.count})
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="space-y-3 overflow-y-auto flex-1 max-h-[420px]">
        {activeTab === 'at-risk' && (
          atRiskDeals.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <p className="font-medium">No at-risk deals</p>
              <p className="text-sm mt-1">All deals are progressing well</p>
            </div>
          ) : (
            atRiskDeals.map(deal => (
              <Link
                key={deal.dealId}
                to={`/opportunity/${deal.dealId}`}
                className="block p-4 rounded-lg border border-slate-200 hover:border-blue-300 hover:bg-blue-50/30 transition-colors"
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-sm text-slate-900 truncate">{deal.dealName}</h3>
                      <StarButton dealId={deal.dealId} watchlistIds={watchlistIds} onToggle={onToggleWatchlist} />
                    </div>
                    <p className="text-xs text-slate-500">{deal.accountName}</p>
                  </div>
                  <span className="text-sm font-medium text-slate-700 flex-shrink-0">{formatCurrency(deal.amount)}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500 mb-2">
                  <span>{deal.stage}</span>
                  <span>|</span>
                  <span>Close {formatDate(deal.closeDate)}</span>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {deal.riskReasons.map((reason, idx) => (
                    <RiskBadge key={idx} reason={reason} />
                  ))}
                </div>
              </Link>
            ))
          )
        )}

        {activeTab === 'stalled' && (
          stalledDeals.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <p className="font-medium">No stalled deals</p>
              <p className="text-sm mt-1">All deals are progressing through stages</p>
            </div>
          ) : (
            stalledDeals.map(deal => (
              <Link
                key={deal.dealId}
                to={`/opportunity/${deal.dealId}`}
                className="block p-4 rounded-lg border border-slate-200 hover:border-blue-300 hover:bg-blue-50/30 transition-colors"
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-sm text-slate-900 truncate">{deal.dealName}</h3>
                      <StarButton dealId={deal.dealId} watchlistIds={watchlistIds} onToggle={onToggleWatchlist} />
                    </div>
                    <p className="text-xs text-slate-500">{deal.accountName}</p>
                  </div>
                  <span className="text-sm font-medium text-slate-700 flex-shrink-0">{formatCurrency(deal.amount)}</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-500">
                  <span>{deal.stage}</span>
                  <span className={`font-medium ${deal.daysInStage > 60 ? 'text-red-600' : 'text-amber-600'}`}>
                    {deal.daysInStage} days in stage
                  </span>
                  {deal.lastActivityDate && (
                    <span>Last activity: {formatDate(deal.lastActivityDate)}</span>
                  )}
                </div>
              </Link>
            ))
          )
        )}

        {activeTab === 'watchlist' && (
          watchlistDeals.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <p className="text-2xl mb-2">{'\u2606'}</p>
              <p className="font-medium">No watchlisted deals</p>
              <p className="text-sm mt-1">Star any deal to add it to your watchlist</p>
            </div>
          ) : (
            watchlistDeals.map(deal => (
              <Link
                key={deal.dealId}
                to={`/opportunity/${deal.dealId}`}
                className="block p-4 rounded-lg border border-slate-200 hover:border-blue-300 hover:bg-blue-50/30 transition-colors"
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-sm text-slate-900 truncate">{deal.dealName}</h3>
                      <StarButton dealId={deal.dealId} watchlistIds={watchlistIds} onToggle={onToggleWatchlist} />
                    </div>
                    <p className="text-xs text-slate-500">{deal.accountName}</p>
                  </div>
                  <span className="text-sm font-medium text-slate-700 flex-shrink-0">{formatCurrency(deal.amount)}</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-500">
                  <span>{deal.stage}</span>
                  <span>Close {formatDate(deal.closeDate)}</span>
                  {deal.forecastCategory && (
                    <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-xs">
                      {deal.forecastCategory}
                    </span>
                  )}
                </div>
              </Link>
            ))
          )
        )}
      </div>
    </div>
  );
}
