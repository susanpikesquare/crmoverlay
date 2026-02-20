import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useCallback } from 'react';
import apiClient from '../../services/api';
import TitleSection from '../accountPlan/TitleSection';
import AccountOverviewSection from '../accountPlan/AccountOverviewSection';
import RenewalStrategySection from '../accountPlan/RenewalStrategySection';
import ExpansionOpportunitiesSection from '../accountPlan/ExpansionOpportunitiesSection';
import KeyStakeholdersSection from '../accountPlan/KeyStakeholdersSection';
import HealthRiskSection from '../accountPlan/HealthRiskSection';
import CSInsightsSection from '../accountPlan/CSInsightsSection';
import HistoricalContextSection from '../accountPlan/HistoricalContextSection';
import StrategySection from '../accountPlan/StrategySection';
import AIAnalysisSection, { AIAnalysisData } from '../accountPlan/AIAnalysisSection';
import LeadershipAsksSection, { LeadershipAsk } from '../accountPlan/LeadershipAsksSection';
import DayPlanSection, { DayPlans } from '../accountPlan/DayPlanSection';
import ActionItemsSection, { ActionItem } from '../accountPlan/ActionItemsSection';

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
  aiAnalysis: AIAnalysisData | null;
  leadershipAsks: LeadershipAsk[] | null;
  dayPlans: DayPlans | null;
  actionItems: ActionItem[] | null;
  lastExportedAt: string | null;
  lastExportFormat: string | null;
  createdAt: string;
  updatedAt: string;
}

interface PlanListItem {
  id: string;
  salesforceAccountId: string;
  planName: string;
  status: string;
  accountName: string;
  updatedAt: string;
}

interface Props {
  accountId: string;
  accountName: string;
}

