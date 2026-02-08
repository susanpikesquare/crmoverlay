import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '../services/api';
import TodaysPrioritiesPanel from '../components/TodaysPrioritiesPanel';
import PipelineForecastPanel from '../components/PipelineForecastPanel';
import AIAssistant from '../components/AIAssistant';

interface TeamMetrics {
  quotaAttainment: {
    current: number;
    target: number;
    percentage: number;
    trend: number;
  };
  pipelineCoverage: {
    pipeline: number;
    remainingQuota: number;
    ratio: number;
    status: string;
  };
  atRiskDeals: {
    count: number;
    value: number;
  };
  avgDealCycle: {
    days: number;
    trend: number;
  };
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

interface Deal {
  id: string;
  accountName: string;
  opportunityName: string;
  owner: string;
  amount: number;
  stage: string;
  daysInStage: number;
  meddpiccScore?: number;
  lossReason?: string;
}

interface SalesLeaderData {
  teamMetrics: TeamMetrics;
  repPerformance: RepPerformance[];
  coachingOpportunities: {
    stuckDeals: Deal[];
    lowMEDDPICC: Deal[];
    coldAccounts: Deal[];
    largeDeals: Deal[];
  };
  pipelineByStage: any[];
  recentWins: Deal[];
  recentLosses: Deal[];
}

export default function SalesLeaderDashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState<SalesLeaderData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeCoachingTab, setActiveCoachingTab] = useState('stuck');
  const [sortBy, setSortBy] = useState<keyof RepPerformance>('quotaAttainment');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Expand states for scrollable panels
  const [expandedReps, setExpandedReps] = useState(false);
  const [expandedCoaching, setExpandedCoaching] = useState(false);
  const [expandedWins, setExpandedWins] = useState(false);
  const [expandedLosses, setExpandedLosses] = useState(false);

  // Filter states
  const [dateRange, setDateRange] = useState('thisYear');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [teamFilter, setTeamFilter] = useState('myTeam');
  const [selectedReps, setSelectedReps] = useState<string[]>([]);
  const [minDealSize, setMinDealSize] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const [availableUsers, setAvailableUsers] = useState<{id: string, name: string}[]>([]);

  // Fetch team priorities
  const { data: prioritiesData } = useQuery<{
    success: boolean;
    data: any[];
  }>({
    queryKey: ['sales-leader-priorities'],
    queryFn: async () => {
      const response = await api.get('/api/hub/sales-leader/priorities');
      return response.data;
    },
  });

  // Fetch team pipeline forecast (responds to filters)
  const { data: forecastData } = useQuery<{
    success: boolean;
    data: any;
  }>({
    queryKey: ['sales-leader-pipeline-forecast', dateRange, customStartDate, customEndDate, teamFilter, minDealSize],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (dateRange === 'custom') {
        params.append('dateRange', 'custom');
        if (customStartDate) params.append('startDate', customStartDate);
        if (customEndDate) params.append('endDate', customEndDate);
      } else {
        params.append('dateRange', dateRange);
      }
      params.append('teamFilter', teamFilter);
      if (minDealSize > 0) {
        params.append('minDealSize', minDealSize.toString());
      }
      const response = await api.get(`/api/hub/sales-leader/pipeline-forecast?${params.toString()}`);
      return response.data;
    },
  });

  const priorities = prioritiesData?.data || [];
  const forecast = forecastData?.data;

  useEffect(() => {
    fetchAvailableUsers();
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [dateRange, customStartDate, customEndDate, teamFilter, selectedReps, minDealSize]);

  const fetchAvailableUsers = async () => {
    try {
      const response = await api.get('/api/users');
      if (response.data.success) {
        setAvailableUsers(response.data.data);
      }
    } catch (err) {
      console.error('Error fetching users:', err);
    }
  };

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();

      if (dateRange === 'custom') {
        if (customStartDate) params.append('startDate', customStartDate);
        if (customEndDate) params.append('endDate', customEndDate);
      } else {
        params.append('dateRange', dateRange);
      }

      params.append('teamFilter', teamFilter);
      if (selectedReps.length > 0) {
        params.append('reps', selectedReps.join(','));
      }

      if (minDealSize > 0) {
        params.append('minDealSize', minDealSize.toString());
      }

      params.append('includeAll', 'true');

      const response = await api.get(`/api/dashboard/sales-leader?${params.toString()}`);
      setData(response.data.data);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load dashboard data');
      console.error('Error fetching sales leader dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatPercentage = (value: number) => {
    return `${Math.round(value)}%`;
  };

  const getAtRiskColor = (count: number) => {
    if (count > 5) return 'text-red-600 bg-red-50 border-red-300';
    if (count >= 3) return 'text-yellow-600 bg-yellow-50 border-yellow-300';
    return 'text-green-600 bg-green-50 border-green-300';
  };

  const sortReps = (reps: RepPerformance[]) => {
    return [...reps].sort((a, b) => {
      const aValue = a[sortBy];
      const bValue = b[sortBy];
      const comparison = aValue > bValue ? 1 : -1;
      return sortOrder === 'desc' ? -comparison : comparison;
    });
  };

  const getQuotaColor = (quotaAttainment: number) => {
    if (quotaAttainment >= 80) return 'bg-green-50 border-green-200';
    if (quotaAttainment >= 50) return 'bg-yellow-50 border-yellow-200';
    return 'bg-red-50 border-red-200';
  };

  const getQuotaBarColor = (quotaAttainment: number) => {
    if (quotaAttainment >= 80) return 'bg-green-500';
    if (quotaAttainment >= 50) return 'bg-yellow-500';
    return 'bg-red-500';
  };

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
        <h2 className="text-lg font-bold text-gray-900">{title}</h2>
        <p className="text-sm text-gray-500">{subtitle}</p>
      </div>
      <div className="flex items-center gap-3">
        <span className={`px-3 py-1 ${badgeColor} text-sm font-medium rounded-full`}>
          {count} items
        </span>
        {count > 5 && (
          <button
            onClick={onToggle}
            className="text-sm text-purple-600 hover:text-purple-800 font-medium flex items-center gap-1"
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading Sales Leadership Dashboard...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error || 'Failed to load dashboard'}</p>
          <button
            onClick={fetchDashboardData}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const { teamMetrics, repPerformance, coachingOpportunities, recentWins, recentLosses } = data;
  const sortedReps = sortReps(repPerformance);

  const coachingTabs = [
    { id: 'stuck', label: '🔴 Stuck Deals', data: coachingOpportunities.stuckDeals },
    { id: 'lowMEDDPICC', label: '📉 Low MEDDPICC', data: coachingOpportunities.lowMEDDPICC },
    { id: 'cold', label: '❄️ Cold Accounts', data: coachingOpportunities.coldAccounts },
    { id: 'large', label: '💰 Large Deals', data: coachingOpportunities.largeDeals },
  ];

  const activeCoachingData = coachingTabs.find(tab => tab.id === activeCoachingTab)?.data || [];

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Sales Leadership Command Center</h1>
          <p className="text-gray-600">Team performance and risk overview</p>
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
          </svg>
          Filters
        </button>
      </div>

      {/* AI Assistant */}
      <div className="mb-6">
        <AIAssistant userRole="Sales Leader" />
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="mb-6 bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Date Range Filter */}
            <div className="lg:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Date Range</label>
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent"
              >
                <optgroup label="Standard">
                  <option value="today">Today</option>
                  <option value="yesterday">Yesterday</option>
                  <option value="thisWeek">This Week</option>
                  <option value="lastWeek">Last Week</option>
                  <option value="thisMonth">This Month</option>
                  <option value="lastMonth">Last Month</option>
                </optgroup>
                <optgroup label="Quarters">
                  <option value="thisQuarter">This Quarter</option>
                  <option value="lastQuarter">Last Quarter</option>
                  <option value="nextQuarter">Next Quarter</option>
                </optgroup>
                <optgroup label="Fiscal">
                  <option value="thisFiscalQuarter">This Fiscal Quarter</option>
                  <option value="lastFiscalQuarter">Last Fiscal Quarter</option>
                  <option value="thisFiscalYear">This Fiscal Year</option>
                  <option value="lastFiscalYear">Last Fiscal Year</option>
                </optgroup>
                <optgroup label="Years">
                  <option value="thisYear">This Year (Default)</option>
                  <option value="lastYear">Last Year</option>
                  <option value="nextYear">Next Year</option>
                </optgroup>
                <optgroup label="Other">
                  <option value="last7Days">Last 7 Days</option>
                  <option value="last30Days">Last 30 Days</option>
                  <option value="last90Days">Last 90 Days</option>
                  <option value="last120Days">Last 120 Days</option>
                  <option value="all">All Time</option>
                  <option value="custom">Custom Range...</option>
                </optgroup>
              </select>

              {dateRange === 'custom' && (
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Start Date</label>
                    <input
                      type="date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">End Date</label>
                    <input
                      type="date"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Team Scope Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Team Scope</label>
              <select
                value={teamFilter}
                onChange={(e) => setTeamFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="myTeam">My Team</option>
                <option value="allUsers">All Users</option>
                {availableUsers.map(user => (
                  <option key={user.id} value={user.id}>{user.name} & Their Team</option>
                ))}
              </select>
            </div>

            {/* Min Deal Size Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Min Deal Size: {formatCurrency(minDealSize)}
              </label>
              <input
                type="range"
                min="0"
                max="500000"
                step="10000"
                value={minDealSize}
                onChange={(e) => setMinDealSize(Number(e.target.value))}
                className="w-full"
              />
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-gray-200 flex justify-end">
            <button
              onClick={() => {
                setDateRange('thisYear');
                setSelectedReps([]);
                setMinDealSize(0);
              }}
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              Reset Filters
            </button>
          </div>
        </div>
      )}

      {/* Today's Priorities and Pipeline/Forecast */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <TodaysPrioritiesPanel priorities={priorities} />
        {forecast && <PipelineForecastPanel forecast={forecast} />}
      </div>

      {/* Top Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {/* Team Quota Attainment */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <span className="text-2xl">🎯</span>
            <span className={`text-sm font-medium ${teamMetrics.quotaAttainment.trend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {teamMetrics.quotaAttainment.trend >= 0 ? '↗' : '↘'} {Math.abs(teamMetrics.quotaAttainment.trend)}%
            </span>
          </div>
          <div className="text-4xl font-bold text-blue-600 mb-1">
            {formatPercentage(teamMetrics.quotaAttainment.percentage)}
          </div>
          <p className="text-sm text-gray-600 mb-2">
            {formatCurrency(teamMetrics.quotaAttainment.current)} of {formatCurrency(teamMetrics.quotaAttainment.target)}
          </p>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full"
              style={{ width: `${Math.min(teamMetrics.quotaAttainment.percentage, 100)}%` }}
            />
          </div>
        </div>

        {/* Pipeline Health */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <span className="text-2xl">📊</span>
            <span className={`text-sm font-medium px-2 py-1 rounded ${
              teamMetrics.pipelineCoverage.status === 'Healthy' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
            }`}>
              {teamMetrics.pipelineCoverage.status}
            </span>
          </div>
          <div className="text-4xl font-bold text-green-600 mb-1">
            {teamMetrics.pipelineCoverage.ratio.toFixed(1)}x
          </div>
          <p className="text-sm text-gray-600">
            {formatCurrency(teamMetrics.pipelineCoverage.pipeline)} in pipeline
          </p>
        </div>

        {/* At-Risk Deals */}
        <div className={`bg-white rounded-xl shadow-sm p-6 border-2 ${getAtRiskColor(teamMetrics.atRiskDeals.count)}`}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-2xl">⚠️</span>
            <button
              onClick={() => {
                setActiveCoachingTab('stuck');
                document.getElementById('coaching-section')?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="text-sm font-medium hover:underline"
            >
              View
            </button>
          </div>
          <div className="text-4xl font-bold mb-1">
            {teamMetrics.atRiskDeals.count}
          </div>
          <p className="text-sm text-gray-600">
            {formatCurrency(teamMetrics.atRiskDeals.value)} at risk
          </p>
        </div>

        {/* Team Velocity */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <span className="text-2xl">⚡</span>
            <span className={`text-sm font-medium ${teamMetrics.avgDealCycle.trend <= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {teamMetrics.avgDealCycle.trend <= 0 ? '↓' : '↑'} {Math.abs(teamMetrics.avgDealCycle.trend)}d
            </span>
          </div>
          <div className="text-4xl font-bold text-purple-600 mb-1">
            {teamMetrics.avgDealCycle.days}
          </div>
          <p className="text-sm text-gray-600">
            Avg deal cycle (days)
          </p>
        </div>
      </div>

      {/* Rep Performance Leaderboard - Scrollable Cards */}
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200 mb-8">
        <div className="flex justify-between items-center mb-4">
          <PanelHeader
            title="Rep Performance Leaderboard"
            subtitle="Track team member performance"
            count={repPerformance.length}
            badgeColor="bg-purple-100 text-purple-800"
            expanded={expandedReps}
            onToggle={() => setExpandedReps(!expandedReps)}
          />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as keyof RepPerformance)}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg"
          >
            <option value="quotaAttainment">Quota %</option>
            <option value="pipelineCoverage">Pipeline</option>
            <option value="atRiskDeals">At-Risk</option>
            <option value="avgDealSize">Deal Size</option>
          </select>
        </div>

        <div className={`space-y-3 ${expandedReps ? 'max-h-[600px]' : 'max-h-[400px]'} overflow-y-auto`}>
          {(expandedReps ? sortedReps : sortedReps.slice(0, 5)).map((rep) => (
            <Link
              key={rep.repId}
              to={`/rep/${rep.repId}`}
              className={`block p-4 rounded-lg border transition-colors hover:shadow-md ${getQuotaColor(rep.quotaAttainment)}`}
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-gray-900">{rep.repName}</h3>
                <span className={`text-lg font-bold ${
                  rep.quotaAttainment >= 80 ? 'text-green-600' :
                  rep.quotaAttainment >= 50 ? 'text-yellow-600' : 'text-red-600'
                }`}>
                  {formatPercentage(rep.quotaAttainment)}
                </span>
              </div>

              {/* Quota Progress Bar */}
              <div className="w-full bg-gray-200 rounded-full h-2 mb-3">
                <div
                  className={`h-2 rounded-full ${getQuotaBarColor(rep.quotaAttainment)}`}
                  style={{ width: `${Math.min(rep.quotaAttainment, 100)}%` }}
                />
              </div>

              <div className="grid grid-cols-4 gap-2 text-xs">
                <div>
                  <span className="text-gray-500">Pipeline</span>
                  <p className={`font-semibold ${rep.pipelineCoverage >= 3 ? 'text-green-600' : 'text-red-600'}`}>
                    {rep.pipelineCoverage.toFixed(1)}x
                  </p>
                </div>
                <div>
                  <span className="text-gray-500">Active</span>
                  <p className="font-semibold text-gray-900">{rep.activeDeals}</p>
                </div>
                <div>
                  <span className="text-gray-500">At-Risk</span>
                  <p className={`font-semibold ${rep.atRiskDeals > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                    {rep.atRiskDeals || '—'}
                  </p>
                </div>
                <div>
                  <span className="text-gray-500">Avg Size</span>
                  <p className="font-semibold text-gray-900">{formatCurrency(rep.avgDealSize)}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Coaching Opportunities - Scrollable Cards */}
      <div id="coaching-section" className="bg-white rounded-xl shadow-sm p-6 border border-gray-200 mb-8">
        <PanelHeader
          title="Coaching Opportunities"
          subtitle="Deals requiring manager attention"
          count={activeCoachingData.length}
          badgeColor="bg-amber-100 text-amber-800"
          expanded={expandedCoaching}
          onToggle={() => setExpandedCoaching(!expandedCoaching)}
        />

        {/* Tabs */}
        <div className="flex gap-2 mb-4 border-b border-gray-200 overflow-x-auto">
          {coachingTabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveCoachingTab(tab.id)}
              className={`px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors border-b-2 ${
                activeCoachingTab === tab.id
                  ? 'border-purple-600 text-purple-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              {tab.label} ({tab.data.length})
            </button>
          ))}
        </div>

        {/* Tab Content - Scrollable */}
        <div className={`space-y-3 ${expandedCoaching ? 'max-h-[600px]' : 'max-h-[400px]'} overflow-y-auto`}>
          {activeCoachingData.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No deals in this category. Great work! 🎉</p>
          ) : (
            (expandedCoaching ? activeCoachingData : activeCoachingData.slice(0, 5)).map((deal) => (
              <Link
                key={deal.id}
                to={`/opportunity/${deal.id}`}
                className="block p-4 border border-gray-200 rounded-lg hover:shadow-md transition-shadow bg-amber-50"
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="font-semibold text-gray-900">{deal.accountName}</h3>
                    <p className="text-sm text-gray-600">{deal.opportunityName}</p>
                  </div>
                  <span className="text-lg font-bold text-gray-900">{formatCurrency(deal.amount)}</span>
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="px-2 py-1 bg-gray-200 rounded">Owner: {deal.owner}</span>
                  <span className="px-2 py-1 bg-gray-200 rounded">{deal.stage}</span>
                  <span className={`px-2 py-1 rounded ${deal.daysInStage > 30 ? 'bg-red-100 text-red-700' : 'bg-gray-200'}`}>
                    {deal.daysInStage}d in stage
                  </span>
                  {deal.meddpiccScore !== undefined && (
                    <span className={`px-2 py-1 rounded ${deal.meddpiccScore < 60 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                      MEDDPICC: {deal.meddpiccScore}
                    </span>
                  )}
                </div>
              </Link>
            ))
          )}
        </div>
      </div>

      {/* Recent Wins & Losses - Two Scrollable Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Wins */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <PanelHeader
            title="Recent Wins 🎉"
            subtitle="Celebrate team success"
            count={recentWins.length}
            badgeColor="bg-green-100 text-green-800"
            expanded={expandedWins}
            onToggle={() => setExpandedWins(!expandedWins)}
          />

          <div className={`space-y-3 ${expandedWins ? 'max-h-[400px]' : 'max-h-[280px]'} overflow-y-auto`}>
            {recentWins.length === 0 ? (
              <p className="text-gray-500 text-center py-4">No recent wins yet</p>
            ) : (
              (expandedWins ? recentWins : recentWins.slice(0, 4)).map((win) => (
                <Link
                  key={win.id}
                  to={`/opportunity/${win.id}`}
                  className="block p-3 border-l-4 border-green-500 bg-green-50 rounded-r-lg hover:bg-green-100 transition-colors"
                >
                  <h3 className="font-semibold text-gray-900 text-sm">{win.accountName}</h3>
                  <p className="text-xs text-gray-600 mt-1">
                    {formatCurrency(win.amount)} • {win.owner}
                  </p>
                  <p className="text-xs text-green-600 mt-1">
                    Closed in {win.daysInStage} days
                  </p>
                </Link>
              ))
            )}
          </div>
        </div>

        {/* Recent Losses */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <PanelHeader
            title="Recent Losses 📉"
            subtitle="Learn and improve"
            count={recentLosses.length}
            badgeColor="bg-red-100 text-red-800"
            expanded={expandedLosses}
            onToggle={() => setExpandedLosses(!expandedLosses)}
          />

          <div className={`space-y-3 ${expandedLosses ? 'max-h-[400px]' : 'max-h-[280px]'} overflow-y-auto`}>
            {recentLosses.length === 0 ? (
              <p className="text-gray-500 text-center py-4">No recent losses</p>
            ) : (
              (expandedLosses ? recentLosses : recentLosses.slice(0, 4)).map((loss) => (
                <Link
                  key={loss.id}
                  to={`/opportunity/${loss.id}`}
                  className="block p-3 border-l-4 border-red-500 bg-red-50 rounded-r-lg hover:bg-red-100 transition-colors"
                >
                  <h3 className="font-semibold text-gray-900 text-sm">{loss.accountName}</h3>
                  <p className="text-xs text-gray-600 mt-1">
                    {formatCurrency(loss.amount)} • {loss.owner}
                  </p>
                  {loss.lossReason && (
                    <p className="text-xs text-red-600 mt-1">
                      Reason: {loss.lossReason}
                    </p>
                  )}
                </Link>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
