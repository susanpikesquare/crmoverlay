import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import api from '../services/api';
import PipelineForecastPanel from '../components/PipelineForecastPanel';
import AIAssistant from '../components/AIAssistant';
import TodaysPrioritiesPanel from '../components/TodaysPrioritiesPanel';

interface ExecutiveMetrics {
  totalPipeline: number;
  closedWonYTD: number;
  renewalsAtRisk: number;
  avgHealthScore: number;
  atRiskAccountCount: number;
  expansionPipeline: number;
  upcomingRenewals: number;
}

interface RenewalAccount {
  Id: string;
  Name: string;
  Owner?: { Name: string };
  daysToRenewal: number;
  contractValue: number;
  healthScore: number;
  renewalRisk: 'At Risk' | 'On Track' | 'Expansion Opportunity';
  keySignals: string[];
  aiRecommendation: string;
}

interface AtRiskAccount {
  id: string;
  name: string;
  healthScore: number;
  riskFactors: string[];
  arr?: number;
  daysToRenewal?: number;
  lastContactDate?: string;
  csm?: string;
}

interface CSMMetrics {
  accountsAtRisk: number;
  avgHealthScore: number;
  upcomingRenewals: number;
  adoptionTrend: number;
}

interface RepPerformance {
  repId: string;
  repName: string;
  quotaAttainment: number;
  pipelineCoverage: number;
  activeDeals: number;
  atRiskDeals: number;
  avgDealSize: number;
  lastActivity: number;
}

interface SalesLeaderData {
  teamMetrics: {
    quotaAttainment: { current: number; target: number; percentage: number; trend: number };
    pipelineCoverage: { pipeline: number; remainingQuota: number; ratio: number; status: string };
    atRiskDeals: { count: number; value: number };
    avgDealCycle: { days: number; trend: number };
  };
  repPerformance: RepPerformance[];
}

interface PriorityItem {
  id: string;
  type: 'deal-risk' | 'missing-info' | 'icp-alert' | 'task-due' | 'no-next-step' | 'stage-stuck';
  title: string;
  description: string;
  urgency: 'critical' | 'high' | 'medium';
  relatedAccountId?: string;
  relatedAccountName?: string;
  relatedOpportunityId?: string;
  relatedOpportunityName?: string;
  dueDate?: string;
  actionButton: {
    label: string;
    action: string;
  };
}

interface ExecutiveAtRiskDeal {
  id: string;
  name: string;
  accountName: string;
  ownerName: string;
  amount: number;
  stage: string;
  closeDate: string;
  daysSinceUpdate: number;
  daysUntilClose: number;
  riskFactors: string[];
}

interface HubSectionConfig {
  id: string;
  name: string;
  enabled: boolean;
  order: number;
}

interface CustomLink {
  id: string;
  title: string;
  url: string;
  description?: string;
  icon?: string;
}

