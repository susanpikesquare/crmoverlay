import { useQuery } from '@tanstack/react-query';
import apiClient from '../../services/api';

interface Account {
  Id: string;
  Name: string;
  Industry: string;
  AnnualRevenue: number;
  NumberOfEmployees: number;
  Total_ARR__c?: number;
  Current_Gainsight_Score__c?: number;
  License_Utilization_Max__c?: number;
  Clay_Employee_Count__c: number;
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

interface Props {
  account: Account;
  accountId: string;
  opportunities?: Opportunity[];
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

export default function ExecSummaryTab({ account, accountId, opportunities }: Props) {
  const { data: aiInsights, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['execSummary', accountId],
    queryFn: async () => {
      const response = await apiClient.post('/api/gong/ai-search', {
        scope: 'account',
        query: 'executive summary: relationship health, risks, opportunities, and recommended next steps',
        accountId,
        accountName: account.Name,
      });
      return response.data.data as { answer: string; sources: any[]; metadata: any };
    },
    enabled: !!accountId,
    staleTime: 5 * 60 * 1000,
  });

  // Derived pipeline metrics
  const openOpps = opportunities?.filter(o => o.StageName !== 'Closed Won' && o.StageName !== 'Closed Lost') || [];
  const totalPipelineValue = openOpps.reduce((sum, o) => sum + (o.Amount || 0), 0);
  const atRiskCount = openOpps.filter(o => o.IsAtRisk__c).length;

  const healthScore = account.Current_Gainsight_Score__c;
  const healthColor = !healthScore ? 'text-gray-400' :
    healthScore >= 80 ? 'text-green-600' :
    healthScore >= 50 ? 'text-yellow-600' : 'text-red-600';

  const utilization = account.License_Utilization_Max__c;
  const utilColor = !utilization ? 'text-gray-400' :
    utilization >= 80 ? 'text-green-600' :
    utilization >= 50 ? 'text-yellow-600' : 'text-red-600';

  return (
    <div className="space-y-8">
      {/* Account Snapshot */}
      <div className="bg-white rounded-xl shadow-md p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-6">Account Snapshot</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-gray-50 rounded-lg p-4 text-center">
            <p className="text-sm text-gray-600 mb-1">ARR</p>
            <p className="text-xl font-bold text-gray-900">
              {account.Total_ARR__c ? formatCurrency(account.Total_ARR__c) : '\u2014'}
            </p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4 text-center">
            <p className="text-sm text-gray-600 mb-1">Utilization</p>
            <p className={`text-xl font-bold ${utilColor}`}>
              {utilization != null ? `${Math.round(utilization)}%` : '\u2014'}
            </p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4 text-center">
            <p className="text-sm text-gray-600 mb-1">Health Score</p>
            <p className={`text-xl font-bold ${healthColor}`}>
              {healthScore ?? '\u2014'}
            </p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4 text-center">
            <p className="text-sm text-gray-600 mb-1">Employees</p>
            <p className="text-xl font-bold text-gray-900">
              {(account.Clay_Employee_Count__c || account.NumberOfEmployees || 0).toLocaleString()}
            </p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4 text-center">
            <p className="text-sm text-gray-600 mb-1">Industry</p>
            <p className="text-xl font-bold text-gray-900 truncate" title={account.Industry}>
              {account.Industry || '\u2014'}
            </p>
          </div>
        </div>
      </div>

      {/* Pipeline Summary */}
      <div className="bg-white rounded-xl shadow-md p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-6">Pipeline Summary</h2>
        {openOpps.length === 0 ? (
          <p className="text-gray-500 text-sm">No open opportunities.</p>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-blue-50 rounded-lg p-4 text-center border border-blue-100">
                <p className="text-sm text-blue-700 mb-1">Open Deals</p>
                <p className="text-2xl font-bold text-blue-900">{openOpps.length}</p>
              </div>
              <div className="bg-green-50 rounded-lg p-4 text-center border border-green-100">
                <p className="text-sm text-green-700 mb-1">Total Pipeline</p>
                <p className="text-2xl font-bold text-green-900">{formatCurrency(totalPipelineValue)}</p>
              </div>
              {atRiskCount > 0 && (
                <div className="bg-red-50 rounded-lg p-4 text-center border border-red-100">
                  <p className="text-sm text-red-700 mb-1">At Risk</p>
                  <p className="text-2xl font-bold text-red-900">{atRiskCount}</p>
                </div>
              )}
            </div>
            <div className="space-y-2">
              {openOpps.map(opp => (
                <div key={opp.Id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{opp.Name}</p>
                    <p className="text-xs text-gray-500">{opp.StageName}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-gray-700">{formatCurrency(opp.Amount)}</span>
                    {opp.IsAtRisk__c && (
                      <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800">At Risk</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* AI-Generated Insights: Relationship Health, Risks, Recommended Actions */}
      <div className="bg-white rounded-xl shadow-md p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">AI Executive Insights</h2>
              <p className="text-xs text-gray-500">Generated from Gong calls, emails, and Salesforce data</p>
            </div>
          </div>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition disabled:opacity-50 flex items-center gap-2"
          >
            <svg className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {isFetching ? 'Regenerating...' : 'Regenerate'}
          </button>
        </div>

        {isLoading || isFetching ? (
          <div className="flex items-center gap-3 py-12 justify-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600"></div>
            <p className="text-sm text-gray-600">Generating executive summary...</p>
          </div>
        ) : isError ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-sm text-red-700">Failed to generate executive insights. Please try again.</p>
          </div>
        ) : aiInsights ? (
          <div>
            <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg p-6 border border-purple-200">
              <div className="prose prose-sm max-w-none text-gray-800 whitespace-pre-wrap">
                {aiInsights.answer}
              </div>
            </div>

            {/* Metadata */}
            {aiInsights.metadata && (
              <div className="mt-4 text-xs text-gray-400 flex items-center gap-2">
                <span>
                  Analyzed {aiInsights.metadata.callsAnalyzed} calls,{' '}
                  {aiInsights.metadata.transcriptsFetched} transcripts,{' '}
                  {aiInsights.metadata.emailsAnalyzed} emails
                </span>
                <span>&middot;</span>
                <span>{aiInsights.metadata.lookbackDays}-day lookback</span>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
