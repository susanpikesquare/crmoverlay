import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { config } from '../config';

const API_URL = config.apiBaseUrl;

interface CSMMetrics {
  accountsAtRisk: number;
  avgHealthScore: number;
  upcomingRenewals: number;
  adoptionTrend: number;
}

export default function CSMHub() {
  // Fetch metrics
  const { data: metricsData } = useQuery<{
    success: boolean;
    data: CSMMetrics;
  }>({
    queryKey: ['csm-metrics'],
    queryFn: async () => {
      const response = await axios.get(`${API_URL}/api/hub/csm/metrics`, {
        withCredentials: true,
      });
      return response.data;
    },
  });

  const metrics = metricsData?.data;

  const formatPercent = (value: number) => {
    return `${Math.round(value)}%`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900">Customer Success Manager Hub</h1>
          <p className="text-slate-600 mt-2">Customer health, adoption, and retention</p>
        </div>

        {/* Top Metrics Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Accounts at Risk */}
          <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-red-500">
            <div className="text-sm font-medium text-slate-600 mb-2">Accounts at Risk</div>
            <div className="text-3xl font-bold text-slate-900 mb-1">
              {metrics ? metrics.accountsAtRisk : '—'}
            </div>
            <div className="text-xs text-slate-500">need immediate attention</div>
          </div>

          {/* Avg Health Score */}
          <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-green-500">
            <div className="text-sm font-medium text-slate-600 mb-2">Avg Health Score</div>
            <div className="text-3xl font-bold text-slate-900 mb-1">
              {metrics ? metrics.avgHealthScore.toFixed(0) : '—'}
            </div>
            <div className="text-xs text-slate-500">out of 100</div>
          </div>

          {/* Upcoming Renewals */}
          <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-orange-500">
            <div className="text-sm font-medium text-slate-600 mb-2">Upcoming Renewals</div>
            <div className="text-3xl font-bold text-slate-900 mb-1">
              {metrics ? metrics.upcomingRenewals : '—'}
            </div>
            <div className="text-xs text-slate-500">next 90 days</div>
          </div>

          {/* Adoption Trend */}
          <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-blue-500">
            <div className="text-sm font-medium text-slate-600 mb-2">Adoption Trend</div>
            <div className="text-3xl font-bold text-slate-900 mb-1">
              {metrics
                ? `${metrics.adoptionTrend > 0 ? '+' : ''}${formatPercent(metrics.adoptionTrend)}`
                : '—'}
            </div>
            <div className="text-xs text-slate-500">QoQ change</div>
          </div>
        </div>

        {/* Placeholder for additional CSM features */}
        <div className="bg-white rounded-lg shadow-md p-8">
          <h2 className="text-xl font-bold text-slate-900 mb-4">CSM Dashboard</h2>
          <p className="text-slate-600">
            Additional CSM cockpit features coming soon: Health score tracking, QBR scheduling,
            usage analytics, and risk escalation workflows.
          </p>
        </div>
      </div>
    </div>
  );
}