export default function AccountPlanTab({ accountId, accountName }: Props) {
  const queryClient = useQueryClient();
  const [planName, setPlanName] = useState('');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  // Find existing plan for this account
  const { data: plansForAccount, isLoading: isLoadingPlans } = useQuery({
    queryKey: ['accountPlansForAccount', accountId],
    queryFn: async () => {
      const response = await apiClient.get(`/api/account-plans?accountId=${accountId}`);
      return response.data.data as PlanListItem[];
    },
    enabled: !!accountId,
  });

  const existingPlanId = plansForAccount && plansForAccount.length > 0 ? plansForAccount[0].id : null;

  // Fetch full plan data if plan exists
  const { data: plan, isLoading: isLoadingPlan } = useQuery({
    queryKey: ['accountPlan', existingPlanId],
    queryFn: async () => {
      const response = await apiClient.get(`/api/account-plans/${existingPlanId}`);
      return response.data.data as AccountPlanData;
    },
    enabled: !!existingPlanId,
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async () => {
      const response = await apiClient.post('/api/account-plans', {
        salesforceAccountId: accountId,
        planName: planName || `${accountName} Plan - ${new Date().toLocaleDateString()}`,
      });
      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accountPlansForAccount', accountId] });
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (updates: Record<string, any>) => {
      const response = await apiClient.put(`/api/account-plans/${existingPlanId}`, updates);
      return response.data.data;
    },
    onMutate: () => {
      setSaveStatus('saving');
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['accountPlan', existingPlanId], data);
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
      const response = await apiClient.post(`/api/account-plans/${existingPlanId}/refresh-data`);
      return response.data.data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['accountPlan', existingPlanId], data);
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiClient.delete(`/api/account-plans/${existingPlanId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accountPlansForAccount', accountId] });
      queryClient.invalidateQueries({ queryKey: ['accountPlans'] });
    },
  });

  // Export to Word mutation
  const exportWordMutation = useMutation({
    mutationFn: async () => {
      const response = await apiClient.post(`/api/account-plans/${existingPlanId}/export/word`, {}, {
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
      queryClient.invalidateQueries({ queryKey: ['accountPlan', existingPlanId] });
    },
  });

  // Generate AI analysis mutation
  const generateAIMutation = useMutation({
    mutationFn: async () => {
      const response = await apiClient.post(`/api/account-plans/${existingPlanId}/generate-ai`);
      return response.data.data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['accountPlan', existingPlanId], data);
    },
  });

  const handleFieldChange = useCallback((field: string, value: string) => {
    updateMutation.mutate({ [field]: value });
  }, [updateMutation]);

  const handleAIFieldChange = useCallback((key: string, value: string) => {
    if (!plan?.aiAnalysis) return;
    const updatedAnalysis = { ...plan.aiAnalysis, [key]: value };
    updateMutation.mutate({ aiAnalysis: updatedAnalysis });
  }, [plan, updateMutation]);

  const handleLeadershipAsksUpdate = useCallback((asks: LeadershipAsk[]) => {
    updateMutation.mutate({ leadershipAsks: asks });
  }, [updateMutation]);

  const handleDayPlanFieldChange = useCallback((key: string, value: string) => {
    const currentPlans = plan?.dayPlans || { thirtyDay: '', sixtyDay: '', ninetyDay: '' };
    const updatedPlans = { ...currentPlans, [key]: value };
    updateMutation.mutate({ dayPlans: updatedPlans });
  }, [plan, updateMutation]);

  const handleActionItemsUpdate = useCallback((items: ActionItem[]) => {
    updateMutation.mutate({ actionItems: items });
  }, [updateMutation]);

  const handlePlanNameChange = useCallback((name: string) => {
    updateMutation.mutate({ planName: name });
  }, [updateMutation]);

  const handleStatusChange = useCallback((status: string) => {
    updateMutation.mutate({ status });
  }, [updateMutation]);

  const handleDelete = () => {
    if (window.confirm('Are you sure you want to permanently delete this plan? This cannot be undone.')) {
      deleteMutation.mutate();
    }
  };

  // Loading state
  if (isLoadingPlans || (existingPlanId && isLoadingPlan)) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-32 bg-gray-200 rounded-xl"></div>
        <div className="grid grid-cols-2 gap-6">
          <div className="h-64 bg-gray-200 rounded-xl"></div>
          <div className="h-64 bg-gray-200 rounded-xl"></div>
        </div>
      </div>
    );
  }

  // No plan exists — show create card
  if (!existingPlanId) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl shadow-lg p-8">
          <div className="text-center mb-6">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-purple-100 to-blue-100 flex items-center justify-center">
              <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Create Account Plan</h2>
            <p className="text-gray-600">
              This will snapshot the current Salesforce data for{' '}
              <span className="font-semibold">{accountName}</span>.
            </p>
          </div>

          <div className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Plan Name</label>
              <input
                type="text"
                value={planName}
                onChange={(e) => setPlanName(e.target.value)}
                placeholder={`${accountName} Plan - ${new Date().toLocaleDateString()}`}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-sm"
              />
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => createMutation.mutate()}
                disabled={createMutation.isPending}
                className="px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-semibold rounded-lg hover:from-purple-700 hover:to-blue-700 transition shadow-md disabled:opacity-50"
              >
                {createMutation.isPending ? 'Creating...' : 'Create Account Plan'}
              </button>
            </div>

            {createMutation.isError && (
              <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg text-sm">
                Failed to create account plan. Please try again.
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Plan exists — show full inline plan
  if (!plan) return null;

  return (
    <div>
      {/* Inline Toolbar */}
      <div className="flex items-center justify-end gap-3 mb-6">
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
          onClick={handleDelete}
          disabled={deleteMutation.isPending}
          className="px-4 py-2 text-sm font-medium text-red-600 bg-white border border-red-200 rounded-lg hover:bg-red-50 transition disabled:opacity-50"
        >
          {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
        </button>
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
          onDelete={handleDelete}
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

      {/* AI Analysis Section */}
      <div className="mb-8">
        <AIAnalysisSection
          aiAnalysis={plan.aiAnalysis}
          onFieldChange={handleAIFieldChange}
          onGenerate={() => generateAIMutation.mutate()}
          isGenerating={generateAIMutation.isPending}
          saveStatus={saveStatus}
        />
      </div>

      {generateAIMutation.isError && (
        <div className="mb-8 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg text-sm">
          Failed to generate AI analysis. Please try again.
        </div>
      )}

      {/* Leadership Asks */}
      <div className="mb-8">
        <LeadershipAsksSection
          leadershipAsks={plan.leadershipAsks}
          onUpdate={handleLeadershipAsksUpdate}
          saveStatus={saveStatus}
        />
      </div>

      {/* 30/60/90 Day Plan */}
      <div className="mb-8">
        <DayPlanSection
          dayPlans={plan.dayPlans}
          onFieldChange={handleDayPlanFieldChange}
          saveStatus={saveStatus}
        />
      </div>

      {/* Action Items */}
      <div className="mb-8">
        <ActionItemsSection
          actionItems={plan.actionItems}
          onUpdate={handleActionItemsUpdate}
          saveStatus={saveStatus}
        />
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
  );
}
