interface RenewalStrategySectionProps {
  renewalOpps: Record<string, any>[];
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

export default function RenewalStrategySection({ renewalOpps }: RenewalStrategySectionProps) {
  if (!renewalOpps || renewalOpps.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-md p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Renewal Opportunities</h2>
        <p className="text-gray-500 text-center py-8">No open renewal opportunities found</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-md p-6">
      <h2 className="text-xl font-bold text-gray-900 mb-6">Renewal Opportunities</h2>

      <div className="space-y-6">
        {renewalOpps.map((opp) => (
          <div key={opp.Id} className="border border-gray-200 rounded-lg p-5">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="font-semibold text-gray-900 text-lg">{opp.Name}</h3>
                <div className="flex items-center gap-3 mt-1 text-sm text-gray-600">
                  <span>{formatCurrency(opp.Amount || opp.ARR__c)}</span>
                  <span>·</span>
                  <span>{opp.StageName}</span>
                  <span>·</span>
                  <span>Close: {opp.CloseDate ? new Date(opp.CloseDate).toLocaleDateString() : '—'}</span>
                </div>
              </div>
              {opp.Risk__c && (
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                  opp.Risk__c === 'High' ? 'bg-red-100 text-red-800' :
                  opp.Risk__c === 'Medium' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-green-100 text-green-800'
                }`}>
                  {opp.Risk__c} Risk
                </span>
              )}
            </div>

            {/* MEDDPICC Fields */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-4">
              {[
                { label: 'Metrics', value: opp.COM_Metrics__c },
                { label: 'Economic Buyer', value: opp.MEDDPICCR_Economic_Buyer__c || opp.Economic_Buyer_Name__c },
                { label: 'Decision Criteria', value: opp.MEDDPICCR_Decision_Criteria__c },
                { label: 'Decision Process', value: opp.MEDDPICCR_Decision_Process__c },
                { label: 'Paper Process', value: opp.MEDDPICCR_Paper_Process__c },
                { label: 'Implicate Pain', value: opp.MEDDPICCR_Implicate_Pain__c },
                { label: 'Champion', value: opp.MEDDPICCR_Champion__c },
                { label: 'Competition', value: opp.MEDDPICCR_Competition__c },
                { label: 'Risks', value: opp.MEDDPICCR_Risks__c },
              ].filter(f => f.value).map((field) => (
                <div key={field.label} className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{field.label}</p>
                  <p className="text-sm text-gray-900 mt-1 line-clamp-3">{field.value}</p>
                </div>
              ))}
            </div>

            {opp.NextStep && (
              <div className="mt-4 bg-blue-50 rounded-lg p-3 border border-blue-100">
                <p className="text-xs font-medium text-blue-700 uppercase tracking-wide">Next Step</p>
                <p className="text-sm text-gray-900 mt-1">{opp.NextStep}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
