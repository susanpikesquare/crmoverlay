import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { config } from '../config';
import AIAssistant from '../components/AIAssistant';

const API_URL = config.apiBaseUrl;

interface CSMMetrics {
  accountsAtRisk: number;
  avgHealthScore: number;
  upcomingRenewals: number;
  adoptionTrend: number;
}

interface LicenseUtilizationAccount {
  id: string;
  name: string;
  contractedSeats: number;
  activeUsers: number;
  utilizationPercent: number;
  utilizationByProduct: {
    learn?: { seats: number; activeUsers: number; utilization: number };
    comms?: { seats: number; activeUsers: number; utilization: number };
    tasks?: { seats: number; activeUsers: number; utilization: number };
    max?: { seats: number; activeUsers: number; utilization: number };
  };
  usageTrend?: string;
  nextSteps?: string;
  healthScore?: number;
  arr?: number;
  renewalDate?: string;
  daysToRenewal?: number;
  riskLevel: 'critical' | 'warning' | 'healthy' | 'over-utilized';
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

export default function CSMHub() {
  // Expand state for each panel
  const [expandedAtRisk, setExpandedAtRisk] = useState(false);
  const [expandedOverLicense, setExpandedOverLicense] = useState(false);
  const [expandedUnderutilized, setExpandedUnderutilized] = useState(false);

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

  // Fetch underutilized accounts
  const { data: underutilizedData, isLoading: loadingUnderutilized } = useQuery<{
    success: boolean;
    data: LicenseUtilizationAccount[];
    count: number;
  }>({
    queryKey: ['csm-underutilized'],
    queryFn: async () => {
      const response = await axios.get(`${API_URL}/api/hub/csm/underutilized`, {
        withCredentials: true,
      });
      return response.data;
    },
  });

  // Fetch expansion opportunity accounts (over license)
  const { data: expansionData, isLoading: loadingExpansion } = useQuery<{
    success: boolean;
    data: LicenseUtilizationAccount[];
    count: number;
  }>({
    queryKey: ['csm-expansion-opportunities'],
    queryFn: async () => {
      const response = await axios.get(`${API_URL}/api/hub/csm/expansion-opportunities`, {
        withCredentials: true,
      });
      return response.data;
    },
  });

  // Fetch at-risk accounts
  const { data: atRiskData, isLoading: loadingAtRisk } = useQuery<{
    success: boolean;
    data: AtRiskAccount[];
    count: number;
  }>({
    queryKey: ['csm-at-risk'],
    queryFn: async () => {
      const response = await axios.get(`${API_URL}/api/hub/csm/at-risk`, {
        withCredentials: true,
      });
      return response.data;
    },
  });

  const metrics = metricsData?.data;
  const underutilizedAccounts = underutilizedData?.data || [];
  const overLicenseAccounts = expansionData?.data || [];
  const atRiskAccounts = atRiskData?.data || [];

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

  const getHealthScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-amber-600';
    return 'text-red-600';
  };

  const getHealthScoreBarColor = (score: number) => {
    if (score >= 80) return 'bg-green-500';
    if (score >= 60) return 'bg-amber-500';
    return 'bg-red-500';
  };

  const getUtilizationColor = (percent: number) => {
    if (percent >= 80) return 'text-green-600';
    if (percent >= 50) return 'text-amber-600';
    return 'text-red-600';
  };

  const getUtilizationBarColor = (percent: number) => {
    if (percent >= 80) return 'bg-green-500';
    if (percent >= 50) return 'bg-amber-500';
    return 'bg-red-500';
  };

