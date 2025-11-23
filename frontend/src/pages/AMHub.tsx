import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { config } from '../config';

const API_URL = config.apiBaseUrl;

interface AMMetrics {
  nrrTarget: number;
  renewalsAtRiskCount: number;
  expansionPipeline: number;
  avgContractValue: number;
}

interface RenewalAccount {
  Id: string;
  Name: string;
  daysToRenewal: number;
  contractValue: number;
  healthScore: number;
  renewalRisk: 'At Risk' | 'On Track' | 'Expansion Opportunity';
  keySignals: string[];
  aiRecommendation: string;
}

export default function AMHub() {
  const navigate = useNavigate();

  // Fetch metrics
  const { data: metricsData } = useQuery<{
    success: boolean;
    data: AMMetrics;
  }>({
    queryKey: ['am-metrics'],
    queryFn: async () => {
      const response = await axios.get(`${API_URL}/api/hub/am/metrics`, {
        withCredentials: true,
      });
      return response.data;
    },
  });

  // Fetch renewal accounts
  const { data: renewalsData } = useQuery<{
    success: boolean;
    data: RenewalAccount[];
  }>({
    queryKey: ['am-renewals'],
    queryFn: async () => {
      const response = await axios.get(`${API_URL}/api/hub/am/renewals`, {
        withCredentials: true,
      });
      return response.data;
    },
  });

  const metrics = metricsData?.data;
  const renewalAccounts = renewalsData?.data || [];

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

  const getRiskColor = (risk: string) => {
    if (risk === 'At Risk') return 'border-red-500 bg-red-50';
    if (risk === 'Expansion Opportunity') return 'border-green-500 bg-green-50';
    return 'border-blue-500 bg-blue-50';
  };

  const getRiskBadgeColor = (risk: string) => {
    if (risk === 'At Risk') return 'bg-red-100 text-red-800';
    if (risk === 'Expansion Opportunity') return 'bg-green-100 text-green-800';
    return 'bg-blue-100 text-blue-800';
  };

  const getDaysColor = (days: number) => {
    if (days < 30) return 'text-red-600';
    if (days < 60) return 'text-orange-600';
    return 'text-green-600';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900">Account Manager Hub</h1>
          <p className="text-slate-600 mt-2">Renewals, expansions, and NRR optimization</p>
        </div>

        {/* Top Metrics Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* NRR Target */}
          <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-green-500">
            <div className="text-sm font-medium text-slate-600 mb-2">NRR Target</div>
            <div className="text-3xl font-bold text-slate-900 mb-1">
              {metrics ? formatPercent(metrics.nrrTarget) : '—'}
            </div>
            <div className="text-xs text-slate-500">net revenue retention</div>
          </div>

          {/* Renewals at Risk */}
          <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-red-500">
            <div className="text-sm font-medium text-slate-600 mb-2">Renewals at Risk</div>
            <div className="text-3xl font-bold text-slate-900 mb-1">
              {metrics ? metrics.renewalsAtRiskCount : '—'}
            </div>
            <div className="text-xs text-slate-500">accounts need attention</div>
          </div>

          {/* Expansion Pipeline */}
          <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-purple-500">
            <div className="text-sm font-medium text-slate-600 mb-2">Expansion Pipeline</div>
            <div className="text-3xl font-bold text-slate-900 mb-1">
              {metrics ? formatCurrency(metrics.expansionPipeline) : '—'}
            </div>
            <div className="text-xs text-slate-500">upsell opportunities</div>
          </div>

          {/* Avg Contract Value */}
          <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-blue-500">
            <div className="text-sm font-medium text-slate-600 mb-2">Avg Contract Value</div>
            <div className="text-3xl font-bold text-slate-900 mb-1">
              {metrics ? formatCurrency(metrics.avgContractValue) : '—'}
            </div>
            <div className="text-xs text-slate-500">ARR per account</div>
          </div>
        </div>

        {/* Renewals Dashboard */}
        <div>
          <h2 className="text-xl font-bold text-slate-900 mb-4">
            📋 Renewal Dashboard ({renewalAccounts.length})
          </h2>

          {renewalAccounts.length === 0 && (
            <div className="bg-white rounded-lg shadow-md p-8 text-center text-slate-500">
              No upcoming renewals in the next 180 days
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {renewalAccounts.map((account) => (
              <div
                key={account.Id}
                className={`bg-white rounded-lg shadow-md p-6 border-l-4 ${getRiskColor(
                  account.renewalRisk
                )} hover:shadow-lg transition-shadow cursor-pointer`}
                onClick={() => navigate(`/account/${account.Id}`)}
              >
                {/* Header */}
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-slate-900 hover:text-blue-600">
                      {account.Name}
                    </h3>
                    <div className="mt-2">
                      <span
                        className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${getRiskBadgeColor(
                          account.renewalRisk
                        )}`}
                      >
                        {account.renewalRisk}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div
                      className={`text-2xl font-bold ${getDaysColor(account.daysToRenewal)}`}
                    >
                      {account.daysToRenewal}
                    </div>
                    <div className="text-xs text-slate-500">days</div>
                  </div>
                </div>

                {/* Key Metrics */}
                <div className="grid grid-cols-2 gap-4 mb-4 pb-4 border-b border-slate-200">
                  <div>
                    <div className="text-xs text-slate-500">Contract Value</div>
                    <div className="text-sm font-medium text-slate-900">
                      {formatCurrency(account.contractValue)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">Health Score</div>
                    <div className="flex items-center gap-2">
                      <div className="text-sm font-medium text-slate-900">{account.healthScore}</div>
                      <div className="flex-1 bg-slate-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${
                            account.healthScore >= 80
                              ? 'bg-green-500'
                              : account.healthScore >= 60
                              ? 'bg-yellow-500'
                              : 'bg-red-500'
                          }`}
                          style={{ width: `${account.healthScore}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Key Signals */}
                {account.keySignals.length > 0 && (
                  <div className="mb-4">
                    <div className="text-xs text-slate-500 mb-2">Key Signals</div>
                    <div className="space-y-1">
                      {account.keySignals.map((signal, idx) => (
                        <div key={idx} className="flex items-start gap-2">
                          <span className="text-slate-400 mt-1">•</span>
                          <span className="text-sm text-slate-700">{signal}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* AI Recommendation */}
                <div
                  className={`border rounded-lg p-3 ${
                    account.renewalRisk === 'At Risk'
                      ? 'bg-red-50 border-red-200'
                      : account.renewalRisk === 'Expansion Opportunity'
                      ? 'bg-green-50 border-green-200'
                      : 'bg-blue-50 border-blue-200'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <span
                      className={`font-bold text-sm ${
                        account.renewalRisk === 'At Risk'
                          ? 'text-red-600'
                          : account.renewalRisk === 'Expansion Opportunity'
                          ? 'text-green-600'
                          : 'text-blue-600'
                      }`}
                    >
                      {account.renewalRisk === 'At Risk'
                        ? '🚨 Urgent:'
                        : account.renewalRisk === 'Expansion Opportunity'
                        ? '💎 Opportunity:'
                        : '✅ Next Step:'}
                    </span>
                    <p
                      className={`text-sm ${
                        account.renewalRisk === 'At Risk'
                          ? 'text-red-900'
                          : account.renewalRisk === 'Expansion Opportunity'
                          ? 'text-green-900'
                          : 'text-blue-900'
                      }`}
                    >
                      {account.aiRecommendation}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
