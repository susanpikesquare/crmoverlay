import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

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
  const [showAllReps, setShowAllReps] = useState(false);

  // Filter states
  const [dateRange, setDateRange] = useState('thisYear'); // thisQuarter, lastQuarter, thisYear, custom
  const [selectedReps, setSelectedReps] = useState<string[]>([]);
  const [minDealSize, setMinDealSize] = useState(0);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    fetchDashboardData();
  }, [dateRange, selectedReps, minDealSize]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      // Build query params
      const params = new URLSearchParams();
      params.append('dateRange', dateRange);
      if (selectedReps.length > 0) {
        params.append('reps', selectedReps.join(','));
      }
      if (minDealSize > 0) {
        params.append('minDealSize', minDealSize.toString());
      }
      params.append('includeAll', 'true'); // Fallback to show all if no team members found

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

  const getQuotaColor = (percentage: number) => {
    if (percentage >= 80) return 'text-green-600 bg-green-50 border-green-200';
    if (percentage >= 50) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    return 'text-red-600 bg-red-50 border-red-200';
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

  const getRowColor = (quotaAttainment: number) => {
    if (quotaAttainment >= 80) return 'bg-green-50';
    if (quotaAttainment >= 50) return 'bg-yellow-50';
    return 'bg-red-50';
  };

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
  const displayedReps = showAllReps ? sortedReps : sortedReps.slice(0, 10);

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

      {/* Filters Panel */}
      {showFilters && (
        <div className="mb-6 bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Date Range Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Date Range</label>
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent"
              >
                <option value="thisQuarter">This Quarter</option>
                <option value="lastQuarter">Last Quarter</option>
                <option value="thisYear">This Year (Default)</option>
                <option value="lastYear">Last Year</option>
                <option value="all">All Time</option>
              </select>
            </div>

            {/* Team Member Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Team Members</label>
              <select
                multiple
                value={selectedReps}
                onChange={(e) => {
                  const selected = Array.from(e.target.selectedOptions, option => option.value);
                  setSelectedReps(selected);
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent"
              >
                <option value="">All Team Members</option>
                {repPerformance.map(rep => (
                  <option key={rep.repId} value={rep.repId}>{rep.repName}</option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">Hold Ctrl/Cmd to select multiple</p>
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
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>$0</span>
                <span>$500K+</span>
              </div>
            </div>
          </div>

          {/* Active Filters & Reset */}
          <div className="mt-4 pt-4 border-t border-gray-200 flex items-center justify-between">
            <div className="flex flex-wrap gap-2">
              {dateRange !== 'thisYear' && (
                <span className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm">
                  {dateRange === 'thisQuarter' ? 'This Quarter' :
                   dateRange === 'lastQuarter' ? 'Last Quarter' :
                   dateRange === 'lastYear' ? 'Last Year' : 'All Time'}
                </span>
              )}
              {selectedReps.length > 0 && (
                <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                  {selectedReps.length} rep{selectedReps.length > 1 ? 's' : ''} selected
                </span>
              )}
              {minDealSize > 0 && (
                <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm">
                  Min: {formatCurrency(minDealSize)}
                </span>
              )}
            </div>
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

      {/* Top Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {/* Team Quota Attainment */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <span className="text-2xl">🎯</span>
            <span className={`text-sm font-medium ${teamMetrics.quotaAttainment.trend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {teamMetrics.quotaAttainment.trend >= 0 ? '↗' : '↘'} {Math.abs(teamMetrics.quotaAttainment.trend)}% vs last month
            </span>
          </div>
          <div className="text-4xl font-bold text-blue-600 mb-1">
            {formatPercentage(teamMetrics.quotaAttainment.percentage)}
          </div>
          <p className="text-sm text-gray-600 mb-2">
            {formatCurrency(teamMetrics.quotaAttainment.current)} of {formatCurrency(teamMetrics.quotaAttainment.target)} team quota
          </p>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${Math.min(teamMetrics.quotaAttainment.percentage, 100)}%` }}
            />
          </div>
        </div>

        {/* Team Pipeline Health */}
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
              View Details
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
              {teamMetrics.avgDealCycle.trend <= 0 ? '↓' : '↑'} {Math.abs(teamMetrics.avgDealCycle.trend)} days vs last quarter
            </span>
          </div>
          <div className="text-4xl font-bold text-purple-600 mb-1">
            {teamMetrics.avgDealCycle.days}
          </div>
          <p className="text-sm text-gray-600">
            Average deal cycle (days)
          </p>
        </div>
      </div>

      {/* Rep Performance Leaderboard */}
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200 mb-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Rep Performance Leaderboard</h2>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as keyof RepPerformance)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent"
          >
            <option value="quotaAttainment">Sort by Quota Attainment</option>
            <option value="pipelineCoverage">Sort by Pipeline Coverage</option>
            <option value="activeDeals">Sort by Active Deals</option>
            <option value="atRiskDeals">Sort by At-Risk Deals</option>
            <option value="avgDealSize">Sort by Avg Deal Size</option>
            <option value="lastActivity">Sort by Last Activity</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Rep Name</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Quota Attainment</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Pipeline Coverage</th>
                <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">Active Deals</th>
                <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">At-Risk</th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Avg Deal Size</th>
                <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">Last Activity</th>
              </tr>
            </thead>
            <tbody>
              {displayedReps.map((rep) => (
                <tr
                  key={rep.repId}
                  className={`border-b border-gray-100 hover:bg-gray-50 cursor-pointer ${getRowColor(rep.quotaAttainment)}`}
                  onClick={() => navigate(`/rep/${rep.repId}`)}
                >
                  <td className="py-4 px-4">
                    <span className="font-medium text-gray-900">{rep.repName}</span>
                  </td>
                  <td className="py-4 px-4">
                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${
                              rep.quotaAttainment >= 80 ? 'bg-green-600' :
                              rep.quotaAttainment >= 50 ? 'bg-yellow-600' : 'bg-red-600'
                            }`}
                            style={{ width: `${Math.min(rep.quotaAttainment, 100)}%` }}
                          />
                        </div>
                      </div>
                      <span className="text-sm font-semibold text-gray-900 min-w-[50px] text-right">
                        {formatPercentage(rep.quotaAttainment)}
                      </span>
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    <span className={`font-semibold ${
                      rep.pipelineCoverage >= 3 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {rep.pipelineCoverage.toFixed(1)}x
                    </span>
                  </td>
                  <td className="py-4 px-4 text-center">
                    <span className="text-gray-900 font-medium">{rep.activeDeals}</span>
                  </td>
                  <td className="py-4 px-4 text-center">
                    {rep.atRiskDeals > 0 ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded-full text-sm font-medium">
                        ⚠️ {rep.atRiskDeals}
                      </span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="py-4 px-4 text-right">
                    <span className="text-gray-900 font-medium">{formatCurrency(rep.avgDealSize)}</span>
                  </td>
                  <td className="py-4 px-4 text-center">
                    <span className={`text-sm ${
                      rep.lastActivity > 7 ? 'text-red-600 font-semibold' : 'text-gray-600'
                    }`}>
                      {rep.lastActivity}d ago
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!showAllReps && repPerformance.length > 10 && (
          <div className="mt-4 text-center">
            <button
              onClick={() => setShowAllReps(true)}
              className="px-6 py-2 text-purple-600 hover:text-purple-700 font-medium hover:bg-purple-50 rounded-lg transition-colors"
            >
              Show All {repPerformance.length} Reps
            </button>
          </div>
        )}
      </div>

      {/* Coaching Opportunities */}
      <div id="coaching-section" className="bg-white rounded-xl shadow-sm p-6 border border-gray-200 mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Coaching Opportunities</h2>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-gray-200">
          {coachingTabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveCoachingTab(tab.id)}
              className={`px-4 py-2 font-medium transition-colors border-b-2 ${
                activeCoachingTab === tab.id
                  ? 'border-purple-600 text-purple-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              {tab.label} ({tab.data.length})
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="space-y-4">
          {activeCoachingData.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No deals in this category. Great work! 🎉</p>
          ) : (
            activeCoachingData.map((deal) => (
              <div key={deal.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 mb-1">{deal.accountName}</h3>
                    <p className="text-sm text-gray-600 mb-2">{deal.opportunityName}</p>
                    <div className="flex gap-4 text-sm text-gray-600">
                      <span>Owner: <strong>{deal.owner}</strong></span>
                      <span>Amount: <strong>{formatCurrency(deal.amount)}</strong></span>
                      <span>Stage: <strong>{deal.stage}</strong></span>
                      <span>Days in stage: <strong className="text-red-600">{deal.daysInStage}</strong></span>
                      {deal.meddpiccScore && (
                        <span>MEDDPICC: <strong className={deal.meddpiccScore < 60 ? 'text-red-600' : 'text-green-600'}>{deal.meddpiccScore}</strong></span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => navigate(`/opportunity/${deal.id}`)}
                      className="px-4 py-2 text-purple-600 hover:bg-purple-50 rounded-lg font-medium transition-colors"
                    >
                      View Details
                    </button>
                    <button className="px-4 py-2 bg-purple-600 text-white hover:bg-purple-700 rounded-lg font-medium transition-colors">
                      Coaching Note
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Recent Wins & Losses */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Wins */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
            Recent Wins 🎉
          </h2>
          <div className="space-y-4">
            {recentWins.length === 0 ? (
              <p className="text-gray-500 text-center py-4">No recent wins yet</p>
            ) : (
              recentWins.map((win) => (
                <div key={win.id} className="border-l-4 border-green-500 bg-green-50 p-4 rounded-r-lg">
                  <h3 className="font-semibold text-gray-900">{win.accountName}</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    {formatCurrency(win.amount)} • {win.owner}
                  </p>
                  <p className="text-sm text-green-600 mt-2">
                    Great work, {win.owner}! Closed in {win.daysInStage} days
                  </p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Losses */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
            Recent Losses 😞
          </h2>
          <div className="space-y-4">
            {recentLosses.length === 0 ? (
              <p className="text-gray-500 text-center py-4">No recent losses</p>
            ) : (
              recentLosses.map((loss) => (
                <div key={loss.id} className="border-l-4 border-red-500 bg-red-50 p-4 rounded-r-lg">
                  <h3 className="font-semibold text-gray-900">{loss.accountName}</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    {formatCurrency(loss.amount)} • {loss.owner}
                  </p>
                  {loss.lossReason && (
                    <p className="text-sm text-red-600 mt-2">
                      Reason: {loss.lossReason} • Learn from this
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
