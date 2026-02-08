interface ExpansionOpportunitiesSectionProps {
  expansionOpps: Record<string, any>[];
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

export default function ExpansionOpportunitiesSection({ expansionOpps }: ExpansionOpportunitiesSectionProps) {
  if (!expansionOpps || expansionOpps.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-md p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Expansion Opportunities</h2>
        <p className="text-gray-500 text-center py-8">No open expansion opportunities found</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-md p-6">
      <h2 className="text-xl font-bold text-gray-900 mb-6">Expansion Opportunities</h2>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-3 px-2 font-semibold text-gray-700">Opportunity</th>
              <th className="text-left py-3 px-2 font-semibold text-gray-700">Type</th>
              <th className="text-right py-3 px-2 font-semibold text-gray-700">Amount</th>
              <th className="text-left py-3 px-2 font-semibold text-gray-700">Stage</th>
              <th className="text-left py-3 px-2 font-semibold text-gray-700">Close Date</th>
              <th className="text-left py-3 px-2 font-semibold text-gray-700">Owner</th>
            </tr>
          </thead>
          <tbody>
            {expansionOpps.map((opp) => (
              <tr key={opp.Id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="py-3 px-2">
                  <p className="font-medium text-gray-900">{opp.Name}</p>
                  {opp.Use_Cases__c && (
                    <p className="text-xs text-gray-500 mt-0.5">{opp.Use_Cases__c}</p>
                  )}
                </td>
                <td className="py-3 px-2">
                  <span className="px-2 py-1 bg-purple-50 text-purple-700 text-xs font-medium rounded-full">
                    {opp.Type || 'Expansion'}
                  </span>
                </td>
                <td className="py-3 px-2 text-right font-medium text-gray-900">
                  {formatCurrency(opp.Amount || opp.ARR__c)}
                </td>
                <td className="py-3 px-2 text-gray-700">{opp.StageName || '—'}</td>
                <td className="py-3 px-2 text-gray-700">
                  {opp.CloseDate ? new Date(opp.CloseDate).toLocaleDateString() : '—'}
                </td>
                <td className="py-3 px-2 text-gray-700">{opp.Owner?.Name || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Total */}
      <div className="mt-4 pt-4 border-t border-gray-200 flex justify-between items-center">
        <span className="text-sm font-semibold text-gray-700">Total Expansion Pipeline</span>
        <span className="text-lg font-bold text-gray-900">
          {formatCurrency(expansionOpps.reduce((sum, opp) => sum + (opp.Amount || opp.ARR__c || 0), 0))}
        </span>
      </div>
    </div>
  );
}
