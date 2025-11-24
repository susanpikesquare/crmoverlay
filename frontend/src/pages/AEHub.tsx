import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import PriorityActionsTable from '../components/PriorityActionsTable';
import AtRiskDealsTable from '../components/AtRiskDealsTable';
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

  // Fetch metrics
  const { data: metricsData } = useQuery<{
    success: boolean;
    data: AEMetrics;
  }>({
    queryKey: ['ae-metrics'],
    queryFn: async () => {
      const response = await axios.get(`${API_URL}/api/hub/ae/metrics`, {
        withCredentials: true,
      });
      return response.data;
    },
  });

  // Fetch priority accounts
  const { data: accountsData } = useQuery<{
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
  const { data: dealsData } = useQuery<{
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

  // Fetch pipeline forecast
  const { data: forecastData } = useQuery<{
    success: boolean;
    data: any;
  }>({
    queryKey: ['ae-pipeline-forecast'],
    queryFn: async () => {
      const response = await axios.get(`${API_URL}/api/hub/ae/pipeline-forecast`, {
        withCredentials: true,
      });
      return response.data;
    },
  });

  const metrics = metricsData?.data;
  const priorityAccounts = accountsData?.data || [];
  const atRiskDeals = dealsData?.data || [];
  const priorities = prioritiesData?.data || [];
  const forecast = forecastData?.data;

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900">Account Executive Hub</h1>
          <p className="text-slate-600 mt-2">New business acquisition and pipeline building</p>
        </div>

        {/* AI Assistant */}
        <div className="mb-6">
          <AIAssistant userRole="Account Executive" />
        </div>

        {/* Top Metrics Row - More Compact */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {/* Quota Attainment */}
          <div className="bg-white rounded-lg shadow-sm p-4 border-l-4 border-blue-500">
            <div className="text-xs font-medium text-slate-600 mb-1">Quota Attainment YTD</div>
            <div className="text-2xl font-bold text-slate-900">
              {metrics ? formatPercent(metrics.quotaAttainmentYTD) : '—'}
            </div>
            <div className="text-xs text-slate-500">of annual quota</div>
          </div>

          {/* Pipeline Coverage */}
          <div className="bg-white rounded-lg shadow-sm p-4 border-l-4 border-green-500">
            <div className="text-xs font-medium text-slate-600 mb-1">Pipeline Coverage</div>
            <div className="text-2xl font-bold text-slate-900">
              {metrics ? `${metrics.pipelineCoverage.toFixed(1)}x` : '—'}
            </div>
            <div className="text-xs text-slate-500">vs. remaining quota</div>
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
          {forecast && <PipelineForecastPanel forecast={forecast} />}
        </div>

        {/* Priority Actions Section */}
        <div className="mb-8">
          <h2 className="text-xl font-bold text-slate-900 mb-4">
            🎯 Priority Actions
          </h2>
          <PriorityActionsTable accounts={priorityAccounts} />
        </div>

        {/* At-Risk Deals Section */}
        <div className="mb-8">
          <h2 className="text-xl font-bold text-slate-900 mb-4">
            ⚠️ At-Risk Deals
          </h2>
          <AtRiskDealsTable deals={atRiskDeals} />
        </div>
      </div>
    </div>
  );
}
