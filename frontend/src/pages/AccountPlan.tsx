import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useState, useCallback, useEffect } from 'react';
import apiClient from '../services/api';
import TitleSection from '../components/accountPlan/TitleSection';
import AccountOverviewSection from '../components/accountPlan/AccountOverviewSection';
import RenewalStrategySection from '../components/accountPlan/RenewalStrategySection';
import ExpansionOpportunitiesSection from '../components/accountPlan/ExpansionOpportunitiesSection';
import KeyStakeholdersSection from '../components/accountPlan/KeyStakeholdersSection';
import HealthRiskSection from '../components/accountPlan/HealthRiskSection';
import CSInsightsSection from '../components/accountPlan/CSInsightsSection';
import HistoricalContextSection from '../components/accountPlan/HistoricalContextSection';
import StrategySection from '../components/accountPlan/StrategySection';

interface AccountPlanData {
  id: string;
  salesforceAccountId: string;
  salesforceUserId: string;
  planName: string;
  status: 'draft' | 'active' | 'archived';
  planDate: string;
  accountSnapshot: Record<string, any>;
  renewalOppsSnapshot: Record<string, any>[];
  expansionOppsSnapshot: Record<string, any>[];
  contactsSnapshot: Record<string, any>[];
  executiveSummary: string;
  retentionStrategy: string;
  growthStrategy: string;
  keyInitiatives: string;
  risksAndMitigations: string;
  nextSteps: string;
  additionalNotes: string;
  lastExportedAt: string | null;
  lastExportFormat: string | null;
  createdAt: string;
  updatedAt: string;
}

