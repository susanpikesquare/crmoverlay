import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import { useState } from 'react';
import apiClient from '../services/api';
import api from '../services/api';
import EditableField from '../components/EditableField';
import AIAssistant from '../components/AIAssistant';
import GongCallInsights from '../components/GongCallInsights';
import GongAISearch from '../components/GongAISearch';

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
  Priority_Score__c: number;
  Priority_Tier__c: string;
  Last_Activity_Date__c: string;
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
  LastModifiedDate: string;

  // Axonify License & Usage Data
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

export default function Account360() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const { data: account, isLoading } = useQuery({
    queryKey: ['account', id],
    queryFn: async () => {
      const response = await apiClient.get(`/api/accounts/${id}`);
      return response.data.data as Account;
    },
    enabled: !!id,
  });

  // Fetch field permissions
  const { data: permissions } = useQuery({
    queryKey: ['accountPermissions', id],
    queryFn: async () => {
      const response = await api.get(`/api/sobjects/Account/${id}/permissions`);
      return response.data.data as Permissions;
    },
    enabled: !!id,
  });

  // Mutation for updating account fields
  const updateAccountMutation = useMutation({
    mutationFn: async ({ fieldName, value }: { fieldName: string; value: any }) => {
      const response = await api.patch(`/api/sobjects/Account/${id}`, {
        [fieldName]: value,
      });
      return response.data.data;
    },
    onSuccess: (updatedAccount, variables) => {
      // Update cache with new data
      queryClient.setQueryData(['account', id], updatedAccount);
      // Show success message
      setSuccessMessage(`Successfully updated ${variables.fieldName}`);
      setTimeout(() => setSuccessMessage(null), 3000);
    },
    onError: (error: any) => {
      console.error('Failed to update account:', error);
    },
  });

  const handleFieldSave = async (fieldName: string, value: any) => {
    await updateAccountMutation.mutateAsync({ fieldName, value });
  };

  const { data: opportunities } = useQuery({
    queryKey: ['accountOpportunities', id],
    queryFn: async () => {
      const response = await apiClient.get(`/api/accounts/${id}/opportunities`);
      return response.data.data as Opportunity[];
    },
    enabled: !!id,
  });

  const { data: authData } = useQuery({
    queryKey: ['auth'],
    queryFn: async () => {
      const response = await apiClient.get('/auth/user');
      return response.data.data;
    },
  });

  const handleViewInSalesforce = () => {
    if (authData?.instanceUrl && account?.Id) {
      window.open(`${authData.instanceUrl}/${account.Id}`, '_blank');
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
        return '🎯';
      case 'Consideration':
        return '🤔';
      case 'Awareness':
        return '💡';
      default:
        return '📊';
    }
  };

  const getPriorityBadgeColor = (tier: string) => {
    if (!tier) return 'bg-gray-100 text-gray-800 border-gray-300';
    if (tier.includes('🔥')) return 'bg-red-100 text-red-800 border-red-300';
    if (tier.includes('🔶')) return 'bg-orange-100 text-orange-800 border-orange-300';
    return 'bg-blue-100 text-blue-800 border-blue-300';
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse">
            <div className="h-32 bg-gray-200 rounded-xl mb-8"></div>
            <div className="grid grid-cols-2 gap-6">
              <div className="h-64 bg-gray-200 rounded-xl"></div>
              <div className="h-64 bg-gray-200 rounded-xl"></div>
              <div className="h-64 bg-gray-200 rounded-xl"></div>
              <div className="h-64 bg-gray-200 rounded-xl"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!account) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-8">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Account Not Found</h2>
          <p className="text-gray-600 mb-6">The account you're looking for doesn't exist.</p>
          <Link
            to="/dashboard"
            className="text-blue-600 hover:text-blue-700 font-medium"
          >
            ← Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-8">
        {/* Success Message */}
        {successMessage && (
          <div className="mb-6 bg-green-50 border border-green-200 text-green-800 px-6 py-4 rounded-xl shadow-sm flex items-center justify-between">
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span className="font-medium">{successMessage}</span>
            </div>
            <button
              onClick={() => setSuccessMessage(null)}
              className="text-green-600 hover:text-green-800"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* Back Button */}
        <Link
          to="/dashboard"
          className="inline-flex items-center text-gray-600 hover:text-gray-900 mb-6"
        >
          <span className="mr-2">←</span> Back to Dashboard
        </Link>

        {/* Header */}
        <div className="bg-white rounded-2xl shadow-lg p-8 mb-8">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-4 mb-3">
                <h1 className="text-3xl font-bold text-gray-900">{account.Name}</h1>
                {account.Priority_Tier__c && (
                  <span
                    className={`px-4 py-1.5 rounded-full text-sm font-semibold border ${getPriorityBadgeColor(
                      account.Priority_Tier__c
                    )}`}
                  >
                    {account.Priority_Tier__c}
                  </span>
                )}
              </div>
              <p className="text-gray-600 mb-4">{account.Industry}</p>
              <div className="flex items-center gap-6 text-sm text-gray-600">
                <div>
                  <span className="font-medium">Priority Score:</span>{' '}
                  <span className="text-gray-900 font-semibold">
                    {account.Priority_Score__c != null ? `${account.Priority_Score__c}/100` : 'N/A'}
                  </span>
                </div>
                {account.LastModifiedDate && (
                  <div>
                    <span className="font-medium">Last Updated:</span>{' '}
                    {formatDate(account.LastModifiedDate)}
                  </div>
                )}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex flex-col gap-3">
              <Link
                to={`/account-plan/new/${id}`}
                className="px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-semibold rounded-lg hover:from-purple-700 hover:to-blue-700 transition shadow-md text-center"
              >
                Create Account Plan
              </Link>
              <button className="px-6 py-3 bg-white border-2 border-gray-300 text-gray-700 font-semibold rounded-lg hover:border-gray-400 transition">
                Create Opportunity
              </button>
              <button className="px-6 py-3 bg-white border-2 border-gray-300 text-gray-700 font-semibold rounded-lg hover:border-gray-400 transition">
                Log Activity
              </button>
              <button
                onClick={handleViewInSalesforce}
                className="px-6 py-3 bg-white border-2 border-gray-300 text-gray-700 font-semibold rounded-lg hover:border-blue-600 hover:text-blue-600 transition flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" />
                  <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" />
                </svg>
                View in Salesforce
              </button>
            </div>
          </div>
        </div>

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
                onSave={handleFieldSave}
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
                onSave={handleFieldSave}
              />

              <EditableField
                value={account.AnnualRevenue}
                fieldName="AnnualRevenue"
                fieldType="currency"
                label="Annual Revenue"
                canEdit={permissions?.fields.AnnualRevenue?.updateable || false}
                onSave={handleFieldSave}
                formatter={formatCurrency}
                className="font-semibold"
              />

              <EditableField
                value={account.NumberOfEmployees}
                fieldName="NumberOfEmployees"
                fieldType="int"
                label="Employee Count (Salesforce)"
                canEdit={permissions?.fields.NumberOfEmployees?.updateable || false}
                onSave={handleFieldSave}
                formatter={(val) => val?.toLocaleString()}
              />

              <div>
                <label className="text-sm font-medium text-gray-600">Employee Count (Clay)</label>
                <div className="flex items-center gap-3 mt-1">
                  <p className="text-gray-900 text-lg font-semibold">
                    {account.Clay_Employee_Count__c?.toLocaleString() || '—'}
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
                <p className="text-gray-900 mt-1">{account.Clay_HRIS_System__c || '—'}</p>
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
                      {account.SixSense_Buying_Stage__c || '—'}
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
                    <span className="text-blue-600 mt-0.5">🔔</span>
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
                    {account.Current_Gainsight_Score__c || '—'}
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
                        <span>•</span>
                        <span>{opp.StageName}</span>
                        <span>•</span>
                        <span>Close: {formatDate(opp.CloseDate)}</span>
                      </div>
                    </div>
                    {opp.IsAtRisk__c && (
                      <span className="px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800">
                        ⚠️ At Risk
                      </span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Gong Call Insights */}
        <GongCallInsights accountId={id} />

        {/* Gong AI Search */}
        <div className="mt-6">
          <GongAISearch
            scope="account"
            accountId={id}
            accountName={account?.Name}
          />
        </div>

        {/* AI Assistant */}
        <div className="mt-8">
          <AIAssistant />
        </div>
      </div>
    </div>
  );
}
