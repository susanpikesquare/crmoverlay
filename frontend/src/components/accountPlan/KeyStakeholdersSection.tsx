import { useState, useMemo } from 'react';

interface KeyStakeholdersSectionProps {
  contacts: Record<string, any>[];
  account: Record<string, any>;
}

function sortContactsByActivity(contacts: Record<string, any>[]): Record<string, any>[] {
  return [...contacts].sort((a, b) => {
    // Contacts with titles rank higher (likely more senior/active)
    const aHasTitle = a.Title ? 1 : 0;
    const bHasTitle = b.Title ? 1 : 0;
    if (bHasTitle !== aHasTitle) return bHasTitle - aHasTitle;

    // Contacts with email + phone rank higher (more complete = more active)
    const aCompleteness = (a.Email ? 1 : 0) + (a.Phone ? 1 : 0) + (a.Department ? 1 : 0);
    const bCompleteness = (b.Email ? 1 : 0) + (b.Phone ? 1 : 0) + (b.Department ? 1 : 0);
    if (bCompleteness !== aCompleteness) return bCompleteness - aCompleteness;

    // Most recently modified first
    const aDate = a.LastModifiedDate || a.CreatedDate || '';
    const bDate = b.LastModifiedDate || b.CreatedDate || '';
    if (aDate && bDate) return new Date(bDate).getTime() - new Date(aDate).getTime();

    return 0;
  });
}

const TOP_COUNT = 8;

export default function KeyStakeholdersSection({ contacts, account }: KeyStakeholdersSectionProps) {
  const [showAll, setShowAll] = useState(false);

  const sorted = useMemo(() => sortContactsByActivity(contacts || []), [contacts]);
  const topContacts = sorted.slice(0, TOP_COUNT);
  const remainingContacts = sorted.slice(TOP_COUNT);
  const displayContacts = showAll ? sorted : topContacts;

  return (
    <div className="bg-white rounded-xl shadow-md p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-900">Key Stakeholders</h2>
        {sorted.length > 0 && (
          <span className="text-xs text-gray-500">{sorted.length} contacts</span>
        )}
      </div>

      {/* Executive Sponsor & Platform Owner from Account */}
      {(account.Sponsorship_Notes__c) && (
        <div className="mb-6 bg-purple-50 rounded-lg p-4 border border-purple-100">
          <p className="text-xs font-medium text-purple-700 uppercase tracking-wide mb-1">Sponsorship Notes</p>
          <p className="text-sm text-gray-900">{account.Sponsorship_Notes__c}</p>
        </div>
      )}

      {/* Contacts Table */}
      {sorted.length > 0 ? (
        <>
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
                {displayContacts.map((contact) => (
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

          {remainingContacts.length > 0 && (
            <button
              onClick={() => setShowAll(!showAll)}
              className="mt-4 w-full py-2 text-sm font-medium text-gray-600 bg-gray-50 rounded-lg hover:bg-gray-100 transition flex items-center justify-center gap-1"
            >
              {showAll ? (
                <>
                  Show Top {TOP_COUNT} Only
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                  </svg>
                </>
              ) : (
                <>
                  Show All {sorted.length} Contacts (+{remainingContacts.length} more)
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </>
              )}
            </button>
          )}
        </>
      ) : (
        <p className="text-gray-500 text-center py-8">No contacts found for this account</p>
      )}
    </div>
  );
}
