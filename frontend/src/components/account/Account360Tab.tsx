import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import apiClient from '../../services/api';
import EditableField from '../EditableField';
import GongCallInsights from '../GongCallInsights';
import GongAISearch from '../GongAISearch';
import AIAssistant from '../AIAssistant';

interface Account {
  Id: string;
  Name: string;
  Industry: string;
  AnnualRevenue: number;
  NumberOfEmployees: number;
  Website: string;
  BillingCity: string;
  BillingState: string;
  BillingCountry: string;
  Clay_Employee_Count__c: number;
  Clay_Employee_Growth_Pct__c: number;
  Clay_Current_LMS__c: string;
  Clay_HRIS_System__c: string;
  Clay_Technologies__c: string;
  Clay_Active_Signals__c: string;
  Clay_Last_Funding_Round__c?: string;
  Clay_Last_Funding_Amount__c?: number;
  SixSense_Buying_Stage__c: string;
  SixSense_Intent_Score__c: number;
  SixSense_Profile_Fit_Score__c: number;
  SixSense_Engaged_Campaigns__c: string;
  Contract_Total_License_Seats__c?: number;
  Total_Hierarchy_Seats__c?: number;
  Logo_Seats__c?: number;
  Total_Active_Users__c?: number;
  Active_Users_Max__c?: number;
  Active_Users_Learn__c?: number;
  Active_Users_Comms__c?: number;
  Active_Users_Tasks__c?: number;
  License_Utilization_Max__c?: number;
  License_Utilization_Learn__c?: number;
  License_Utilization_Comms__c?: number;
  License_Utilization_Tasks__c?: number;
  Max_Usage_Trend__c?: string;
  License_Utilization_current_Summary__c?: string;
  License_Utilization_Active_User_Summary__c?: string;
  Usage_Metrics_Next_Steps__c?: string;
  Content_Studio_Licenses__c?: number;
  Total_ARR__c?: number;
  Current_Gainsight_Score__c?: number;
  Customer_Stage__c?: string;
}

interface Opportunity {
  Id: string;
  Name: string;
  Amount: number;
  StageName: string;
  CloseDate: string;
  IsAtRisk__c: boolean;
}

interface FieldPermissions {
  updateable: boolean;
  type: string;
  label: string;
}

interface Permissions {
  objectUpdateable: boolean;
  fields: Record<string, FieldPermissions>;
}

