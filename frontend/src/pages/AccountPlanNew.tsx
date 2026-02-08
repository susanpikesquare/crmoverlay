import { useMutation, useQuery } from '@tanstack/react-query';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useState } from 'react';
import apiClient from '../services/api';

export default function AccountPlanNew() {
  const { accountId } = useParams<{ accountId: string }>();
  const navigate = useNavigate();
  const [planName, setPlanName] = useState('');

  // Fetch account info for display
  const { data: account, isLoading: loadingAccount } = useQuery({
    queryKey: ['account', accountId],
    queryFn: async () => {
      const response = await apiClient.get(`/api/accounts/${accountId}`);
      return response.data.data;
    },
    enabled: !!accountId,
  });

  // Preview SF data
  const { data: sfData, isLoading: loadingSfData } = useQuery({
    queryKey: ['accountPlanSfData', accountId],
    queryFn: async () => {
      const response = await apiClient.get(`/api/account-plans/sf-data/${accountId}`);
      return response.data.data;
    },
    enabled: !!accountId,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const response = await apiClient.post('/api/account-plans', {
        salesforceAccountId: accountId,
        planName: planName || `${account?.Name || 'Account'} Plan - ${new Date().toLocaleDateString()}`,
      });
      return response.data.data;
    },
    onSuccess: (data) => {
      navigate(`/account-plan/${data.id}`);
    },
  });

  const isLoading = loadingAccount || loadingSfData;

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-3xl mx-auto px-8">
        <Link
          to={`/account/${accountId}`}
          className="inline-flex items-center text-gray-600 hover:text-gray-900 mb-6"
        >
          <span className="mr-2">←</span> Back to Account
        </Link>

        <div className="bg-white rounded-2xl shadow-lg p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Create Account Plan</h1>
          <p className="text-gray-600 mb-8">
            This will snapshot the current Salesforce data for{' '}
            <span className="font-semibold">{account?.Name || 'this account'}</span>.
          </p>

          <div className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Plan Name</label>
              <input
                type="text"
                value={planName}
                onChange={(e) => setPlanName(e.target.value)}
                placeholder={`${account?.Name || 'Account'} Plan - ${new Date().toLocaleDateString()}`}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-sm"
              />
            </div>

            {/* Preview of what will be captured */}
            {isLoading ? (
              <div className="animate-pulse space-y-3">
                <div className="h-4 bg-gray-200 rounded w-48"></div>
                <div className="h-20 bg-gray-100 rounded-lg"></div>
              </div>
            ) : sfData && (
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Data Preview</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-gray-500">Renewal Opps:</span>{' '}
                    <span className="font-medium">{sfData.renewalOpps?.length || 0}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Expansion Opps:</span>{' '}
                    <span className="font-medium">{sfData.expansionOpps?.length || 0}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Contacts:</span>{' '}
                    <span className="font-medium">{sfData.contacts?.length || 0}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">ARR:</span>{' '}
                    <span className="font-medium">
                      {sfData.account?.Total_ARR__c
                        ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(sfData.account.Total_ARR__c)
                        : '—'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-center gap-3 pt-4">
              <button
                onClick={() => createMutation.mutate()}
                disabled={createMutation.isPending}
                className="px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-semibold rounded-lg hover:from-purple-700 hover:to-blue-700 transition shadow-md disabled:opacity-50"
              >
                {createMutation.isPending ? 'Creating...' : 'Create Account Plan'}
              </button>
              <Link
                to={`/account/${accountId}`}
                className="px-6 py-3 text-gray-700 font-medium hover:text-gray-900 transition"
              >
                Cancel
              </Link>
            </div>

            {createMutation.isError && (
              <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg text-sm">
                Failed to create account plan. Please try again.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
