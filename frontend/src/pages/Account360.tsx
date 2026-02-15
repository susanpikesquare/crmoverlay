import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { useState, useRef, useEffect } from 'react';
import apiClient from '../services/api';
import api from '../services/api';

interface AccountTierOverride {
  accountId: string;
  tier: 'hot' | 'warm' | 'cool' | 'cold' | null;
  overriddenBy: string;
  overriddenAt: string;
  reason?: string;
}
import Account360Tab from '../components/account/Account360Tab';
import ExecSummaryTab from '../components/account/ExecSummaryTab';
import AccountPlanTab from '../components/account/AccountPlanTab';

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

type TabId = '360' | 'exec-summary' | 'plan';

const TABS: { id: TabId; label: string }[] = [
  { id: '360', label: 'Account 360' },
  { id: 'exec-summary', label: 'Exec Summary' },
  { id: 'plan', label: 'Account Plan' },
];

const VALID_TAB_IDS = new Set(TABS.map(t => t.id));

const TIER_CHOICES = [
  { value: 'hot', label: '🔥 Hot', badgeClass: 'bg-red-100 text-red-800 border-red-300' },
  { value: 'warm', label: '🔶 Warm', badgeClass: 'bg-orange-100 text-orange-800 border-orange-300' },
  { value: 'cool', label: '🔵 Cool', badgeClass: 'bg-blue-100 text-blue-800 border-blue-300' },
  { value: 'cold', label: '🥶 Cold', badgeClass: 'bg-cyan-100 text-cyan-800 border-cyan-300' },
  { value: null, label: '⟳ Auto (calculated)', badgeClass: 'bg-gray-100 text-gray-800 border-gray-300' },
] as const;

function TierBadgeDropdown({
  currentTier,
  override,
  onOverride,
  getBadgeColor,
}: {
  currentTier: string;
  override?: AccountTierOverride;
  onOverride: (tier: string | null) => void;
  getBadgeColor: (tier: string) => string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) setIsOpen(false);
    }
    if (isOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const displayTier = override ? TIER_CHOICES.find(t => t.value === override.tier)?.label || currentTier : currentTier;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`px-4 py-1.5 rounded-full text-sm font-semibold border cursor-pointer hover:opacity-80 transition-opacity ${
          override ? getBadgeColor(displayTier) : getBadgeColor(currentTier)
        }`}
        title="Click to override tier"
      >
        {override ? displayTier : currentTier || 'No tier'}
        {override && <span className="ml-1">📌</span>}
      </button>

      {isOpen && (
        <div className="absolute left-0 z-20 mt-2 w-52 bg-white border border-gray-200 rounded-lg shadow-lg py-1">
          {TIER_CHOICES.map((option) => (
            <button
              key={option.value ?? 'auto'}
              onClick={() => {
                onOverride(option.value);
                setIsOpen(false);
              }}
              className={`w-full px-4 py-2 text-sm text-left hover:bg-gray-50 ${
                (override?.tier === option.value) || (!override && option.value === null)
                  ? 'font-semibold bg-gray-50'
                  : ''
              }`}
            >
              {option.label}
            </button>
          ))}

          {override && (
            <div className="border-t border-gray-100 px-4 py-2 text-xs text-gray-500">
              Pinned by {override.overriddenBy}
              <button
                onClick={() => { onOverride(null); setIsOpen(false); }}
                className="ml-2 text-red-500 hover:text-red-700 font-medium"
              >
                Remove
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function Account360() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const tabParam = searchParams.get('tab') || '360';
  const activeTab = VALID_TAB_IDS.has(tabParam as TabId) ? (tabParam as TabId) : '360';

  const setActiveTab = (tabId: TabId) => {
    setSearchParams({ tab: tabId });
  };

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

  // Tier override query & mutation
  const { data: tierOverrides } = useQuery<Record<string, AccountTierOverride>>({
    queryKey: ['tier-overrides'],
    queryFn: async () => {
      const response = await api.get('/api/accounts/tier-overrides');
      return response.data.data;
    },
  });

  const tierOverrideMutation = useMutation({
    mutationFn: async ({ tier }: { tier: string | null }) => {
      const response = await api.put(`/api/accounts/${id}/tier-override`, { tier });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tier-overrides'] });
      queryClient.invalidateQueries({ queryKey: ['ae-priority-accounts'] });
    },
  });

  const currentOverride = id && tierOverrides ? tierOverrides[id] : undefined;

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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getPriorityBadgeColor = (tier: string) => {
    if (!tier) return 'bg-gray-100 text-gray-800 border-gray-300';
    if (tier.includes('\uD83D\uDD25') || tier.includes('Hot')) return 'bg-red-100 text-red-800 border-red-300';
    if (tier.includes('\uD83D\uDD36') || tier.includes('Warm')) return 'bg-orange-100 text-orange-800 border-orange-300';
    if (tier.includes('\uD83E\uDD76') || tier.includes('Cold')) return 'bg-cyan-100 text-cyan-800 border-cyan-300';
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
            {'\u2190'} Back to Dashboard
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
          <span className="mr-2">{'\u2190'}</span> Back to Dashboard
        </Link>

        {/* Header */}
        <div className="bg-white rounded-2xl shadow-lg p-8 mb-8">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-4 mb-3">
                <h1 className="text-3xl font-bold text-gray-900">{account.Name}</h1>
                <TierBadgeDropdown
                  currentTier={account.Priority_Tier__c}
                  override={currentOverride}
                  onOverride={(tier) => tierOverrideMutation.mutate({ tier })}
                  getBadgeColor={getPriorityBadgeColor}
                />
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
              <button
                onClick={() => setActiveTab('plan')}
                className="px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-semibold rounded-lg hover:from-purple-700 hover:to-blue-700 transition shadow-md text-center"
              >
                Account Plan
              </button>
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

        {/* Tab Bar */}
        <div className="flex gap-1 mb-8 border-b border-gray-200">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors border-b-2 ${
                activeTab === tab.id
                  ? 'border-purple-600 text-purple-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === '360' && (
          <Account360Tab
            account={account}
            opportunities={opportunities}
            permissions={permissions}
            authData={authData}
            onFieldSave={handleFieldSave}
            successMessage={successMessage}
            setSuccessMessage={setSuccessMessage}
          />
        )}

        {activeTab === 'exec-summary' && (
          <ExecSummaryTab
            account={account}
            accountId={id!}
            opportunities={opportunities}
          />
        )}

        {activeTab === 'plan' && (
          <AccountPlanTab
            accountId={id!}
            accountName={account.Name}
          />
        )}
      </div>
    </div>
  );
}
