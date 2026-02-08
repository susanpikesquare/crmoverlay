import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { Link } from 'react-router-dom';
import TodaysPrioritiesPanel from '../components/TodaysPrioritiesPanel';
import PipelineForecastPanel from '../components/PipelineForecastPanel';
import AIAssistant from '../components/AIAssistant';
import { config } from '../config';

const API_URL = config.apiBaseUrl;

interface AEMetrics {
  quotaAttainmentYTD: number;
  pipelineCoverage: number;
  hotProspectsCount: number;
  avgDealSize: number;
}

interface PriorityAccount {
  Id: string;
  Name: string;
  priorityTier: '🔥 Hot' | '🔶 Warm' | '🔵 Cool';
  employeeCount: number;
  employeeGrowthPct: number;
  intentScore: number;
  buyingStage: string;
  techStack: string;
  topSignal: string;
  aiRecommendation: string;
}

interface AtRiskDeal {
  Id: string;
  Name: string;
  Account: { Name: string };
  Amount: number;
  StageName: string;
  daysStale: number;
  meddpiccScore: number;
  warning: string;
  aiRecommendation: string;
}

export default function AEHub() {
  const [timeframe, setTimeframe] = useState<'annual' | 'quarterly'>('annual');
  const [expandedPriority, setExpandedPriority] = useState(false);
  const [expandedAtRisk, setExpandedAtRisk] = useState(false);

  // Fetch metrics
  const { data: metricsData } = useQuery<{
    success: boolean;
    data: AEMetrics;
  }>({
    queryKey: ['ae-metrics', timeframe],
    queryFn: async () => {
      const response = await axios.get(`${API_URL}/api/hub/ae/metrics?timeframe=${timeframe}`, {
        withCredentials: true,
      });
      return response.data;
    },
  });

  // Fetch priority accounts
  const { data: accountsData, isLoading: loadingAccounts } = useQuery<{
    success: boolean;
    data: PriorityAccount[];
  }>({
    queryKey: ['ae-priority-accounts'],
    queryFn: async () => {
      const response = await axios.get(`${API_URL}/api/hub/ae/priority-accounts`, {
        withCredentials: true,
      });
      return response.data;
    },
  });

  // Fetch at-risk deals
  const { data: dealsData, isLoading: loadingDeals } = useQuery<{
    success: boolean;
    data: AtRiskDeal[];
  }>({
    queryKey: ['ae-at-risk-deals'],
    queryFn: async () => {
      const response = await axios.get(`${API_URL}/api/hub/ae/at-risk-deals`, {
        withCredentials: true,
      });
      return response.data;
    },
  });

  // Fetch today's priorities
  const { data: prioritiesData } = useQuery<{
    success: boolean;
    data: any[];
  }>({
    queryKey: ['ae-priorities'],
    queryFn: async () => {
      const response = await axios.get(`${API_URL}/api/hub/ae/priorities`, {
        withCredentials: true,
      });
      return response.data;
    },
  });

  const metrics = metricsData?.data;
  const priorityAccounts = accountsData?.data || [];
  const atRiskDeals = dealsData?.data || [];
  const priorities = prioritiesData?.data || [];

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatPercent = (value: number) => {
    return `${Math.round(value)}%`;
  };

  // Calculate quick stats
  const hotCount = priorityAccounts.filter(a => a.priorityTier === '🔥 Hot').length;
  const warmCount = priorityAccounts.filter(a => a.priorityTier === '🔶 Warm').length;
  const criticalDeals = atRiskDeals.filter(d => d.daysStale > 30 || d.meddpiccScore < 50).length;

  // Panel header component
  const PanelHeader = ({
    title,
    subtitle,
    count,
    badgeColor,
    expanded,
    onToggle,
  }: {
    title: string;
    subtitle: string;
    count: number;
    badgeColor: string;
    expanded: boolean;
    onToggle: () => void;
  }) => (
    <div className="flex items-center justify-between mb-4">
      <div>
        <h2 className="text-lg font-bold text-slate-900">{title}</h2>
        <p className="text-sm text-slate-500">{subtitle}</p>
      </div>
      <div className="flex items-center gap-3">
        <span className={`px-3 py-1 ${badgeColor} text-sm font-medium rounded-full`}>
          {count} items
        </span>
        {count > 5 && (
          <button
            onClick={onToggle}
            className="text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
          >
            {expanded ? (
              <>
                Show Less
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                </svg>
              </>
            ) : (
              <>
                View All
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );

  const LoadingSkeleton = () => (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="animate-pulse bg-gray-100 h-20 rounded-lg"></div>
      ))}
    </div>
  );

  const EmptyState = ({ message, submessage }: { message: string; submessage: string }) => (
    <div className="text-center py-6 text-slate-500">
      <p>{message}</p>
      <p className="text-sm mt-1">{submessage}</p>
    </div>
  );

  const getTierColor = (tier: string) => {
    if (tier === '🔥 Hot') return 'bg-red-50 border-red-200 hover:bg-red-100';
    if (tier === '🔶 Warm') return 'bg-orange-50 border-orange-200 hover:bg-orange-100';
    return 'bg-blue-50 border-blue-200 hover:bg-blue-100';
  };

  const getTierBadgeColor = (tier: string) => {
    if (tier === '🔥 Hot') return 'bg-red-100 text-red-800';
    if (tier === '🔶 Warm') return 'bg-orange-100 text-orange-800';
    return 'bg-blue-100 text-blue-800';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8 flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Account Executive Hub</h1>
            <p className="text-slate-600 mt-2">New business acquisition and pipeline building</p>
          </div>

          {/* Timeframe Toggle */}
          <div className="flex items-center gap-2 bg-white rounded-lg shadow-sm p-1 border border-slate-200">
            <button
              onClick={() => setTimeframe('annual')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                timeframe === 'annual'
                  ? 'bg-blue-500 text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Annual
            </button>
            <button
              onClick={() => setTimeframe('quarterly')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                timeframe === 'quarterly'
                  ? 'bg-blue-500 text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Quarterly
            </button>
          </div>
        </div>

        {/* AI Assistant */}
        <div className="mb-6">
          <AIAssistant userRole="Account Executive" />
        </div>

        {/* Top Metrics Row - More Compact */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {/* Quota Attainment */}
          <div className="bg-white rounded-lg shadow-sm p-4 border-l-4 border-blue-500">
            <div className="text-xs font-medium text-slate-600 mb-1">
              Quota Attainment {timeframe === 'annual' ? 'YTD' : 'QTD'}
            </div>
            <div className="text-2xl font-bold text-slate-900">
              {metrics ? formatPercent(metrics.quotaAttainmentYTD) : '—'}
            </div>
            <div className="text-xs text-slate-500">
              of {timeframe} quota
            </div>
          </div>

          {/* Pipeline Coverage */}
          <div className="bg-white rounded-lg shadow-sm p-4 border-l-4 border-green-500">
            <div className="text-xs font-medium text-slate-600 mb-1">Pipeline Coverage</div>
            <div className="text-2xl font-bold text-slate-900">
              {metrics ? `${metrics.pipelineCoverage.toFixed(1)}x` : '—'}
            </div>
            <div className="text-xs text-slate-500">
              vs. remaining {timeframe} quota
            </div>
          </div>

          {/* Hot Prospects */}
          <div className="bg-white rounded-lg shadow-sm p-4 border-l-4 border-orange-500">
            <div className="text-xs font-medium text-slate-600 mb-1">Hot Prospects</div>
            <div className="text-2xl font-bold text-slate-900">
              {metrics ? metrics.hotProspectsCount : '—'}
            </div>
            <div className="text-xs text-slate-500">intent score &gt; 80</div>
          </div>

          {/* Avg Deal Size */}
          <div className="bg-white rounded-lg shadow-sm p-4 border-l-4 border-purple-500">
            <div className="text-xs font-medium text-slate-600 mb-1">Average Deal Size</div>
            <div className="text-2xl font-bold text-slate-900">
              {metrics ? formatCurrency(metrics.avgDealSize) : '—'}
            </div>
            <div className="text-xs text-slate-500">open opportunities</div>
          </div>
        </div>

        {/* Quick Stats Row */}
        <div className="mb-6 px-4 py-3 bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="text-sm text-gray-700">
            📊 Showing <span className="font-semibold">{priorityAccounts.length}</span> priority accounts
            (<span className="text-red-600 font-semibold">{hotCount} 🔥 hot</span>,{' '}
            <span className="text-orange-600 font-semibold">{warmCount} 🔶 warm</span>) •{' '}
            <span className="font-semibold">{atRiskDeals.length}</span> deals need attention
            {criticalDeals > 0 && (
              <>
                {' '}• <span className="text-red-600 font-semibold">{criticalDeals} critical</span>
              </>
            )}
          </div>
        </div>

        {/* Today's Priorities and Pipeline/Forecast - Two Column Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Today's Priorities */}
          <TodaysPrioritiesPanel priorities={priorities} />

          {/* Pipeline & Forecast */}
          <PipelineForecastPanel dateRange="thisQuarter" teamFilter="me" />
        </div>

        {/* Two Column Layout for Priority Actions and At-Risk Deals */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Priority Actions Panel */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <PanelHeader
              title="🎯 Priority Actions"
              subtitle="High-intent accounts to pursue"
              count={priorityAccounts.length}
              badgeColor="bg-blue-100 text-blue-800"
              expanded={expandedPriority}
              onToggle={() => setExpandedPriority(!expandedPriority)}
            />

            {loadingAccounts ? (
              <LoadingSkeleton />
            ) : priorityAccounts.length === 0 ? (
              <EmptyState
                message="No priority accounts"
                submessage="Check back for new prospects"
              />
            ) : (
              <div className={`space-y-3 ${expandedPriority ? 'max-h-[600px]' : 'max-h-[400px]'} overflow-y-auto`}>
                {(expandedPriority ? priorityAccounts : priorityAccounts.slice(0, 5)).map((account) => (
                  <Link
                    key={account.Id}
                    to={`/account/${account.Id}`}
                    className={`block p-4 rounded-lg transition-colors border ${getTierColor(account.priorityTier)}`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-semibold text-slate-900 text-sm">{account.Name}</h3>
                      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getTierBadgeColor(account.priorityTier)}`}>
                        {account.priorityTier}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-slate-600 mb-2">
                      <span>{account.employeeCount?.toLocaleString() || '—'} employees</span>
                      {account.employeeGrowthPct > 0 && (
                        <span className="text-green-600">+{account.employeeGrowthPct}% growth</span>
                      )}
                      <span>Intent: <strong>{account.intentScore || '—'}</strong></span>
                    </div>

                    {account.topSignal && (
                      <div className="text-xs text-slate-700 bg-slate-100 px-2 py-1 rounded mb-2">
                        💡 {account.topSignal}
                      </div>
                    )}

                    {account.aiRecommendation && (
                      <div className="text-xs text-purple-700 bg-purple-50 px-2 py-1 rounded">
                        🤖 {account.aiRecommendation}
                      </div>
                    )}
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* At-Risk Deals Panel */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <PanelHeader
              title="⚠️ At-Risk Deals"
              subtitle="Deals needing immediate attention"
              count={atRiskDeals.length}
              badgeColor="bg-amber-100 text-amber-800"
              expanded={expandedAtRisk}
              onToggle={() => setExpandedAtRisk(!expandedAtRisk)}
            />

            {loadingDeals ? (
              <LoadingSkeleton />
            ) : atRiskDeals.length === 0 ? (
              <EmptyState
                message="No at-risk deals"
                submessage="Your pipeline looks healthy"
              />
            ) : (
              <div className={`space-y-3 ${expandedAtRisk ? 'max-h-[600px]' : 'max-h-[400px]'} overflow-y-auto`}>
                {(expandedAtRisk ? atRiskDeals : atRiskDeals.slice(0, 5)).map((deal) => (
                  <Link
                    key={deal.Id}
                    to={`/opportunity/${deal.Id}`}
                    className="block p-4 bg-amber-50 rounded-lg hover:bg-amber-100 transition-colors border border-amber-200"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h3 className="font-semibold text-slate-900 text-sm">{deal.Account?.Name || 'Unknown Account'}</h3>
                        <p className="text-xs text-slate-600">{deal.Name}</p>
                      </div>
                      <span className="text-lg font-bold text-slate-900">
                        {formatCurrency(deal.Amount || 0)}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-slate-600 mb-2">
                      <span className="px-2 py-0.5 bg-slate-200 rounded">{deal.StageName}</span>
                      <span className={deal.daysStale > 30 ? 'text-red-600 font-medium' : ''}>
                        {deal.daysStale} days stale
                      </span>
                      {deal.meddpiccScore !== undefined && (
                        <span className={deal.meddpiccScore < 50 ? 'text-red-600' : 'text-green-600'}>
                          MEDDPICC: {deal.meddpiccScore}
                        </span>
                      )}
                    </div>

                    {deal.warning && (
                      <div className="text-xs text-amber-700 bg-amber-100 px-2 py-1 rounded mb-2">
                        ⚠️ {deal.warning}
                      </div>
                    )}

                    {deal.aiRecommendation && (
                      <div className="text-xs text-purple-700 bg-purple-50 px-2 py-1 rounded">
                        🤖 {deal.aiRecommendation}
                      </div>
                    )}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
