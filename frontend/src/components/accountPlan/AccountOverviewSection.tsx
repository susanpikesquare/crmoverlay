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
  const utilizationColor = (pct: number | undefined) => {
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
            {account.Contract_Total_License_Seats__c?.toLocaleString() || account.of_Axonify_Users__c?.toLocaleString() || '—'}
          </p>
        </div>
        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Success Score</p>
          <p className={`text-2xl font-bold mt-1 ${utilizationColor(account.Customer_Success_Score__c || account.Current_Gainsight_Score__c)}`}>
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

      {/* License Utilization by Product */}
      {(account.License_Utilization_Max__c != null || account.License_Utilization_Learn__c != null) && (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Utilization by Product</h3>
          <div className="space-y-2">
            {[
              { label: 'Max', pct: account.License_Utilization_Max__c, users: account.Active_Users_Max__c },
              { label: 'Learn', pct: account.License_Utilization_Learn__c, users: account.Active_Users_Learn__c },
              { label: 'Comms', pct: account.License_Utilization_Comms__c, users: account.Active_Users_Comms__c },
              { label: 'Tasks', pct: account.License_Utilization_Tasks__c, users: account.Active_Users_Tasks__c },
            ].filter(p => p.pct != null).map(product => (
              <div key={product.label}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600">{product.label}</span>
                  <span className="font-medium">
                    {product.users?.toLocaleString() || 0} users ({Math.round(product.pct || 0)}%)
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all duration-500 ${
                      (product.pct || 0) >= 80 ? 'bg-green-500' :
                      (product.pct || 0) >= 50 ? 'bg-yellow-500' :
                      'bg-red-500'
                    }`}
                    style={{ width: `${Math.min(product.pct || 0, 100)}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
