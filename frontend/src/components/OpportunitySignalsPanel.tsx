import { useState } from 'react';
import { Link } from 'react-router-dom';

interface AESignal {
  id: string;
  accountId: string;
  accountName: string;
  signalType: 'expansion' | 'new-business';
  headline: string;
  details: string;
  score: number;
  category: string;
  actionRecommendation: string;
  metrics: {
    intentScore?: number;
    profileFit?: string;
    buyingStage?: string;
    employeeGrowthPct?: number;
    fundingRound?: string;
    fundingAmount?: number;
    utilizationPct?: number;
    healthScore?: number;
    daysToRenewal?: number;
  };
}

interface OpportunitySignalsPanelProps {
  signals: AESignal[];
  isLoading?: boolean;
}

export default function OpportunitySignalsPanel({ signals, isLoading }: OpportunitySignalsPanelProps) {
  const [activeTab, setActiveTab] = useState<'expansion' | 'new-business'>('new-business');

  const filtered = signals.filter(s => s.signalType === activeTab);
  const expansionCount = signals.filter(s => s.signalType === 'expansion').length;
  const newBizCount = signals.filter(s => s.signalType === 'new-business').length;

  const getCategoryBadge = (category: string) => {
    switch (category) {
      case 'High Intent': return 'bg-red-100 text-red-700';
      case 'Funding Event': return 'bg-green-100 text-green-700';
      case 'Hiring Surge': return 'bg-purple-100 text-purple-700';
      case 'ICP Match': return 'bg-blue-100 text-blue-700';
      case 'High Utilization': return 'bg-orange-100 text-orange-700';
      case 'Renewal Opportunity': return 'bg-yellow-100 text-yellow-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 70) return 'text-green-700 bg-green-50 border-green-200';
    if (score >= 40) return 'text-yellow-700 bg-yellow-50 border-yellow-200';
    return 'text-slate-700 bg-slate-50 border-slate-200';
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-lg font-bold text-slate-900 mb-4">Opportunity Signals</h2>
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="animate-pulse bg-gray-100 h-24 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6 h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Opportunity Signals</h2>
          <p className="text-sm text-slate-500">6sense, Clay, and utilization signals</p>
        </div>
        <span className="px-3 py-1 bg-slate-100 text-slate-700 text-sm font-medium rounded-full">
          {signals.length} signals
        </span>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 mb-4">
        <button
          onClick={() => setActiveTab('new-business')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'new-business'
              ? 'border-blue-500 text-blue-700'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          New Business ({newBizCount})
        </button>
        <button
          onClick={() => setActiveTab('expansion')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'expansion'
              ? 'border-blue-500 text-blue-700'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Expansion ({expansionCount})
        </button>
      </div>

      {/* Signal Cards */}
      <div className="space-y-3 overflow-y-auto flex-1 max-h-[420px]">
        {filtered.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            <p className="font-medium">No {activeTab === 'expansion' ? 'expansion' : 'new business'} signals</p>
            <p className="text-sm mt-1">
              {activeTab === 'new-business'
                ? 'Enrich accounts with 6sense/Clay to surface intent signals'
                : 'No customer accounts with expansion indicators found'}
            </p>
          </div>
        ) : (
          filtered.map(signal => (
            <Link
              key={signal.id}
              to={`/account/${signal.accountId}`}
              className="block p-4 rounded-lg border border-slate-200 hover:border-blue-300 hover:bg-blue-50/30 transition-colors"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-sm text-slate-900 truncate">{signal.accountName}</h3>
                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getCategoryBadge(signal.category)}`}>
                      {signal.category}
                    </span>
                  </div>
                  <p className="text-sm text-slate-700 mt-0.5">{signal.headline}</p>
                </div>
                <span className={`px-2 py-1 text-xs font-bold rounded border ${getScoreColor(signal.score)}`}>
                  {signal.score}
                </span>
              </div>

              {/* Metrics Row */}
              <div className="flex items-center gap-3 text-xs text-slate-500 mb-2 flex-wrap">
                {signal.metrics.intentScore !== undefined && signal.metrics.intentScore > 0 && (
                  <span>Intent: <strong className="text-slate-700">{signal.metrics.intentScore}</strong></span>
                )}
                {signal.metrics.profileFit && (
                  <span>Fit: <strong className="text-slate-700">{signal.metrics.profileFit}</strong></span>
                )}
                {signal.metrics.utilizationPct !== undefined && signal.metrics.utilizationPct > 0 && (
                  <span>Utilization: <strong className="text-slate-700">{signal.metrics.utilizationPct}%</strong></span>
                )}
                {signal.metrics.employeeGrowthPct !== undefined && signal.metrics.employeeGrowthPct > 0 && (
                  <span className="text-green-600">+{signal.metrics.employeeGrowthPct}% growth</span>
                )}
                {signal.metrics.fundingRound && (
                  <span className="text-green-600">{signal.metrics.fundingRound}</span>
                )}
                {signal.metrics.healthScore !== undefined && signal.metrics.healthScore > 0 && (
                  <span>Health: <strong className="text-slate-700">{signal.metrics.healthScore}</strong></span>
                )}
                {signal.metrics.daysToRenewal !== undefined && (
                  <span>Renewal: <strong className="text-slate-700">{signal.metrics.daysToRenewal}d</strong></span>
                )}
              </div>

              {/* AI Recommendation */}
              <div className="text-xs text-purple-700 bg-purple-50 px-2 py-1.5 rounded">
                {signal.actionRecommendation}
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
