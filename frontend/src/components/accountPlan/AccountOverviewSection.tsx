interface AccountOverviewSectionProps {
  account: Record<string, any>;
}

function formatCurrency(amount: number | undefined | null): string {
  if (amount == null) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function AccountOverviewSection({ account }: AccountOverviewSectionProps) {
  const scoreColor = (pct: number | undefined) => {
    if (pct == null) return 'text-gray-500';
    if (pct >= 80) return 'text-green-600';
    if (pct >= 50) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="bg-white rounded-xl shadow-md p-6">
      <h2 className="text-xl font-bold text-gray-900 mb-6">Account Overview</h2>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Total ARR</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(account.Total_ARR__c)}</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Contracted Users</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            {account.Contract_Total_License_Seats__c?.toLocaleString() || '—'}
          </p>
        </div>
        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Success Score</p>
          <p className={`text-2xl font-bold mt-1 ${scoreColor(account.Customer_Success_Score__c || account.Current_Gainsight_Score__c)}`}>
            {account.Customer_Success_Score__c || account.Current_Gainsight_Score__c || '—'}
          </p>
        </div>
        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Risk</p>
          <p className={`text-2xl font-bold mt-1 ${account.Risk__c === 'High' ? 'text-red-600' : account.Risk__c === 'Medium' ? 'text-yellow-600' : 'text-green-600'}`}>
            {account.Risk__c || '—'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Contract End Date</label>
          <p className="text-sm font-medium text-gray-900 mt-1">
            {account.Agreement_Expiry_Date__c ? new Date(account.Agreement_Expiry_Date__c).toLocaleDateString() : '—'}
          </p>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Customer Stage</label>
          <p className="text-sm font-medium text-gray-900 mt-1">{account.Customer_Stage__c || '—'}</p>
        </div>
      </div>

    </div>
  );
}
