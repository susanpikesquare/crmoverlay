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

interface ManagerAlert {
  id: string;
  category: 'stuck-deal' | 'low-meddpicc' | 'cold-account' | 'pipeline-gap' | 'large-deal-risk';
  severity: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  metric?: number;
  benchmark?: number;
  dealId?: string;
  dealName?: string;
  accountId?: string;
  accountName?: string;
  amount?: number;
}

interface GongDealSignal {
  opportunityId: string;
  opportunityName: string;
  accountId: string;
  accountName: string;
  signals: Array<{
    type: string;
    confidence: 'high' | 'medium' | 'low';
    evidence: string;
    callTitle: string;
  }>;
  momentum: 'accelerating' | 'steady' | 'stalling' | 'unknown';
  summary: string;
  callCount: number;
  lastCallDate: string;
}

interface AccountInsightsPanelProps {
  signals: AESignal[];
  alerts: ManagerAlert[];
  gongSignals?: GongDealSignal[];
  isLoading?: boolean;
}

type TabKey = 'hot' | 'cold' | 'expansion' | 'signals';

export default function AccountInsightsPanel({ signals, alerts, gongSignals = [], isLoading }: AccountInsightsPanelProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('hot');

  // Hot Accounts: high intent (>= 70) or active buying stage from new-business signals
  const hotAccounts = signals.filter(
    s => s.signalType === 'new-business' && ((s.metrics.intentScore || 0) >= 70 || s.metrics.buyingStage)
  );

  // Cold Accounts: from manager alerts with cold-account category
  const coldAccounts = alerts.filter(a => a.category === 'cold-account');

  // Expansion Ready: expansion signals with high scores
  const expansionAccounts = signals.filter(s => s.signalType === 'expansion');

  // Convert Gong signals to AESignal format for the Signals tab
  const gongAsSignals: AESignal[] = gongSignals.flatMap(deal =>
    deal.signals.map((s, idx) => {
      const categoryMap: Record<string, string> = {
        'budget-confirmed': 'Budget Confirmed',
        'timeline-pressure': 'Timeline Pressure',
        'champion-identified': 'Champion Found',
        'multi-threading': 'Multi-Threading',
        'competitive-threat': 'Competitive Threat',
        'decision-process-revealed': 'Decision Process',
        'positive-momentum': 'Positive Momentum',
        'objection-surfaced': 'Objection',
      };
      const confidenceScore = s.confidence === 'high' ? 85 : s.confidence === 'medium' ? 65 : 45;
      return {
        id: `gong-${deal.opportunityId}-${s.type}-${idx}`,
        accountId: deal.accountId,
        accountName: deal.accountName,
        signalType: 'new-business' as const,
        headline: deal.summary || `${categoryMap[s.type] || s.type} detected in Gong call`,
        details: s.evidence || `Detected in: ${s.callTitle}`,
        score: confidenceScore,
        category: categoryMap[s.type] || s.type,
        actionRecommendation: `Review Gong call "${s.callTitle}"`,
        metrics: {},
      };
    })
  );

  // All Signals: merge existing + Gong, sorted by score
  const allSignals = [...signals, ...gongAsSignals].sort((a, b) => b.score - a.score);

  const tabs: { key: TabKey; label: string; count: number }[] = [
    { key: 'hot', label: 'Hot', count: hotAccounts.length },
    { key: 'cold', label: 'Cold', count: coldAccounts.length },
    { key: 'expansion', label: 'Expansion Ready', count: expansionAccounts.length },
    { key: 'signals', label: 'Signals', count: allSignals.length },
  ];

  const getScoreColor = (score: number) => {
    if (score >= 70) return 'text-green-700 bg-green-50 border-green-200';
    if (score >= 40) return 'text-yellow-700 bg-yellow-50 border-yellow-200';
    return 'text-slate-700 bg-slate-50 border-slate-200';
  };

  const getCategoryBadge = (category: string) => {
    switch (category) {
      case 'High Intent': return 'bg-red-100 text-red-700';
      case 'Funding Event': return 'bg-green-100 text-green-700';
      case 'Hiring Surge': return 'bg-purple-100 text-purple-700';
      case 'ICP Match': return 'bg-blue-100 text-blue-700';
      case 'High Utilization': return 'bg-orange-100 text-orange-700';
      case 'Renewal Opportunity': return 'bg-yellow-100 text-yellow-700';
      // Gong signal categories
      case 'Budget Confirmed': return 'bg-green-100 text-green-700';
      case 'Timeline Pressure': return 'bg-amber-100 text-amber-700';
      case 'Champion Found': return 'bg-blue-100 text-blue-700';
      case 'Multi-Threading': return 'bg-indigo-100 text-indigo-700';
      case 'Competitive Threat': return 'bg-red-100 text-red-700';
      case 'Decision Process': return 'bg-purple-100 text-purple-700';
      case 'Positive Momentum': return 'bg-green-100 text-green-700';
      case 'Objection': return 'bg-orange-100 text-orange-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-lg font-bold text-slate-900 mb-4">Account Insights</h2>
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
          <h2 className="text-lg font-bold text-slate-900">Account Insights</h2>
          <p className="text-sm text-slate-500">Account-level signals and engagement health</p>
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
        {activeTab === 'hot' && (
          hotAccounts.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <p className="font-medium">No hot accounts</p>
              <p className="text-sm mt-1">Enrich accounts with 6sense/Clay to surface high-intent prospects</p>
            </div>
          ) : (
            hotAccounts.map(signal => (
              <Link
                key={signal.id}
                to={`/account/${signal.accountId}`}
                className="block p-4 rounded-lg border border-slate-200 hover:border-blue-300 hover:bg-blue-50/30 transition-colors"
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <h3 className="font-semibold text-sm text-slate-900 truncate">{signal.accountName}</h3>
                  {signal.metrics.intentScore !== undefined && signal.metrics.intentScore > 0 && (
                    <span className={`px-2 py-0.5 text-xs font-bold rounded border ${getScoreColor(signal.metrics.intentScore)}`}>
                      {signal.metrics.intentScore} intent
                    </span>
                  )}
                </div>
                {signal.metrics.buyingStage && (
                  <span className="inline-block px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-700 mb-1">
                    {signal.metrics.buyingStage}
                  </span>
                )}
                <p className="text-xs text-slate-600">{signal.headline}</p>
              </Link>
            ))
          )
        )}

        {activeTab === 'cold' && (
          coldAccounts.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <p className="font-medium">No cold accounts</p>
              <p className="text-sm mt-1">All accounts have recent activity</p>
            </div>
          ) : (
            coldAccounts.map(alert => (
              <Link
                key={alert.id}
                to={`/account/${alert.accountId}`}
                className="block p-4 rounded-lg border border-slate-200 hover:border-blue-300 hover:bg-blue-50/30 transition-colors"
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <h3 className="font-semibold text-sm text-slate-900 truncate">{alert.accountName}</h3>
                  <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                    alert.severity === 'critical' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                  }`}>
                    {alert.metric ? `${alert.metric}d ago` : 'No activity'}
                  </span>
                </div>
                <p className="text-xs text-slate-600">{alert.description}</p>
              </Link>
            ))
          )
        )}

        {activeTab === 'expansion' && (
          expansionAccounts.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <p className="font-medium">No expansion-ready accounts</p>
              <p className="text-sm mt-1">No customer accounts with expansion indicators found</p>
            </div>
          ) : (
            expansionAccounts.map(signal => (
              <Link
                key={signal.id}
                to={`/account/${signal.accountId}`}
                className="block p-4 rounded-lg border border-slate-200 hover:border-blue-300 hover:bg-blue-50/30 transition-colors"
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <h3 className="font-semibold text-sm text-slate-900 truncate">{signal.accountName}</h3>
                  <span className={`px-2 py-1 text-xs font-bold rounded border ${getScoreColor(signal.score)}`}>
                    {signal.score}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-500 mb-1 flex-wrap">
                  {signal.metrics.utilizationPct !== undefined && signal.metrics.utilizationPct > 0 && (
                    <span>Utilization: <strong className="text-slate-700">{signal.metrics.utilizationPct}%</strong></span>
                  )}
                  {signal.metrics.healthScore !== undefined && signal.metrics.healthScore > 0 && (
                    <span>Health: <strong className="text-slate-700">{signal.metrics.healthScore}</strong></span>
                  )}
                  {signal.metrics.daysToRenewal !== undefined && (
                    <span>Renewal: <strong className="text-slate-700">{signal.metrics.daysToRenewal}d</strong></span>
                  )}
                </div>
                <p className="text-xs text-slate-600">{signal.headline}</p>
              </Link>
            ))
          )
        )}

        {activeTab === 'signals' && (
          allSignals.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <p className="font-medium">No signals</p>
              <p className="text-sm mt-1">Enrich accounts with 6sense/Clay to surface signals</p>
            </div>
          ) : (
            allSignals.map(signal => {
              const isGong = signal.id.startsWith('gong-');
              // Find momentum for Gong signals
              const dealMomentum = isGong
                ? gongSignals.find(gs => signal.id.includes(gs.opportunityId))?.momentum
                : undefined;
              return (
                <Link
                  key={signal.id}
                  to={`/account/${signal.accountId}`}
                  className="block p-4 rounded-lg border border-slate-200 hover:border-blue-300 hover:bg-blue-50/30 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-sm text-slate-900 truncate">{signal.accountName}</h3>
                        <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getCategoryBadge(signal.category)}`}>
                          {signal.category}
                        </span>
                        {isGong && (
                          <span className="px-1.5 py-0.5 text-xs font-medium rounded bg-violet-50 text-violet-600 border border-violet-200">
                            Gong
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {dealMomentum && dealMomentum !== 'unknown' && (
                        <span className={`px-1.5 py-0.5 text-xs font-medium rounded ${
                          dealMomentum === 'accelerating' ? 'bg-green-50 text-green-700' :
                          dealMomentum === 'steady' ? 'bg-blue-50 text-blue-700' :
                          'bg-red-50 text-red-700'
                        }`}>
                          {dealMomentum === 'accelerating' ? 'Accelerating' :
                           dealMomentum === 'steady' ? 'Steady' : 'Stalling'}
                        </span>
                      )}
                      <span className={`px-2 py-1 text-xs font-bold rounded border ${getScoreColor(signal.score)}`}>
                        {signal.score}
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-slate-600">{signal.details}</p>
                </Link>
              );
            })
          )
        )}
      </div>
    </div>
  );
}