  // Reusable expand/collapse panel component
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
          {count} accounts
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
        <div key={i} className="animate-pulse bg-gray-100 h-16 rounded-lg"></div>
      ))}
    </div>
  );

  const EmptyState = ({ message, submessage }: { message: string; submessage: string }) => (
    <div className="text-center py-6 text-slate-500">
      <p>{message}</p>
      <p className="text-sm mt-1">{submessage}</p>
    </div>
  );

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
          <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-red-500">
            <div className="text-sm font-medium text-slate-600 mb-2">Accounts at Risk</div>
            <div className="text-3xl font-bold text-slate-900 mb-1">
              {metrics ? metrics.accountsAtRisk : '—'}
            </div>
            <div className="text-xs text-slate-500">need immediate attention</div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-green-500">
            <div className="text-sm font-medium text-slate-600 mb-2">Avg Health Score</div>
            <div className="text-3xl font-bold text-slate-900 mb-1">
              {metrics ? metrics.avgHealthScore.toFixed(0) : '—'}
            </div>
            <div className="text-xs text-slate-500">out of 100</div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-orange-500">
            <div className="text-sm font-medium text-slate-600 mb-2">Upcoming Renewals</div>
            <div className="text-3xl font-bold text-slate-900 mb-1">
              {metrics ? metrics.upcomingRenewals : '—'}
            </div>
            <div className="text-xs text-slate-500">next 90 days</div>
          </div>

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

        {/* Three Panel Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Panel 1: At Risk Accounts */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <PanelHeader
              title="At Risk Accounts"
              subtitle="Low health scores requiring attention"
              count={atRiskAccounts.length}
              badgeColor="bg-red-100 text-red-800"
              expanded={expandedAtRisk}
              onToggle={() => setExpandedAtRisk(!expandedAtRisk)}
            />

            {loadingAtRisk ? (
              <LoadingSkeleton />
            ) : atRiskAccounts.length === 0 ? (
              <EmptyState
                message="No at-risk accounts"
                submessage="All accounts are healthy"
              />
            ) : (
              <div className={`space-y-3 ${expandedAtRisk ? 'max-h-[600px]' : 'max-h-[320px]'} overflow-y-auto`}>
                {(expandedAtRisk ? atRiskAccounts : atRiskAccounts.slice(0, 5)).map((account) => (
                  <Link
                    key={account.id}
                    to={`/account/${account.id}`}
                    className="block p-3 bg-red-50 rounded-lg hover:bg-red-100 transition-colors border border-red-200"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-semibold text-slate-900 text-sm">{account.name}</h3>
                      <span className={`text-lg font-bold ${getHealthScoreColor(account.healthScore)}`}>
                        {account.healthScore}
                      </span>
                    </div>

                    {/* Health Score Bar */}
                    <div className="w-full bg-gray-200 rounded-full h-1.5 mb-2">
                      <div
                        className={`h-1.5 rounded-full ${getHealthScoreBarColor(account.healthScore)}`}
                        style={{ width: `${account.healthScore}%` }}
                      ></div>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-slate-600">
                      {account.arr && <span>{formatCurrency(account.arr)} ARR</span>}
                      {account.daysToRenewal !== undefined && (
                        <>
                          <span>•</span>
                          <span className={account.daysToRenewal <= 60 ? 'text-red-600 font-medium' : ''}>
                            {account.daysToRenewal} days to renewal
                          </span>
                        </>
                      )}
                    </div>

                    {account.riskFactors && account.riskFactors.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {account.riskFactors.slice(0, 2).map((factor, idx) => (
                          <span key={idx} className="px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded">
                            {factor}
                          </span>
                        ))}
                      </div>
                    )}
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Panel 2: Over License Count */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <PanelHeader
              title="Over License Count"
              subtitle="Accounts exceeding seat capacity"
              count={overLicenseAccounts.length}
              badgeColor="bg-purple-100 text-purple-800"
              expanded={expandedOverLicense}
              onToggle={() => setExpandedOverLicense(!expandedOverLicense)}
            />

            {loadingExpansion ? (
              <LoadingSkeleton />
            ) : overLicenseAccounts.length === 0 ? (
              <EmptyState
                message="No accounts over capacity"
                submessage="All accounts within license limits"
              />
            ) : (
              <div className={`space-y-3 ${expandedOverLicense ? 'max-h-[600px]' : 'max-h-[320px]'} overflow-y-auto`}>
                {(expandedOverLicense ? overLicenseAccounts : overLicenseAccounts.slice(0, 5)).map((account) => (
                  <Link
                    key={account.id}
                    to={`/account/${account.id}`}
                    className="block p-3 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors border border-purple-200"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-semibold text-slate-900 text-sm">{account.name}</h3>
                      <span className="text-lg font-bold text-purple-700">
                        {account.utilizationPercent}%
                      </span>
                    </div>

                    {/* Utilization Bar */}
                    <div className="w-full bg-gray-200 rounded-full h-1.5 mb-2">
                      <div
                        className="h-1.5 rounded-full bg-purple-500"
                        style={{ width: `${Math.min(account.utilizationPercent, 100)}%` }}
                      ></div>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-slate-600">
                      <span>{account.contractedSeats.toLocaleString()} licensed</span>
                      <span>•</span>
                      <span className="text-purple-700 font-medium">
                        {account.activeUsers.toLocaleString()} active
                      </span>
                    </div>

                    {account.utilizationPercent > 100 && (
                      <div className="mt-2 text-xs text-purple-700 bg-purple-100 px-2 py-0.5 rounded inline-block">
                        +{(account.activeUsers - account.contractedSeats).toLocaleString()} over limit
                      </div>
                    )}
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Panel 3: Underutilization */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <PanelHeader
              title="Underutilization Risk"
              subtitle="Low license adoption rates"
              count={underutilizedAccounts.length}
              badgeColor="bg-amber-100 text-amber-800"
              expanded={expandedUnderutilized}
              onToggle={() => setExpandedUnderutilized(!expandedUnderutilized)}
            />

            {loadingUnderutilized ? (
              <LoadingSkeleton />
            ) : underutilizedAccounts.length === 0 ? (
              <EmptyState
                message="No underutilized accounts"
                submessage="All accounts have healthy adoption"
              />
            ) : (
              <div className={`space-y-3 ${expandedUnderutilized ? 'max-h-[600px]' : 'max-h-[320px]'} overflow-y-auto`}>
                {(expandedUnderutilized ? underutilizedAccounts : underutilizedAccounts.slice(0, 5)).map((account) => (
                  <Link
                    key={account.id}
                    to={`/account/${account.id}`}
                    className="block p-3 bg-amber-50 rounded-lg hover:bg-amber-100 transition-colors border border-amber-200"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-semibold text-slate-900 text-sm">{account.name}</h3>
                      <span className={`text-lg font-bold ${getUtilizationColor(account.utilizationPercent)}`}>
                        {account.utilizationPercent}%
                      </span>
                    </div>

                    {/* Utilization Bar */}
                    <div className="w-full bg-gray-200 rounded-full h-1.5 mb-2">
                      <div
                        className={`h-1.5 rounded-full ${getUtilizationBarColor(account.utilizationPercent)}`}
                        style={{ width: `${account.utilizationPercent}%` }}
                      ></div>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-slate-600">
                      <span>{account.contractedSeats.toLocaleString()} licensed</span>
                      <span>•</span>
                      <span>{account.activeUsers.toLocaleString()} active</span>
                      {account.arr && (
                        <>
                          <span>•</span>
                          <span>{formatCurrency(account.arr)}</span>
                        </>
                      )}
                    </div>

                    {account.daysToRenewal !== undefined && account.daysToRenewal <= 90 && (
                      <div className="mt-2 text-xs text-amber-700 bg-amber-100 px-2 py-0.5 rounded inline-block">
                        Renewal in {account.daysToRenewal} days
                      </div>
                    )}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* AI Assistant */}
        <div className="mb-8">
          <AIAssistant userRole="Customer Success Manager" />
        </div>
      </div>
    </div>
  );
}
