interface CSInsightsSectionProps {
  account: Record<string, any>;
}

export default function CSInsightsSection({ account }: CSInsightsSectionProps) {
  const scoreColor = (score: number | undefined) => {
    if (score == null) return 'text-gray-500';
    if (score >= 80) return 'text-green-600';
    if (score >= 50) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="bg-white rounded-xl shadow-md p-6">
      <h2 className="text-xl font-bold text-gray-900 mb-6">CS Insights</h2>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Gainsight Score</p>
          <p className={`text-xl font-bold mt-1 ${scoreColor(account.Current_Gainsight_Score__c)}`}>
            {account.Current_Gainsight_Score__c || '—'}
          </p>
        </div>
        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Last QBR</p>
          <p className="text-sm font-medium text-gray-900 mt-1">
            {account.Last_QBR__c ? new Date(account.Last_QBR__c).toLocaleDateString() : '—'}
          </p>
        </div>
        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Last Exec Check-In</p>
          <p className="text-sm font-medium text-gray-900 mt-1">
            {account.Last_Exec_Check_In__c ? new Date(account.Last_Exec_Check_In__c).toLocaleDateString() : '—'}
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {account.Strategy_Notes__c && (
          <div className="bg-purple-50 rounded-lg p-4 border border-purple-100">
            <p className="text-xs font-medium text-purple-700 uppercase tracking-wide mb-1">Strategy Notes</p>
            <p className="text-sm text-gray-900 whitespace-pre-line">{account.Strategy_Notes__c}</p>
          </div>
        )}

        {account.Contract_Notes__c && (
          <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
            <p className="text-xs font-medium text-blue-700 uppercase tracking-wide mb-1">Contract Notes</p>
            <p className="text-sm text-gray-900 whitespace-pre-line">{account.Contract_Notes__c}</p>
          </div>
        )}

        {account.Usage_Metrics_Next_Steps__c && (
          <div className="bg-amber-50 rounded-lg p-4 border border-amber-100">
            <p className="text-xs font-medium text-amber-700 uppercase tracking-wide mb-1">Usage Metrics Next Steps</p>
            <p className="text-sm text-gray-900 whitespace-pre-line">{account.Usage_Metrics_Next_Steps__c}</p>
          </div>
        )}
      </div>
    </div>
  );
}