export default function AccountPlan() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  const { data: plan, isLoading } = useQuery({
    queryKey: ['accountPlan', id],
    queryFn: async () => {
      const response = await apiClient.get(`/api/account-plans/${id}`);
      return response.data.data as AccountPlanData;
    },
    enabled: !!id,
  });

  // Update mutation for strategy text fields
  const updateMutation = useMutation({
    mutationFn: async (updates: Record<string, any>) => {
      const response = await apiClient.put(`/api/account-plans/${id}`, updates);
      return response.data.data;
    },
    onMutate: () => {
      setSaveStatus('saving');
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['accountPlan', id], data);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    },
    onError: () => {
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    },
  });

  // Refresh data mutation
  const refreshMutation = useMutation({
    mutationFn: async () => {
      const response = await apiClient.post(`/api/account-plans/${id}/refresh-data`);
      return response.data.data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['accountPlan', id], data);
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiClient.delete(`/api/account-plans/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accountPlans'] });
      navigate('/account-plans');
    },
  });

  // Export to Word mutation
  const exportWordMutation = useMutation({
    mutationFn: async () => {
      const response = await apiClient.post(`/api/account-plans/${id}/export/word`, {}, {
        responseType: 'blob',
      });
      return response.data;
    },
    onSuccess: (blob) => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${plan?.planName || 'account-plan'}.docx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
      // Refresh to get updated export tracking
      queryClient.invalidateQueries({ queryKey: ['accountPlan', id] });
    },
  });

  const handleFieldChange = useCallback((field: string, value: string) => {
    updateMutation.mutate({ [field]: value });
  }, [updateMutation]);

  const handlePlanNameChange = useCallback((name: string) => {
    updateMutation.mutate({ planName: name });
  }, [updateMutation]);

  const handleStatusChange = useCallback((status: string) => {
    updateMutation.mutate({ status });
  }, [updateMutation]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse">
            <div className="h-32 bg-gray-200 rounded-xl mb-8"></div>
            <div className="grid grid-cols-2 gap-6">
              <div className="h-64 bg-gray-200 rounded-xl"></div>
              <div className="h-64 bg-gray-200 rounded-xl"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-8">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Plan Not Found</h2>
          <p className="text-gray-600 mb-6">The account plan you're looking for doesn't exist.</p>
          <Link
            to="/account-plans"
            className="text-blue-600 hover:text-blue-700 font-medium"
          >
            ← Back to Account Plans
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-8">
        {/* Top Bar */}
        <div className="flex items-center justify-between mb-6">
          <Link
            to="/account-plans"
            className="inline-flex items-center text-gray-600 hover:text-gray-900"
          >
            <span className="mr-2">←</span> Back to Account Plans
          </Link>

          <div className="flex items-center gap-3">
            {/* Save Status Indicator */}
            <span className={`text-xs font-medium px-3 py-1 rounded-full ${
              saveStatus === 'saving' ? 'bg-yellow-100 text-yellow-700' :
              saveStatus === 'saved' ? 'bg-green-100 text-green-700' :
              saveStatus === 'error' ? 'bg-red-100 text-red-700' :
              'bg-transparent'
            }`}>
              {saveStatus === 'saving' ? 'Saving...' :
               saveStatus === 'saved' ? 'Saved' :
               saveStatus === 'error' ? 'Error saving' :
               ''}
            </span>

            <button
              onClick={() => refreshMutation.mutate()}
              disabled={refreshMutation.isPending}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition disabled:opacity-50 flex items-center gap-2"
            >
              <svg className={`w-4 h-4 ${refreshMutation.isPending ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {refreshMutation.isPending ? 'Refreshing...' : 'Refresh Data'}
            </button>

            <button
              onClick={() => exportWordMutation.mutate()}
              disabled={exportWordMutation.isPending}
              className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg hover:from-purple-700 hover:to-blue-700 transition disabled:opacity-50 flex items-center gap-2 shadow-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              {exportWordMutation.isPending ? 'Exporting...' : 'Export to Word'}
            </button>

            <button
              onClick={() => {
                if (window.confirm('Are you sure you want to permanently delete this plan? This cannot be undone.')) {
                  deleteMutation.mutate();
                }
              }}
              disabled={deleteMutation.isPending}
              className="px-4 py-2 text-sm font-medium text-red-600 bg-white border border-red-200 rounded-lg hover:bg-red-50 transition disabled:opacity-50"
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </div>

        {/* Title Section */}
        <div className="mb-8">
          <TitleSection
            account={plan.accountSnapshot}
            planName={plan.planName}
            planDate={plan.planDate}
            status={plan.status}
            onPlanNameChange={handlePlanNameChange}
            onStatusChange={handleStatusChange}
            onDelete={() => {
              if (window.confirm('Are you sure you want to permanently delete this plan? This cannot be undone.')) {
                deleteMutation.mutate();
              }
            }}
          />
        </div>

        {/* SF Data Sections */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <AccountOverviewSection account={plan.accountSnapshot} />
          <HealthRiskSection account={plan.accountSnapshot} />
        </div>

        <div className="mb-8">
          <RenewalStrategySection renewalOpps={plan.renewalOppsSnapshot} />
        </div>

        <div className="mb-8">
          <ExpansionOpportunitiesSection expansionOpps={plan.expansionOppsSnapshot} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <KeyStakeholdersSection
            contacts={plan.contactsSnapshot}
            account={plan.accountSnapshot}
          />
          <CSInsightsSection account={plan.accountSnapshot} />
        </div>

        <div className="mb-8">
          <HistoricalContextSection account={plan.accountSnapshot} />
        </div>

        {/* Strategy / User-authored sections */}
        <div className="mb-8">
          <StrategySection
            executiveSummary={plan.executiveSummary}
            retentionStrategy={plan.retentionStrategy}
            growthStrategy={plan.growthStrategy}
            keyInitiatives={plan.keyInitiatives}
            risksAndMitigations={plan.risksAndMitigations}
            nextSteps={plan.nextSteps}
            additionalNotes={plan.additionalNotes}
            onFieldChange={handleFieldChange}
            saveStatus={saveStatus}
          />
        </div>
      </div>
    </div>
  );
}
