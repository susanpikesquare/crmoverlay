interface HealthRiskSectionProps {
  account: Record<string, any>;
}

export default function HealthRiskSection({ account }: HealthRiskSectionProps) {
  const riskColor = (risk: string | undefined) => {
    if (!risk) return 'text-gray-500';
    if (risk === 'High') return 'text-red-600';
    if (risk === 'Medium') return 'text-yellow-600';
    return 'text-green-600';
  };

  const scoreColor = (score: number | undefined) => {
    if (score == null) return 'text-gray-500';
    if (score >= 80) return 'text-green-600';
    if (score >= 50) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="bg-white rounded-xl shadow-md p-6">
      <h2 className="text-xl font-bold text-gray-900 mb-6">Health & Risk</h2>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Risk Level</p>
          <p className={`text-xl font-bold mt-1 ${riskColor(account.Risk__c)}`}>
            {account.Risk__c || '—'}
          </p>
        </div>
        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Success Score</p>
          <p className={`text-xl font-bold mt-1 ${scoreColor(account.Customer_Success_Score__c || account.Current_Gainsight_Score__c)}`}>
            {account.Customer_Success_Score__c || account.Current_Gainsight_Score__c || '—'}
          </p>
        </div>
        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Max Utilization</p>
          <p className={`text-xl font-bold mt-1 ${scoreColor(account.License_Utilization_Max__c)}`}>
            {account.License_Utilization_Max__c != null ? `${Math.round(account.License_Utilization_Max__c)}%` : '—'}
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {account.Risk_Notes__c && (
          <div className="bg-red-50 rounded-lg p-4 border border-red-100">
            <p className="text-xs font-medium text-red-700 uppercase tracking-wide mb-1">Risk Notes</p>
            <p className="text-sm text-gray-900 whitespace-pre-line">{account.Risk_Notes__c}</p>
          </div>
        )}

        {account.Overall_Customer_Health_Notes__c && (
          <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
            <p className="text-xs font-medium text-blue-700 uppercase tracking-wide mb-1">Customer Health Notes</p>
            <p className="text-sm text-gray-900 whitespace-pre-line">{account.Overall_Customer_Health_Notes__c}</p>
          </div>
        )}

        {account.Support_Notes__c && (
          <div className="bg-amber-50 rounded-lg p-4 border border-amber-100">
            <p className="text-xs font-medium text-amber-700 uppercase tracking-wide mb-1">Support Notes</p>
            <p className="text-sm text-gray-900 whitespace-pre-line">{account.Support_Notes__c}</p>
          </div>
        )}

        {account.Max_Usage_Trend__c && (
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <p className="text-xs font-medium text-gray-600 uppercase tracking-wide mb-1">Usage Trend</p>
            <p className="text-sm text-gray-900 whitespace-pre-line">{account.Max_Usage_Trend__c}</p>
          </div>
        )}
      </div>
    </div>
  );
}
