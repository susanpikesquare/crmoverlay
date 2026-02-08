interface TitleSectionProps {
  account: Record<string, any>;
  planName: string;
  planDate: string;
  status: string;
  onPlanNameChange: (name: string) => void;
  onStatusChange: (status: string) => void;
  onDelete?: () => void;
}

export default function TitleSection({ account, planName, planDate, status, onPlanNameChange, onStatusChange, onDelete }: TitleSectionProps) {
  const statusColors: Record<string, string> = {
    draft: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    active: 'bg-green-100 text-green-800 border-green-300',
    archived: 'bg-gray-100 text-gray-800 border-gray-300',
  };

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    if (value === 'delete') {
      // Reset dropdown to current status before triggering delete
      e.target.value = status;
      onDelete?.();
    } else {
      onStatusChange(value);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg p-8">
      <div className="flex items-start justify-between mb-6">
        <div className="flex-1">
          <input
            type="text"
            value={planName}
            onChange={(e) => onPlanNameChange(e.target.value)}
            className="text-3xl font-bold text-gray-900 bg-transparent border-none outline-none w-full focus:ring-0 p-0"
            placeholder="Account Plan Name"
          />
          <p className="text-lg text-gray-600 mt-1">{account.Name || 'Unknown Account'}</p>
        </div>
        <select
          value={status}
          onChange={handleStatusChange}
          className={`px-4 py-2 rounded-full text-sm font-semibold border cursor-pointer ${statusColors[status] || statusColors.draft}`}
        >
          <option value="draft">Draft</option>
          <option value="active">Active</option>
          <option value="archived">Archived</option>
          {onDelete && (
            <option value="delete" className="text-red-600">Delete</option>
          )}
        </select>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div>
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Industry</label>
          <p className="text-sm font-medium text-gray-900 mt-1">{account.Industry || '—'}</p>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Parent Account</label>
          <p className="text-sm font-medium text-gray-900 mt-1">{account.Parent?.Name || account.Clay_Parent_Account__c || '—'}</p>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Account Owner</label>
          <p className="text-sm font-medium text-gray-900 mt-1">{account.Owner?.Name || '—'}</p>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">CSM</label>
          <p className="text-sm font-medium text-gray-900 mt-1">{account.CSM_Name__c || account.Owner?.Name || '—'}</p>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Plan Date</label>
          <p className="text-sm font-medium text-gray-900 mt-1">{planDate ? new Date(planDate).toLocaleDateString() : '—'}</p>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Customer Stage</label>
          <p className="text-sm font-medium text-gray-900 mt-1">{account.Customer_Stage__c || '—'}</p>
        </div>
      </div>
    </div>
  );
}
