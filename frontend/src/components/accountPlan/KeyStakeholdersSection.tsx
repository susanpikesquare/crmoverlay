interface KeyStakeholdersSectionProps {
  contacts: Record<string, any>[];
  account: Record<string, any>;
}

export default function KeyStakeholdersSection({ contacts, account }: KeyStakeholdersSectionProps) {
  return (
    <div className="bg-white rounded-xl shadow-md p-6">
      <h2 className="text-xl font-bold text-gray-900 mb-6">Key Stakeholders</h2>

      {/* Executive Sponsor & Platform Owner from Account */}
      {(account.Sponsorship_Notes__c) && (
        <div className="mb-6 bg-purple-50 rounded-lg p-4 border border-purple-100">
          <p className="text-xs font-medium text-purple-700 uppercase tracking-wide mb-1">Sponsorship Notes</p>
          <p className="text-sm text-gray-900">{account.Sponsorship_Notes__c}</p>
        </div>
      )}

      {/* Contacts Table */}
      {contacts && contacts.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-2 font-semibold text-gray-700">Name</th>
                <th className="text-left py-3 px-2 font-semibold text-gray-700">Title</th>
                <th className="text-left py-3 px-2 font-semibold text-gray-700">Department</th>
                <th className="text-left py-3 px-2 font-semibold text-gray-700">Email</th>
                <th className="text-left py-3 px-2 font-semibold text-gray-700">Phone</th>
              </tr>
            </thead>
            <tbody>
              {contacts.map((contact) => (
                <tr key={contact.Id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-3 px-2">
                    <p className="font-medium text-gray-900">
                      {contact.Name || `${contact.FirstName || ''} ${contact.LastName || ''}`.trim()}
                    </p>
                  </td>
                  <td className="py-3 px-2 text-gray-700">{contact.Title || '—'}</td>
                  <td className="py-3 px-2 text-gray-700">{contact.Department || '—'}</td>
                  <td className="py-3 px-2">
                    {contact.Email ? (
                      <a href={`mailto:${contact.Email}`} className="text-blue-600 hover:text-blue-800">
                        {contact.Email}
                      </a>
                    ) : '—'}
                  </td>
                  <td className="py-3 px-2 text-gray-700">{contact.Phone || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-gray-500 text-center py-8">No contacts found for this account</p>
      )}
    </div>
  );
}
