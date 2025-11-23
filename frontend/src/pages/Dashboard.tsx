import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import apiClient from '../services/api';

interface Account {
  Id: string;
  Name: string;
  Industry: string;
  Priority_Score__c: number;
  Priority_Tier__c: string;
  Clay_Employee_Count__c: number;
  Clay_Employee_Growth_Pct__c: number;
  Clay_Current_LMS__c: string;
  Clay_Active_Signals__c: string;
  SixSense_Intent_Score__c: number;
  SixSense_Buying_Stage__c: string;
}

interface Opportunity {
  Id: string;
  Name: string;
  Account: { Name: string };
  Amount: number;
  StageName: string;
  DaysInStage__c: number;
  MEDDPICC_Overall_Score__c: number;
  Command_Overall_Score__c?: number;
  Command_Last_Updated__c?: string;
  IsAtRisk__c: boolean;
}

interface DashboardStats {
  accounts: {
    total: number;
    highPriority: number;
  };
  opportunities: {
    total: number;
    atRisk: number;
    totalValue: number;
    avgDealSize: number;
  };
}

export default function Dashboard() {
  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ['dashboardStats'],
    queryFn: async () => {
      const response = await apiClient.get('/api/dashboard/stats');
      return response.data.data as DashboardStats;
    },
  });

  const { data: highPriorityAccounts, isLoading: accountsLoading } = useQuery({
    queryKey: ['highPriorityAccounts'],
    queryFn: async () => {
      const response = await apiClient.get('/api/accounts/high-priority');
      return response.data.data as Account[];
    },
  });

  const { data: atRiskOpportunities, isLoading: oppsLoading } = useQuery({
    queryKey: ['atRiskOpportunities'],
    queryFn: async () => {
      const response = await apiClient.get('/api/opportunities/at-risk');
      return response.data.data as Opportunity[];
    },
  });

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 18) return 'Good Afternoon';
    return 'Good Evening';
  };

  const getPriorityColor = (tier: string) => {
    if (tier.includes('🔥')) return 'border-red-500 bg-red-50';
    if (tier.includes('🔶')) return 'border-orange-500 bg-orange-50';
    return 'border-blue-500 bg-blue-50';
  };

  const getPriorityBadgeColor = (tier: string) => {
    if (tier.includes('🔥')) return 'bg-red-100 text-red-800';
    if (tier.includes('🔶')) return 'bg-orange-100 text-orange-800';
    return 'bg-blue-100 text-blue-800';
  };

  const getAIRecommendation = (account: Account) => {
    if (account.SixSense_Buying_Stage__c === 'Decision') {
      return `Schedule executive demo - they're in decision stage with ${account.SixSense_Intent_Score__c}% intent`;
    }
    if (account.Clay_Employee_Growth_Pct__c > 20) {
      return `Highlight scalability - rapid ${account.Clay_Employee_Growth_Pct__c}% growth needs flexible solutions`;
    }
    if (account.Clay_Current_LMS__c) {
      return `Position against ${account.Clay_Current_LMS__c} - current LMS may not scale`;
    }
    return 'Engage with personalized outreach based on active signals';
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const calculateQuotaAttainment = () => {
    if (!statsData) return 0;
    // Mock calculation: total pipeline / quarterly quota (assume $2M quota)
    const quota = 2000000;
    return Math.round((statsData.opportunities.totalValue / quota) * 100);
  };

  const calculatePipelineCoverage = () => {
    if (!statsData) return 0;
    // Mock calculation: pipeline value / remaining quota
    const remainingQuota = 2000000 * (1 - (calculateQuotaAttainment() / 100));
    return (statsData.opportunities.totalValue / remainingQuota).toFixed(1);
  };

  if (statsLoading || accountsLoading || oppsLoading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="animate-pulse">
          <div className="h-48 bg-gray-200 rounded-2xl mb-8"></div>
          <div className="grid grid-cols-3 gap-6 mb-8">
            <div className="h-32 bg-gray-200 rounded-xl"></div>
            <div className="h-32 bg-gray-200 rounded-xl"></div>
            <div className="h-32 bg-gray-200 rounded-xl"></div>
          </div>
          <div className="grid grid-cols-2 gap-8">
            <div className="h-96 bg-gray-200 rounded-xl"></div>
            <div className="h-96 bg-gray-200 rounded-xl"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header Section */}
      <div className="bg-gradient-to-r from-purple-600 via-blue-600 to-indigo-600 text-white px-8 py-12">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-4xl font-bold mb-2">{getGreeting()}, Susan! 👋</h1>
          <p className="text-blue-100 text-lg">Here are your priority actions for today</p>
        </div>
      </div>

      {/* Stats Row */}
      <div className="max-w-7xl mx-auto px-8 -mt-8 mb-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Quota Attainment */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-gray-600 font-medium">Quota Attainment</h3>
              <span className="text-2xl">🎯</span>
            </div>
            <div className="text-3xl font-bold text-gray-900 mb-2">
              {calculateQuotaAttainment()}%
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-gradient-to-r from-purple-600 to-blue-600 h-2 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(calculateQuotaAttainment(), 100)}%` }}
              ></div>
            </div>
          </div>

          {/* Pipeline Coverage */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-gray-600 font-medium">Pipeline Coverage</h3>
              <span className="text-2xl">📊</span>
            </div>
            <div className="text-3xl font-bold text-gray-900 mb-2">
              {calculatePipelineCoverage()}x
            </div>
            <p className="text-sm text-gray-600">
              {formatCurrency(statsData?.opportunities.totalValue || 0)} in pipeline
            </p>
          </div>

          {/* Hot Prospects */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-gray-600 font-medium">Hot Prospects</h3>
              <span className="text-2xl">🔥</span>
            </div>
            <div className="text-3xl font-bold text-gray-900 mb-2">
              {statsData?.accounts.highPriority || 0}
            </div>
            <p className="text-sm text-gray-600">
              Accounts in decision stage
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-8 pb-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column - Priority Actions */}
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Priority Actions</h2>
              <Link
                to="/accounts"
                className="text-blue-600 hover:text-blue-700 font-medium text-sm"
              >
                View All →
              </Link>
            </div>

            <div className="space-y-4">
              {highPriorityAccounts?.map((account) => (
                <Link
                  key={account.Id}
                  to={`/account/${account.Id}`}
                  className="block"
                >
                  <div
                    className={`bg-white rounded-xl shadow-sm border-l-4 p-6 hover:shadow-lg transition-all duration-200 hover:-translate-y-1 cursor-pointer ${getPriorityColor(
                      account.Priority_Tier__c
                    )}`}
                  >
                    {/* Account Header */}
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-1">
                          {account.Name}
                        </h3>
                        <p className="text-sm text-gray-600">{account.Industry}</p>
                      </div>
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold ${getPriorityBadgeColor(
                          account.Priority_Tier__c
                        )}`}
                      >
                        {account.Priority_Tier__c}
                      </span>
                    </div>

                    {/* Key Signals */}
                    <div className="space-y-2 mb-4">
                      <div className="flex items-center text-sm">
                        <span className="text-gray-600 mr-2">👥</span>
                        <span className="text-gray-900">
                          {account.Clay_Employee_Count__c.toLocaleString()} employees
                        </span>
                        <span className="ml-2 text-green-600 font-medium">
                          +{account.Clay_Employee_Growth_Pct__c}% growth
                        </span>
                      </div>

                      <div className="flex items-center text-sm">
                        <span className="text-gray-600 mr-2">🎯</span>
                        <span className="text-gray-900">
                          Intent Score: {account.SixSense_Intent_Score__c}/100
                        </span>
                        <span className="mx-2 text-gray-400">•</span>
                        <span className="text-gray-900">
                          Stage: {account.SixSense_Buying_Stage__c}
                        </span>
                      </div>

                      <div className="flex items-center text-sm">
                        <span className="text-gray-600 mr-2">💻</span>
                        <span className="text-gray-900">
                          Current LMS: {account.Clay_Current_LMS__c || 'None'}
                        </span>
                      </div>
                    </div>

                    {/* AI Recommendation */}
                    <div className="bg-white bg-opacity-60 rounded-lg p-3 border border-purple-200">
                      <div className="flex items-start">
                        <span className="text-purple-600 mr-2 flex-shrink-0">💡</span>
                        <p className="text-sm text-gray-800">
                          <span className="font-semibold text-purple-900">Recommendation:</span>{' '}
                          {getAIRecommendation(account)}
                        </p>
                      </div>
                    </div>

                    {/* Active Signals Preview */}
                    {account.Clay_Active_Signals__c && (
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <p className="text-xs text-gray-600 font-medium mb-1">Active Signals:</p>
                        <p className="text-sm text-gray-700 line-clamp-2">
                          {account.Clay_Active_Signals__c.split('\n')[0]}
                        </p>
                      </div>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Right Column - At-Risk Deals */}
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">At-Risk Deals</h2>
              <Link
                to="/opportunities"
                className="text-blue-600 hover:text-blue-700 font-medium text-sm"
              >
                View All →
              </Link>
            </div>

            <div className="space-y-4">
              {atRiskOpportunities?.map((opp) => (
                <Link
                  key={opp.Id}
                  to={`/opportunity/${opp.Id}`}
                  className="block"
                >
                  <div className="bg-white rounded-xl shadow-sm p-6 border-l-4 border-yellow-500 hover:shadow-lg transition-all duration-200 hover:-translate-y-1 cursor-pointer"
                  >
                  {/* Opportunity Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 mb-1">
                        {opp.Name}
                      </h3>
                      <p className="text-sm text-gray-600">{opp.Account.Name}</p>
                    </div>
                    <span className="text-yellow-600 text-xl">⚠️</span>
                  </div>

                  {/* Opportunity Details */}
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <p className="text-xs text-gray-600 mb-1">Amount</p>
                      <p className="text-lg font-semibold text-gray-900">
                        {formatCurrency(opp.Amount)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600 mb-1">Stage</p>
                      <p className="text-sm font-medium text-gray-900">{opp.StageName}</p>
                    </div>
                  </div>

                  {/* Warning Indicators */}
                  <div className="space-y-2">
                    {opp.DaysInStage__c > 14 && (
                      <div className="flex items-center text-sm">
                        <span className="text-red-600 mr-2">🔴</span>
                        <span className="text-red-800">
                          Stuck in stage for {opp.DaysInStage__c} days
                        </span>
                      </div>
                    )}

                    {opp.MEDDPICC_Overall_Score__c < 60 && (
                      <div className="flex items-center text-sm">
                        <span className="text-orange-600 mr-2">📉</span>
                        <span className="text-orange-800">
                          MEDDPICC Score: {opp.MEDDPICC_Overall_Score__c}% (Low)
                        </span>
                      </div>
                    )}

                    {opp.Command_Overall_Score__c !== undefined && opp.Command_Overall_Score__c < 70 && (
                      <div className="flex items-center text-sm">
                        <span className="text-red-600 mr-2">⚠️</span>
                        <span className="text-red-800">
                          Command Score: {opp.Command_Overall_Score__c}% (Weak)
                        </span>
                      </div>
                    )}

                    {opp.Command_Last_Updated__c && (
                      (() => {
                        const daysSinceUpdate = Math.floor((new Date().getTime() - new Date(opp.Command_Last_Updated__c).getTime()) / (1000 * 60 * 60 * 24));
                        return daysSinceUpdate > 14 ? (
                          <div className="flex items-center text-sm">
                            <span className="text-orange-600 mr-2">⏰</span>
                            <span className="text-orange-800">
                              Command data stale ({daysSinceUpdate}d)
                            </span>
                          </div>
                        ) : null;
                      })()
                    )}
                  </div>

                  {/* Action Required */}
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <p className="text-sm font-medium text-gray-900 mb-2">Action Required:</p>
                    <div className="flex gap-2">
                      <button
                        onClick={(e) => e.preventDefault()}
                        className="flex-1 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition"
                      >
                        Update MEDDPICC
                      </button>
                      <button
                        onClick={(e) => e.preventDefault()}
                        className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition"
                      >
                        Schedule Call
                      </button>
                    </div>
                  </div>
                  </div>
                </Link>
              ))}


              {(!atRiskOpportunities || atRiskOpportunities.length === 0) && (
                <div className="bg-white rounded-xl shadow-sm p-8 text-center">
                  <span className="text-4xl mb-4 block">✨</span>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    No At-Risk Deals
                  </h3>
                  <p className="text-gray-600">
                    All your opportunities are healthy and progressing well!
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
