import { useState, useRef, useCallback, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';

export interface ActionItem {
  id: string;
  description: string;
  status: 'todo' | 'in_progress' | 'done';
  dueDate: string | null;
  owner: string;
  completedAt: string | null;
  createdAt: string;
  source: 'ai' | 'manual';
}

interface ActionItemsSectionProps {
  actionItems: ActionItem[] | null;
  onUpdate: (items: ActionItem[]) => void;
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
}

type FilterStatus = 'all' | 'todo' | 'in_progress' | 'done';

const statusLabels: Record<string, string> = {
  todo: 'To Do',
  in_progress: 'In Progress',
  done: 'Done',
};

const statusColors: Record<string, string> = {
  todo: 'bg-gray-100 text-gray-700',
  in_progress: 'bg-blue-100 text-blue-700',
  done: 'bg-green-100 text-green-700',
};

function nextStatus(current: string): 'todo' | 'in_progress' | 'done' {
  if (current === 'todo') return 'in_progress';
  if (current === 'in_progress') return 'done';
  return 'todo';
}

function EditableField({
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
}) {
  const [localValue, setLocalValue] = useState(value);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => { setLocalValue(value); }, [value]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newVal = e.target.value;
    setLocalValue(newVal);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => onChange(newVal), 500);
  }, [onChange]);

  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);

  return (
    <input
      type={type}
      value={localValue}
      onChange={handleChange}
      placeholder={placeholder}
      className="w-full px-2 py-1 text-sm border-0 bg-transparent focus:ring-1 focus:ring-purple-400 rounded"
    />
  );
}

export default function ActionItemsSection({
  actionItems,
  onUpdate,
  saveStatus,
}: ActionItemsSectionProps) {
  const [filter, setFilter] = useState<FilterStatus>('all');
  const items = actionItems || [];

  const filteredItems = filter === 'all' ? items : items.filter(item => item.status === filter);

  const handleStatusToggle = useCallback((index: number) => {
    const realIndex = filter === 'all' ? index : items.indexOf(filteredItems[index]);
    const updated = [...items];
    const newStatus = nextStatus(updated[realIndex].status);
    updated[realIndex] = {
      ...updated[realIndex],
      status: newStatus,
      completedAt: newStatus === 'done' ? new Date().toISOString() : null,
    };
    onUpdate(updated);
  }, [items, filteredItems, filter, onUpdate]);

  const handleFieldChange = useCallback((index: number, field: keyof ActionItem, value: string) => {
    const realIndex = filter === 'all' ? index : items.indexOf(filteredItems[index]);
    const updated = [...items];
    updated[realIndex] = { ...updated[realIndex], [field]: value };
    onUpdate(updated);
  }, [items, filteredItems, filter, onUpdate]);

  const handleAddItem = useCallback(() => {
    onUpdate([...items, {
      id: uuidv4(),
      description: '',
      status: 'todo',
      dueDate: null,
      owner: '',
      completedAt: null,
      createdAt: new Date().toISOString(),
      source: 'manual',
    }]);
  }, [items, onUpdate]);

  const handleDeleteItem = useCallback((index: number) => {
    const realIndex = filter === 'all' ? index : items.indexOf(filteredItems[index]);
    onUpdate(items.filter((_, i) => i !== realIndex));
  }, [items, filteredItems, filter, onUpdate]);

  const counts = {
    all: items.length,
    todo: items.filter(i => i.status === 'todo').length,
    in_progress: items.filter(i => i.status === 'in_progress').length,
    done: items.filter(i => i.status === 'done').length,
  };

  return (
    <div className="bg-white rounded-xl shadow-md p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-900">Action Items</h2>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-medium px-3 py-1 rounded-full ${
            saveStatus === 'saving' ? 'bg-yellow-100 text-yellow-700' :
            saveStatus === 'saved' ? 'bg-green-100 text-green-700' :
            saveStatus === 'error' ? 'bg-red-100 text-red-700' :
            'bg-gray-100 text-gray-500'
          }`}>
            {saveStatus === 'saving' ? 'Saving...' :
             saveStatus === 'saved' ? 'Saved' :
             saveStatus === 'error' ? 'Error saving' : ''}
          </span>
          <button
            onClick={handleAddItem}
            className="px-3 py-1.5 text-xs font-medium text-purple-700 bg-purple-50 rounded-lg hover:bg-purple-100 transition"
          >
            + Add Item
          </button>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 mb-4 bg-gray-100 rounded-lg p-1">
        {(['all', 'todo', 'in_progress', 'done'] as FilterStatus[]).map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition ${
              filter === status
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            {status === 'all' ? 'All' : statusLabels[status]} ({counts[status]})
          </button>
        ))}
      </div>

      {filteredItems.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-4">
          {filter === 'all' ? 'No action items yet. Generate AI Analysis or add manually.' : `No ${statusLabels[filter] || filter} items.`}
        </p>
      ) : (
        <div className="space-y-2">
          {filteredItems.map((item, index) => (
            <div
              key={item.id}
              className={`flex items-start gap-3 p-3 rounded-lg border transition ${
                item.status === 'done' ? 'bg-gray-50 border-gray-200' : 'bg-white border-gray-200 hover:border-gray-300'
              }`}
            >
              {/* Status toggle */}
              <button
                onClick={() => handleStatusToggle(index)}
                className="mt-1 flex-shrink-0"
                title={`Click to change status to ${statusLabels[nextStatus(item.status)]}`}
              >
                {item.status === 'done' ? (
                  <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                ) : item.status === 'in_progress' ? (
                  <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                ) : (
                  <div className="w-5 h-5 rounded-full border-2 border-gray-300" />
                )}
              </button>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className={`${item.status === 'done' ? 'line-through text-gray-400' : ''}`}>
                  <EditableField
                    value={item.description}
                    onChange={(v) => handleFieldChange(index, 'description', v)}
                    placeholder="Describe the action item..."
                  />
                </div>
                <div className="flex items-center gap-3 mt-1 flex-wrap">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusColors[item.status]}`}>
                    {statusLabels[item.status]}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    item.source === 'ai' ? 'bg-indigo-50 text-indigo-600' : 'bg-gray-50 text-gray-500'
                  }`}>
                    {item.source === 'ai' ? 'AI' : 'Manual'}
                  </span>
                  <div className="flex items-center gap-1 text-xs text-gray-500">
                    <span>Owner:</span>
                    <EditableField
                      value={item.owner}
                      onChange={(v) => handleFieldChange(index, 'owner', v)}
                      placeholder="Assign..."
                    />
                  </div>
                  <div className="flex items-center gap-1 text-xs text-gray-500">
                    <span>Due:</span>
                    <EditableField
                      type="date"
                      value={item.dueDate || ''}
                      onChange={(v) => handleFieldChange(index, 'dueDate', v)}
                      placeholder=""
                    />
                  </div>
                  {item.completedAt && (
                    <span className="text-xs text-green-600">
                      Completed {new Date(item.completedAt).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>

              {/* Delete */}
              <button
                onClick={() => handleDeleteItem(index)}
                className="text-gray-400 hover:text-red-500 transition flex-shrink-0 mt-1"
                title="Delete item"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