export default function ExecutiveHub() {
  const [expandedRenewals, setExpandedRenewals] = useState(false);
  const [expandedAtRisk, setExpandedAtRisk] = useState(false);
  const [expandedReps, setExpandedReps] = useState(false);
  const [expandedDeals, setExpandedDeals] = useState(false);
  const [sortBy, setSortBy] = useState<keyof RepPerformance>('quotaAttainment');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Fetch admin config for hub layout
  const { data: adminConfig } = useQuery({
    queryKey: ['adminConfig'],
    queryFn: async () => {
      const response = await api.get('/api/admin/config');
      return response.data.data;
    },
    staleTime: 5 * 60 * 1000,
  });

  const hubLayout = adminConfig?.hubLayout?.executive;
  const sections: HubSectionConfig[] = hubLayout?.sections
    ? [...hubLayout.sections].sort((a: HubSectionConfig, b: HubSectionConfig) => a.order - b.order)
    : [
        { id: 'metrics', name: 'Executive Summary', enabled: true, order: 1 },
        { id: 'ai-assistant', name: 'AI Assistant', enabled: true, order: 2 },
        { id: 'priorities', name: 'Executive Priorities', enabled: true, order: 3 },
        { id: 'at-risk-deals', name: 'At-Risk Deals', enabled: true, order: 4 },
        { id: 'new-business', name: 'New Business', enabled: true, order: 5 },
        { id: 'renewals', name: 'Renewals & Retention', enabled: true, order: 6 },
        { id: 'customer-health', name: 'Customer Health', enabled: true, order: 7 },
        { id: 'team-performance', name: 'Team Performance', enabled: true, order: 8 },
        { id: 'custom-links', name: 'Quick Links', enabled: true, order: 9 },
      ];
  const customLinks: CustomLink[] = hubLayout?.customLinks || [];

  const isSectionEnabled = (sectionId: string) =>
    sections.find((s) => s.id === sectionId)?.enabled ?? true;

  // Executive metrics
  const { data: metrics, isLoading: loadingMetrics } = useQuery<ExecutiveMetrics>({
    queryKey: ['executive-metrics'],
    queryFn: async () => {
      const response = await api.get('/api/hub/executive/metrics');
      return response.data.data;
    },
  });

  // Priorities
  const { data: priorities } = useQuery<PriorityItem[]>({
    queryKey: ['executive-priorities'],
    queryFn: async () => {
      const response = await api.get('/api/hub/executive/priorities');
      return response.data.data;
    },
    enabled: isSectionEnabled('priorities'),
  });

  // At-risk deals
  const { data: atRiskDeals } = useQuery<ExecutiveAtRiskDeal[]>({
    queryKey: ['executive-at-risk-deals'],
    queryFn: async () => {
      const response = await api.get('/api/hub/executive/at-risk-deals');
      return response.data.data;
    },
    enabled: isSectionEnabled('at-risk-deals'),
  });

  // Renewals
  const { data: renewals, isLoading: loadingRenewals } = useQuery<RenewalAccount[]>({
    queryKey: ['executive-renewals'],
    queryFn: async () => {
      const response = await api.get('/api/hub/executive/renewals');
      return response.data.data;
    },
    enabled: isSectionEnabled('renewals'),
  });

  // Customer health
  const { data: healthData, isLoading: loadingHealth } = useQuery<{
    atRiskAccounts: AtRiskAccount[];
    metrics: CSMMetrics;
  }>({
    queryKey: ['executive-customer-health'],
    queryFn: async () => {
      const response = await api.get('/api/hub/executive/customer-health');
      return response.data.data;
    },
    enabled: isSectionEnabled('customer-health'),
  });

  // Team performance
  const { data: teamData, isLoading: loadingTeam } = useQuery<SalesLeaderData>({
    queryKey: ['executive-team-performance'],
    queryFn: async () => {
      const response = await api.get('/api/dashboard/sales-leader?teamFilter=allUsers&includeAll=true');
      return response.data.data;
    },
    enabled: isSectionEnabled('team-performance'),
  });

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);

  const getHealthColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getHealthBg = (score: number) => {
    if (score >= 80) return 'bg-green-500';
    if (score >= 60) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getRenewalRiskColor = (risk: string) => {
    if (risk === 'At Risk') return 'bg-red-100 text-red-800 border-red-300';
    if (risk === 'Expansion Opportunity') return 'bg-green-100 text-green-800 border-green-300';
    return 'bg-blue-100 text-blue-800 border-blue-300';
  };

  const getQuotaBarColor = (pct: number) => {
    if (pct >= 80) return 'bg-green-500';
    if (pct >= 50) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const sortReps = (reps: RepPerformance[]) => {
    return [...reps].sort((a, b) => {
      const aVal = a[sortBy];
      const bVal = b[sortBy];
      const cmp = aVal > bVal ? 1 : -1;
      return sortOrder === 'desc' ? -cmp : cmp;
    });
  };

  const handleSort = (field: keyof RepPerformance) => {
    if (sortBy === field) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  // ---- Section renderers ----

  const renderMetrics = () => (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {loadingMetrics ? (
        Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl shadow-md p-5 animate-pulse">
            <div className="h-3 bg-gray-200 rounded w-20 mb-3" />
            <div className="h-7 bg-gray-200 rounded w-16" />
          </div>
        ))
      ) : (
        <>
          <div className="bg-white rounded-xl shadow-md p-5">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Pipeline</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">
              {formatCurrency(metrics?.totalPipeline || 0)}
            </p>
          </div>
          <div className="bg-white rounded-xl shadow-md p-5">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Closed Won YTD</p>
            <p className="text-2xl font-bold text-green-600 mt-1">
              {formatCurrency(metrics?.closedWonYTD || 0)}
            </p>
          </div>
          <div className="bg-white rounded-xl shadow-md p-5">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Renewals at Risk</p>
            <p className="text-2xl font-bold text-red-600 mt-1">{metrics?.renewalsAtRisk || 0}</p>
            <p className="text-xs text-gray-500 mt-0.5">Next 180 days</p>
          </div>
          <div className="bg-white rounded-xl shadow-md p-5">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Avg Health Score</p>
            <p className={`text-2xl font-bold mt-1 ${getHealthColor(metrics?.avgHealthScore || 0)}`}>
              {metrics?.avgHealthScore || 0}
            </p>
          </div>
          <div className="bg-white rounded-xl shadow-md p-5">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">At-Risk Accounts</p>
            <p className="text-2xl font-bold text-red-600 mt-1">{metrics?.atRiskAccountCount || 0}</p>
          </div>
          <div className="bg-white rounded-xl shadow-md p-5">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Expansion Pipeline</p>
            <p className="text-2xl font-bold text-purple-600 mt-1">
              {formatCurrency(metrics?.expansionPipeline || 0)}
            </p>
          </div>
        </>
      )}
    </div>
  );

  const renderPriorities = () => (
    <TodaysPrioritiesPanel priorities={priorities || []} />
  );

  const renderAtRiskDeals = () => {
    const deals = atRiskDeals || [];
    const displayLimit = expandedDeals ? deals.length : 8;

    return (
      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">
            At-Risk Deals ({deals.length})
          </h3>
          {deals.length > 8 && (
            <button
              onClick={() => setExpandedDeals(!expandedDeals)}
              className="text-sm text-purple-600 hover:text-purple-800 font-medium"
            >
              {expandedDeals ? 'Show Less' : 'Show All'}
            </button>
          )}
        </div>
        {deals.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No at-risk deals found</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {deals.slice(0, displayLimit).map(deal => (
              <Link
                key={deal.id}
                to={`/opportunity/${deal.id}`}
                className="block px-6 py-4 hover:bg-gray-50 transition"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900">{deal.name}</p>
                    <div className="flex items-center gap-4 text-sm text-gray-600 mt-1">
                      <span>{deal.accountName}</span>
                      <span>Owner: {deal.ownerName}</span>
                      <span>{deal.stage}</span>
                    </div>
                    <div className="flex gap-2 mt-2">
                      {deal.riskFactors.map((factor, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 text-xs bg-red-50 text-red-700 rounded border border-red-200"
                        >
                          {factor}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="text-right ml-4">
                    <p className="text-lg font-bold text-gray-900">{formatCurrency(deal.amount)}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {deal.daysUntilClose > 0
                        ? `Closes in ${deal.daysUntilClose}d`
                        : `${Math.abs(deal.daysUntilClose)}d overdue`}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderNewBusiness = () => (
    <PipelineForecastPanel dateRange="thisYear" teamFilter="allUsers" />
  );

  const renderRenewals = () => {
    if (loadingRenewals) {
      return (
        <div className="bg-white rounded-xl shadow-md p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-3" />
          <p className="text-gray-500">Loading renewals...</p>
        </div>
      );
    }

    const renewalList = renewals || [];
    const atRisk = renewalList.filter(r => r.renewalRisk === 'At Risk');
    const onTrack = renewalList.filter(r => r.renewalRisk === 'On Track');
    const expansion = renewalList.filter(r => r.renewalRisk === 'Expansion Opportunity');
    const displayLimit = expandedRenewals ? renewalList.length : 8;

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl shadow-md p-5 border-l-4 border-red-500">
            <p className="text-sm text-gray-600">At Risk</p>
            <p className="text-2xl font-bold text-red-600">{atRisk.length}</p>
            <p className="text-xs text-gray-500 mt-1">
              {formatCurrency(atRisk.reduce((sum, r) => sum + r.contractValue, 0))} ARR
            </p>
          </div>
          <div className="bg-white rounded-xl shadow-md p-5 border-l-4 border-blue-500">
            <p className="text-sm text-gray-600">On Track</p>
            <p className="text-2xl font-bold text-blue-600">{onTrack.length}</p>
            <p className="text-xs text-gray-500 mt-1">
              {formatCurrency(onTrack.reduce((sum, r) => sum + r.contractValue, 0))} ARR
            </p>
          </div>
          <div className="bg-white rounded-xl shadow-md p-5 border-l-4 border-green-500">
            <p className="text-sm text-gray-600">Expansion Opportunity</p>
            <p className="text-2xl font-bold text-green-600">{expansion.length}</p>
            <p className="text-xs text-gray-500 mt-1">
              {formatCurrency(expansion.reduce((sum, r) => sum + r.contractValue, 0))} ARR
            </p>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">
              Upcoming Renewals ({renewalList.length})
            </h3>
            {renewalList.length > 8 && (
              <button
                onClick={() => setExpandedRenewals(!expandedRenewals)}
                className="text-sm text-purple-600 hover:text-purple-800 font-medium"
              >
                {expandedRenewals ? 'Show Less' : 'Show All'}
              </button>
            )}
          </div>
          {renewalList.length === 0 ? (
            <div className="p-8 text-center text-gray-500">No upcoming renewals</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {renewalList.slice(0, displayLimit).map(account => (
                <Link
                  key={account.Id}
                  to={`/account/${account.Id}`}
                  className="block px-6 py-4 hover:bg-gray-50 transition"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <p className="font-semibold text-gray-900">{account.Name}</p>
                        <span
                          className={`px-2 py-0.5 text-xs font-medium rounded-full border ${getRenewalRiskColor(
                            account.renewalRisk
                          )}`}
                        >
                          {account.renewalRisk}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        {account.Owner?.Name && <span>Owner: {account.Owner.Name}</span>}
                        <span>{formatCurrency(account.contractValue)} ARR</span>
                        <span>{account.daysToRenewal} days to renewal</span>
                      </div>
                      {account.keySignals.length > 0 && (
                        <div className="flex gap-2 mt-2">
                          {account.keySignals.slice(0, 3).map((signal, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-0.5 text-xs bg-gray-100 text-gray-700 rounded"
                            >
                              {signal}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="text-right ml-4">
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-semibold ${getHealthColor(account.healthScore)}`}>
                          {account.healthScore}
                        </span>
                        <div className="w-16 bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${getHealthBg(account.healthScore)}`}
                            style={{ width: `${Math.min(account.healthScore, 100)}%` }}
                          />
                        </div>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">Health Score</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderCustomerHealth = () => {
    if (loadingHealth) {
      return (
        <div className="bg-white rounded-xl shadow-md p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-3" />
          <p className="text-gray-500">Loading customer health data...</p>
        </div>
      );
    }

    const atRiskAccounts = healthData?.atRiskAccounts || [];
    const healthMetrics = healthData?.metrics;
    const displayLimit = expandedAtRisk ? atRiskAccounts.length : 8;

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl shadow-md p-5">
            <p className="text-sm text-gray-600">Avg Health Score</p>
            <p className={`text-3xl font-bold ${getHealthColor(healthMetrics?.avgHealthScore || 0)}`}>
              {healthMetrics?.avgHealthScore || 0}
            </p>
          </div>
          <div className="bg-white rounded-xl shadow-md p-5">
            <p className="text-sm text-gray-600">At-Risk Accounts</p>
            <p className="text-3xl font-bold text-red-600">{healthMetrics?.accountsAtRisk || 0}</p>
          </div>
          <div className="bg-white rounded-xl shadow-md p-5">
            <p className="text-sm text-gray-600">Upcoming Renewals</p>
            <p className="text-3xl font-bold text-blue-600">{healthMetrics?.upcomingRenewals || 0}</p>
            <p className="text-xs text-gray-500 mt-1">Next 90 days</p>
          </div>
          <div className="bg-white rounded-xl shadow-md p-5">
            <p className="text-sm text-gray-600">Adoption Trend</p>
            <p className="text-3xl font-bold text-gray-700">
              {healthMetrics?.adoptionTrend || 0}%
            </p>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">
              At-Risk Accounts ({atRiskAccounts.length})
            </h3>
            {atRiskAccounts.length > 8 && (
              <button
                onClick={() => setExpandedAtRisk(!expandedAtRisk)}
                className="text-sm text-purple-600 hover:text-purple-800 font-medium"
              >
                {expandedAtRisk ? 'Show Less' : 'Show All'}
              </button>
            )}
          </div>
          {atRiskAccounts.length === 0 ? (
            <div className="p-8 text-center text-gray-500">No at-risk accounts found</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {atRiskAccounts.slice(0, displayLimit).map(account => (
                <Link
                  key={account.id}
                  to={`/account/${account.id}`}
                  className="block px-6 py-4 hover:bg-gray-50 transition"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900">{account.name}</p>
                      <div className="flex items-center gap-4 text-sm text-gray-600 mt-1">
                        {account.csm && <span>CSM: {account.csm}</span>}
                        {account.arr && <span>{formatCurrency(account.arr)} ARR</span>}
                        {account.daysToRenewal !== undefined && (
                          <span>{account.daysToRenewal} days to renewal</span>
                        )}
                      </div>
                      <div className="flex gap-2 mt-2">
                        {account.riskFactors.map((factor, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-0.5 text-xs bg-red-50 text-red-700 rounded border border-red-200"
                          >
                            {factor}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="text-right ml-4">
                      <div className="flex items-center gap-2">
                        <span className={`text-lg font-bold ${getHealthColor(account.healthScore)}`}>
                          {account.healthScore}
                        </span>
                      </div>
                      <div className="w-20 bg-gray-200 rounded-full h-2 mt-1">
                        <div
                          className={`h-2 rounded-full ${getHealthBg(account.healthScore)}`}
                          style={{ width: `${Math.min(account.healthScore, 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderTeamPerformance = () => {
    if (loadingTeam) {
      return (
        <div className="bg-white rounded-xl shadow-md p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-3" />
          <p className="text-gray-500">Loading team performance...</p>
        </div>
      );
    }

    const reps = teamData?.repPerformance || [];
    const tm = teamData?.teamMetrics;

    return (
      <div className="space-y-6">
        {tm && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl shadow-md p-5">
              <p className="text-sm text-gray-600">Team Quota Attainment</p>
              <p className="text-3xl font-bold text-gray-900">{Math.round(tm.quotaAttainment.percentage)}%</p>
              <p className="text-xs text-gray-500 mt-1">
                {formatCurrency(tm.quotaAttainment.current)} / {formatCurrency(tm.quotaAttainment.target)}
              </p>
            </div>
            <div className="bg-white rounded-xl shadow-md p-5">
              <p className="text-sm text-gray-600">Pipeline Coverage</p>
              <p className="text-3xl font-bold text-gray-900">{tm.pipelineCoverage.ratio.toFixed(1)}x</p>
              <p className="text-xs text-gray-500 mt-1">{formatCurrency(tm.pipelineCoverage.pipeline)} pipeline</p>
            </div>
            <div className="bg-white rounded-xl shadow-md p-5">
              <p className="text-sm text-gray-600">At-Risk Deals</p>
              <p className="text-3xl font-bold text-red-600">{tm.atRiskDeals.count}</p>
              <p className="text-xs text-gray-500 mt-1">{formatCurrency(tm.atRiskDeals.value)} value</p>
            </div>
            <div className="bg-white rounded-xl shadow-md p-5">
              <p className="text-sm text-gray-600">Avg Deal Cycle</p>
              <p className="text-3xl font-bold text-gray-900">{tm.avgDealCycle.days} days</p>
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-md overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Rep Performance ({reps.length})</h3>
            {reps.length > 10 && (
              <button
                onClick={() => setExpandedReps(!expandedReps)}
                className="text-sm text-purple-600 hover:text-purple-800 font-medium"
              >
                {expandedReps ? 'Show Less' : 'Show All'}
              </button>
            )}
          </div>
          {reps.length === 0 ? (
            <div className="p-8 text-center text-gray-500">No team performance data available</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 text-xs text-gray-600 uppercase">
                    {[
                      { key: 'repName', label: 'Rep' },
                      { key: 'quotaAttainment', label: 'Quota %' },
                      { key: 'pipelineCoverage', label: 'Pipeline Coverage' },
                      { key: 'activeDeals', label: 'Active Deals' },
                      { key: 'atRiskDeals', label: 'At Risk' },
                      { key: 'avgDealSize', label: 'Avg Deal Size' },
                    ].map(col => (
                      <th
                        key={col.key}
                        className="px-4 py-3 text-left cursor-pointer hover:text-gray-900"
                        onClick={() => handleSort(col.key as keyof RepPerformance)}
                      >
                        <div className="flex items-center gap-1">
                          {col.label}
                          {sortBy === col.key && (
                            <span>{sortOrder === 'desc' ? '\u2193' : '\u2191'}</span>
                          )}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {sortReps(reps)
                    .slice(0, expandedReps ? reps.length : 10)
                    .map(rep => (
                      <tr key={rep.repId} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-900">{rep.repName}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-20 bg-gray-200 rounded-full h-2">
                              <div
                                className={`h-2 rounded-full ${getQuotaBarColor(rep.quotaAttainment)}`}
                                style={{ width: `${Math.min(rep.quotaAttainment, 100)}%` }}
                              />
                            </div>
                            <span className="text-sm font-medium">{Math.round(rep.quotaAttainment)}%</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm">{rep.pipelineCoverage.toFixed(1)}x</td>
                        <td className="px-4 py-3 text-sm">{rep.activeDeals}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`text-sm font-medium ${
                              rep.atRiskDeals > 0 ? 'text-red-600' : 'text-green-600'
                            }`}
                          >
                            {rep.atRiskDeals}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm">{formatCurrency(rep.avgDealSize)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderCustomLinks = () => {
    if (customLinks.length === 0) return null;

    return (
      <div className="bg-white rounded-xl shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Links</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {customLinks.map(link => (
            <a
              key={link.id}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition"
            >
              <span className="text-2xl">{link.icon || '🔗'}</span>
              <div>
                <p className="font-medium text-gray-900">{link.title}</p>
                {link.description && (
                  <p className="text-sm text-gray-500 mt-0.5">{link.description}</p>
                )}
              </div>
            </a>
          ))}
        </div>
      </div>
    );
  };

  // ---- Section dispatch ----
  const renderSection = (sectionId: string) => {
    switch (sectionId) {
      case 'metrics':
        return renderMetrics();
      case 'ai-assistant':
        return <AIAssistant />;
      case 'priorities':
        return renderPriorities();
      case 'at-risk-deals':
        return renderAtRiskDeals();
      case 'new-business':
        return renderNewBusiness();
      case 'renewals':
        return renderRenewals();
      case 'customer-health':
        return renderCustomerHealth();
      case 'team-performance':
        return renderTeamPerformance();
      case 'custom-links':
        return renderCustomLinks();
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Executive Dashboard</h1>
          <p className="text-gray-600 mt-1">Organization-wide performance overview</p>
        </div>

        {/* Scrollable dashboard — sections rendered in configured order */}
        <div className="space-y-6">
          {sections
            .filter(s => s.enabled)
            .map(section => (
              <div key={section.id}>{renderSection(section.id)}</div>
            ))}
        </div>
      </div>
    </div>
  );
}