interface Props {
  account: Account;
  opportunities?: Opportunity[];
  permissions?: Permissions;
  authData?: any;
  onFieldSave: (fieldName: string, value: any) => Promise<void>;
  successMessage: string | null;
  setSuccessMessage: (msg: string | null) => void;
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const getBuyingStageIcon = (stage: string) => {
  switch (stage) {
    case 'Decision':
      return '\uD83C\uDFAF';
    case 'Consideration':
      return '\uD83E\uDD14';
    case 'Awareness':
      return '\uD83D\uDCA1';
    default:
      return '\uD83D\uDCCA';
  }
};

interface NewsSignal {
  type: string;
  category: string;
  headline: string;
  summary: string;
  url?: string;
  relevance: 'high' | 'medium' | 'low';
  publishedDate?: string;
  score?: number;
}

function getScoreColor(score: number): string {
  if (score >= 70) return 'text-green-700 bg-green-50 border-green-200';
  if (score >= 40) return 'text-yellow-700 bg-yellow-50 border-yellow-200';
  return 'text-slate-700 bg-slate-50 border-slate-200';
}

function getRelevanceColor(relevance: string): string {
  if (relevance === 'high') return 'text-red-700 bg-red-50 border-red-200';
  if (relevance === 'medium') return 'text-yellow-700 bg-yellow-50 border-yellow-200';
  return 'text-slate-700 bg-slate-50 border-slate-200';
}

function getCategoryColor(category: string): string {
  const colors: Record<string, string> = {
    'store-opening': 'bg-emerald-100 text-emerald-700',
    'Store Opening': 'bg-emerald-100 text-emerald-700',
    'executive-hire': 'bg-violet-100 text-violet-700',
    'Executive Hire': 'bg-violet-100 text-violet-700',
    'expansion': 'bg-cyan-100 text-cyan-700',
    'Expansion': 'bg-cyan-100 text-cyan-700',
    'funding': 'bg-green-100 text-green-700',
    'Funding': 'bg-green-100 text-green-700',
    'partnership': 'bg-blue-100 text-blue-700',
    'Partnership': 'bg-blue-100 text-blue-700',
    'product-launch': 'bg-pink-100 text-pink-700',
    'Product Launch': 'bg-pink-100 text-pink-700',
    'restructuring': 'bg-amber-100 text-amber-700',
    'Restructuring': 'bg-amber-100 text-amber-700',
  };
  return colors[category] || 'bg-gray-100 text-gray-700';
}

function NewsSignalsPanel({ accountId }: { accountId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['account-news-signals', accountId],
    queryFn: async () => {
      const response = await apiClient.get(`/api/accounts/${accountId}/signals`);
      return response.data;
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const signals: NewsSignal[] = data?.data?.flatMap(
    (s: any) => s.signalData?.signals || []
  ) || [];

  return (
    <div className="bg-white rounded-xl shadow-md p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-900">News Signals</h2>
        <span className="px-3 py-1 bg-teal-50 text-teal-600 text-xs font-semibold rounded-full border border-teal-200">
          News
        </span>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-gray-400">
          <p>Loading news signals...</p>
        </div>
      ) : signals.length === 0 ? (
        <div className="text-center py-8 text-gray-400">
          <p>No news signals detected yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {signals.map((signal, index) => (
            <div
              key={index}
              className="p-3 bg-teal-50 rounded-lg border border-teal-100"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getCategoryColor(signal.category)}`}>
                      {signal.category}
                    </span>
                    <span className={`px-1.5 py-0.5 text-xs font-medium rounded border ${getRelevanceColor(signal.relevance)}`}>
                      {signal.relevance}
                    </span>
                    {signal.score != null && (
                      <span className={`px-2 py-0.5 text-xs font-bold rounded border ${getScoreColor(signal.score)}`}>
                        {signal.score}
                      </span>
                    )}
                  </div>
                  <h3 className="text-sm font-semibold text-gray-900">
                    {signal.url ? (
                      <a href={signal.url} target="_blank" rel="noopener noreferrer" className="hover:text-teal-700 hover:underline">
                        {signal.headline}
                      </a>
                    ) : (
                      signal.headline
                    )}
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">{signal.summary}</p>
                </div>
                {signal.publishedDate && (
                  <span className="text-xs text-gray-400 whitespace-nowrap">
                    {new Date(signal.publishedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Account360Tab({ account, opportunities, permissions, onFieldSave }: Props) {
  return (
    <>
      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Company Profile */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900">Company Profile</h2>
            <span className="px-3 py-1 bg-green-100 text-green-800 text-xs font-semibold rounded-full">
              Clay
            </span>
          </div>

          <div className="space-y-4">
            <EditableField
              value={account.Industry}
              fieldName="Industry"
              label="Industry"
              canEdit={permissions?.fields.Industry?.updateable || false}
              onSave={onFieldSave}
            />

            <div>
              <label className="text-sm font-medium text-gray-600">Headquarters</label>
              <p className="text-gray-900 mt-1">
                {account.BillingCity}, {account.BillingState}, {account.BillingCountry}
              </p>
            </div>

            <EditableField
              value={account.Website}
              fieldName="Website"
              fieldType="url"
              label="Website"
              canEdit={permissions?.fields.Website?.updateable || false}
              onSave={onFieldSave}
            />

            <EditableField
              value={account.AnnualRevenue}
              fieldName="AnnualRevenue"
              fieldType="currency"
              label="Annual Revenue"
              canEdit={permissions?.fields.AnnualRevenue?.updateable || false}
              onSave={onFieldSave}
              formatter={formatCurrency}
              className="font-semibold"
            />

            <EditableField
              value={account.NumberOfEmployees}
              fieldName="NumberOfEmployees"
              fieldType="int"
              label="Employee Count (Salesforce)"
              canEdit={permissions?.fields.NumberOfEmployees?.updateable || false}
              onSave={onFieldSave}
              formatter={(val) => val?.toLocaleString()}
            />

            <div>
              <label className="text-sm font-medium text-gray-600">Employee Count (Clay)</label>
              <div className="flex items-center gap-3 mt-1">
                <p className="text-gray-900 text-lg font-semibold">
                  {account.Clay_Employee_Count__c?.toLocaleString() || '\u2014'}
                </p>
                {account.Clay_Employee_Growth_Pct__c && (
                  <span className="px-2 py-1 bg-green-100 text-green-800 text-sm font-semibold rounded">
                    +{account.Clay_Employee_Growth_Pct__c}% growth
                  </span>
                )}
              </div>
            </div>

            {account.Clay_Last_Funding_Round__c && (
              <div>
                <label className="text-sm font-medium text-gray-600">Latest Funding</label>
                <div className="mt-1">
                  <p className="text-gray-900 font-medium">
                    {account.Clay_Last_Funding_Round__c}
                  </p>
                  {account.Clay_Last_Funding_Amount__c && (
                    <p className="text-gray-600">
                      {formatCurrency(account.Clay_Last_Funding_Amount__c)}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Technology Stack */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900">Technology Stack</h2>
            <span className="px-3 py-1 bg-green-100 text-green-800 text-xs font-semibold rounded-full">
              Clay
            </span>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-600">Current LMS</label>
              <p className="text-gray-900 mt-1 text-lg font-semibold">
                {account.Clay_Current_LMS__c || 'None'}
              </p>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-600">HRIS System</label>
              <p className="text-gray-900 mt-1">{account.Clay_HRIS_System__c || '\u2014'}</p>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-600">Tech Stack</label>
              <div className="mt-2 flex flex-wrap gap-2">
                {account.Clay_Technologies__c?.split(',').map((tech, index) => (
                  <span
                    key={index}
                    className="px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded-full"
                  >
                    {tech.trim()}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Intent & Engagement */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900">Intent & Engagement</h2>
            <span className="px-3 py-1 bg-purple-100 text-purple-800 text-xs font-semibold rounded-full">
              6sense
            </span>
          </div>

          <div className="space-y-6">
            <div>
              <label className="text-sm font-medium text-gray-600">Buying Stage</label>
              <div className="flex items-center gap-3 mt-2">
                <span className="text-3xl">
                  {getBuyingStageIcon(account.SixSense_Buying_Stage__c || '')}
                </span>
                <div>
                  <p className="text-gray-900 font-semibold text-lg">
                    {account.SixSense_Buying_Stage__c || '\u2014'}
                  </p>
                  <p className="text-sm text-gray-600">Current stage in buyer journey</p>
                </div>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-600">Intent Score</label>
              <div className="mt-2">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-2xl font-bold text-gray-900">
                    {account.SixSense_Intent_Score__c}
                  </span>
                  <span className="text-sm text-gray-600">/ 100</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className="bg-gradient-to-r from-purple-600 to-blue-600 h-3 rounded-full transition-all duration-500"
                    style={{ width: `${account.SixSense_Intent_Score__c}%` }}
                  ></div>
                </div>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-600">Profile Fit Score</label>
              <div className="mt-2">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-2xl font-bold text-gray-900">
                    {account.SixSense_Profile_Fit_Score__c}
                  </span>
                  <span className="text-sm text-gray-600">/ 100</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className="bg-gradient-to-r from-green-500 to-emerald-600 h-3 rounded-full transition-all duration-500"
                    style={{ width: `${account.SixSense_Profile_Fit_Score__c}%` }}
                  ></div>
                </div>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-600">Engaged Campaigns</label>
              <div className="mt-2 flex flex-wrap gap-2">
                {account.SixSense_Engaged_Campaigns__c ? (
                  account.SixSense_Engaged_Campaigns__c.split(',').map((campaign, index) => (
                    <span
                      key={index}
                      className="px-3 py-1 bg-purple-50 text-purple-700 text-sm rounded-full border border-purple-200"
                    >
                      {campaign.trim()}
                    </span>
                  ))
                ) : (
                  <span className="text-gray-400 text-sm">No campaigns engaged</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Active Buying Signals */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900">Active Buying Signals</h2>
            <span className="px-3 py-1 bg-green-100 text-green-800 text-xs font-semibold rounded-full">
              Clay
            </span>
          </div>

          <div className="space-y-3">
            {account.Clay_Active_Signals__c ? (
              account.Clay_Active_Signals__c.split('\n').map((signal, index) => (
                <div
                  key={index}
                  className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg border border-blue-100"
                >
                  <span className="text-blue-600 mt-0.5">{'\uD83D\uDD14'}</span>
                  <p className="text-gray-800 text-sm flex-1">{signal}</p>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-gray-400">
                <p>No active buying signals at this time</p>
              </div>
            )}
          </div>

          <div className="mt-6 pt-6 border-t border-gray-200">
            <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg p-4 border border-purple-200">
              <h3 className="text-sm font-semibold text-purple-900 mb-2">
                AI-Powered Insight
              </h3>
              <p className="text-sm text-gray-800">
                Based on recent signals and buying stage, this account shows high purchase
                intent. Recommend scheduling an executive demo within the next 7 days to
                capitalize on momentum.
              </p>
            </div>
          </div>
        </div>

        {/* News Signals */}
        <NewsSignalsPanel accountId={account.Id} />

        {/* License & Usage - Full Width */}
        {(account.Contract_Total_License_Seats__c || account.Total_Active_Users__c) && (
          <div className="lg:col-span-2 bg-white rounded-xl shadow-md p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">License & Usage</h2>
              <span className="px-3 py-1 bg-blue-100 text-blue-800 text-xs font-semibold rounded-full">
                Axonify
              </span>
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-600 mb-1">Licensed Seats</p>
                <p className="text-2xl font-bold text-gray-900">
                  {(account.Contract_Total_License_Seats__c || account.Total_Hierarchy_Seats__c || 0).toLocaleString()}
                </p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-600 mb-1">Active Users</p>
                <p className="text-2xl font-bold text-gray-900">
                  {(account.Total_Active_Users__c || account.Active_Users_Max__c || 0).toLocaleString()}
                </p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-600 mb-1">Utilization</p>
                <p className={`text-2xl font-bold ${
                  (account.License_Utilization_Max__c || 0) >= 80 ? 'text-green-600' :
                  (account.License_Utilization_Max__c || 0) >= 50 ? 'text-yellow-600' :
                  'text-red-600'
                }`}>
                  {Math.round(account.License_Utilization_Max__c || 0)}%
                </p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-600 mb-1">Health Score</p>
                <p className={`text-2xl font-bold ${
                  (account.Current_Gainsight_Score__c || 0) >= 80 ? 'text-green-600' :
                  (account.Current_Gainsight_Score__c || 0) >= 50 ? 'text-yellow-600' :
                  'text-red-600'
                }`}>
                  {account.Current_Gainsight_Score__c || '\u2014'}
                </p>
              </div>
            </div>

            {/* Utilization by Product */}
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Utilization by Product</h3>
              <div className="space-y-3">
                {account.Active_Users_Learn__c !== undefined && (
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600">Learn</span>
                      <span className="font-medium">
                        {account.Active_Users_Learn__c?.toLocaleString()} users ({Math.round(account.License_Utilization_Learn__c || 0)}%)
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all duration-500 ${
                          (account.License_Utilization_Learn__c || 0) >= 80 ? 'bg-green-500' :
                          (account.License_Utilization_Learn__c || 0) >= 50 ? 'bg-yellow-500' :
                          'bg-red-500'
                        }`}
                        style={{ width: `${Math.min(account.License_Utilization_Learn__c || 0, 100)}%` }}
                      ></div>
                    </div>
                  </div>
                )}
                {account.Active_Users_Comms__c !== undefined && (
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600">Comms</span>
                      <span className="font-medium">
                        {account.Active_Users_Comms__c?.toLocaleString()} users ({Math.round(account.License_Utilization_Comms__c || 0)}%)
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all duration-500 ${
                          (account.License_Utilization_Comms__c || 0) >= 80 ? 'bg-green-500' :
                          (account.License_Utilization_Comms__c || 0) >= 50 ? 'bg-yellow-500' :
                          'bg-red-500'
                        }`}
                        style={{ width: `${Math.min(account.License_Utilization_Comms__c || 0, 100)}%` }}
                      ></div>
                    </div>
                  </div>
                )}
                {account.Active_Users_Tasks__c !== undefined && (
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600">Tasks</span>
                      <span className="font-medium">
                        {account.Active_Users_Tasks__c?.toLocaleString()} users ({Math.round(account.License_Utilization_Tasks__c || 0)}%)
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all duration-500 ${
                          (account.License_Utilization_Tasks__c || 0) >= 80 ? 'bg-green-500' :
                          (account.License_Utilization_Tasks__c || 0) >= 50 ? 'bg-yellow-500' :
                          'bg-red-500'
                        }`}
                        style={{ width: `${Math.min(account.License_Utilization_Tasks__c || 0, 100)}%` }}
                      ></div>
                    </div>
                  </div>
                )}
                {account.Active_Users_Max__c !== undefined && (
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600">Max</span>
                      <span className="font-medium">
                        {account.Active_Users_Max__c?.toLocaleString()} users ({Math.round(account.License_Utilization_Max__c || 0)}%)
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all duration-500 ${
                          (account.License_Utilization_Max__c || 0) >= 80 ? 'bg-green-500' :
                          (account.License_Utilization_Max__c || 0) >= 50 ? 'bg-yellow-500' :
                          'bg-red-500'
                        }`}
                        style={{ width: `${Math.min(account.License_Utilization_Max__c || 0, 100)}%` }}
                      ></div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Usage Trend & Next Steps */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {account.Max_Usage_Trend__c && (
                <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
                  <h4 className="text-sm font-semibold text-blue-900 mb-2">Usage Trend</h4>
                  <p className="text-sm text-gray-700">{account.Max_Usage_Trend__c}</p>
                </div>
              )}
              {account.Usage_Metrics_Next_Steps__c && (
                <div className="bg-amber-50 rounded-lg p-4 border border-amber-100">
                  <h4 className="text-sm font-semibold text-amber-900 mb-2">Next Steps</h4>
                  <p className="text-sm text-gray-700">{account.Usage_Metrics_Next_Steps__c}</p>
                </div>
              )}
            </div>

            {/* Content Studio */}
            {account.Content_Studio_Licenses__c !== undefined && account.Content_Studio_Licenses__c > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Content Studio Licenses</span>
                  <span className="font-semibold text-gray-900">{account.Content_Studio_Licenses__c}</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Related Opportunities */}
      {opportunities && opportunities.length > 0 && (
        <div className="mt-8 bg-white rounded-xl shadow-md p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Related Opportunities</h2>
          <div className="space-y-3">
            {opportunities.map((opp) => (
              <Link
                key={opp.Id}
                to={`/opportunity/${opp.Id}`}
                className="block p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors border border-gray-200"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 mb-1">{opp.Name}</h3>
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <span>{formatCurrency(opp.Amount)}</span>
                      <span>&bull;</span>
                      <span>{opp.StageName}</span>
                      <span>&bull;</span>
                      <span>Close: {formatDate(opp.CloseDate)}</span>
                    </div>
                  </div>
                  {opp.IsAtRisk__c && (
                    <span className="px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800">
                      {'\u26A0\uFE0F'} At Risk
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Gong Call Insights */}
      <GongCallInsights accountId={account.Id} />

      {/* Gong AI Search */}
      <div className="mt-6">
        <GongAISearch
          scope="account"
          accountId={account.Id}
          accountName={account.Name}
        />
      </div>

      {/* AI Assistant */}
      <div className="mt-8">
        <AIAssistant />
      </div>
    </>
  );
}
