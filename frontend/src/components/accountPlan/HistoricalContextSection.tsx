interface HistoricalContextSectionProps {
  account: Record<string, any>;
}

export default function HistoricalContextSection({ account }: HistoricalContextSectionProps) {
  return (
    <div className="bg-white rounded-xl shadow-md p-6">
      <h2 className="text-xl font-bold text-gray-900 mb-6">Historical Context</h2>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div>
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Account Created</label>
          <p className="text-sm font-medium text-gray-900 mt-1">
            {account.CreatedDate ? new Date(account.CreatedDate).toLocaleDateString() : '—'}
          </p>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Launch Date</label>
          <p className="text-sm font-medium text-gray-900 mt-1">
            {account.Launch_Date__c ? new Date(account.Launch_Date__c).toLocaleDateString() : '—'}
          </p>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Contract End</label>
          <p className="text-sm font-medium text-gray-900 mt-1">
            {account.Agreement_Expiry_Date__c ? new Date(account.Agreement_Expiry_Date__c).toLocaleDateString() : '—'}
          </p>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Last QBR</label>
          <p className="text-sm font-medium text-gray-900 mt-1">
            {account.Last_QBR__c ? new Date(account.Last_QBR__c).toLocaleDateString() : '—'}
          </p>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Last Exec Check-In</label>
          <p className="text-sm font-medium text-gray-900 mt-1">
            {account.Last_Exec_Check_In__c ? new Date(account.Last_Exec_Check_In__c).toLocaleDateString() : '—'}
          </p>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Account Owner</label>
          <p className="text-sm font-medium text-gray-900 mt-1">{account.Owner?.Name || '—'}</p>
        </div>
      </div>

      <div className="mt-6 space-y-4">
        <div>
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Industry</label>
          <p className="text-sm text-gray-900 mt-1">{account.Industry || '—'}</p>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Location</label>
          <p className="text-sm text-gray-900 mt-1">
            {[account.BillingCity, account.BillingState, account.BillingCountry]
              .filter(Boolean)
              .join(', ') || '—'}
          </p>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Website</label>
          {account.Website ? (
            <a
              href={account.Website.startsWith('http') ? account.Website : `https://${account.Website}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-600 hover:text-blue-800 mt-1 block"
            >
              {account.Website}
            </a>
          ) : (
            <p className="text-sm text-gray-900 mt-1">—</p>
          )}
        </div>
      </div>
    </div>
  );
}
