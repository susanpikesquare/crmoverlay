import { useState, useRef, useCallback, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';

export interface LeadershipAsk {
  id: string;
  initiative: string;
  urgency: 'High' | 'Medium' | 'Low';
  action: string;
  owner: string;
  quarter: string;
}

interface LeadershipAsksSectionProps {
  leadershipAsks: LeadershipAsk[] | null;
  onUpdate: (asks: LeadershipAsk[]) => void;
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
}

function EditableCell({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const [localValue, setLocalValue] = useState(value);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setLocalValue(newValue);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => onChange(newValue), 500);
  }, [onChange]);

  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);

  return (
    <input
      type="text"
      value={localValue}
      onChange={handleChange}
      placeholder={placeholder}
      className="w-full px-2 py-1.5 text-sm border-0 bg-transparent focus:ring-1 focus:ring-purple-400 rounded"
    />
  );
}

export default function LeadershipAsksSection({
  leadershipAsks,
  onUpdate,
  saveStatus,
}: LeadershipAsksSectionProps) {
  const asks = leadershipAsks || [];

  const handleFieldChange = useCallback((index: number, field: keyof LeadershipAsk, value: string) => {
    const updated = [...asks];
    updated[index] = { ...updated[index], [field]: value };
    onUpdate(updated);
  }, [asks, onUpdate]);

  const handleAddRow = useCallback(() => {
    onUpdate([...asks, {
      id: uuidv4(),
      initiative: '',
      urgency: 'Medium',
      action: '',
      owner: '',
      quarter: '',
    }]);
  }, [asks, onUpdate]);

  const handleDeleteRow = useCallback((index: number) => {
    const updated = asks.filter((_, i) => i !== index);
    onUpdate(updated);
  }, [asks, onUpdate]);

  return (
    <div className="bg-white rounded-xl shadow-md p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-900">Leadership Asks</h2>
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
            onClick={handleAddRow}
            className="px-3 py-1.5 text-xs font-medium text-purple-700 bg-purple-50 rounded-lg hover:bg-purple-100 transition"
          >
            + Add Row
          </button>
        </div>
      </div>

      {asks.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-4">
          No leadership asks yet. Generate AI Analysis or add manually.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left">
                <th className="px-3 py-2 font-semibold text-gray-700">Initiative</th>
                <th className="px-3 py-2 font-semibold text-gray-700 w-24">Urgency</th>
                <th className="px-3 py-2 font-semibold text-gray-700">Action</th>
                <th className="px-3 py-2 font-semibold text-gray-700 w-32">Owner</th>
                <th className="px-3 py-2 font-semibold text-gray-700 w-20">Quarter</th>
                <th className="px-3 py-2 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {asks.map((ask, index) => (
                <tr key={ask.id} className="hover:bg-gray-50">
                  <td className="px-1 py-1">
                    <EditableCell
                      value={ask.initiative}
                      onChange={(v) => handleFieldChange(index, 'initiative', v)}
                      placeholder="Initiative..."
                    />
                  </td>
                  <td className="px-1 py-1">
                    <select
                      value={ask.urgency}
                      onChange={(e) => handleFieldChange(index, 'urgency', e.target.value)}
                      className={`text-xs font-semibold px-2 py-1 rounded-full border-0 cursor-pointer ${
                        ask.urgency === 'High' ? 'bg-red-100 text-red-700' :
                        ask.urgency === 'Medium' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-green-100 text-green-700'
                      }`}
                    >
                      <option value="High">High</option>
                      <option value="Medium">Medium</option>
                      <option value="Low">Low</option>
                    </select>
                  </td>
                  <td className="px-1 py-1">
                    <EditableCell
                      value={ask.action}
                      onChange={(v) => handleFieldChange(index, 'action', v)}
                      placeholder="Specific action..."
                    />
                  </td>
                  <td className="px-1 py-1">
                    <EditableCell
                      value={ask.owner}
                      onChange={(v) => handleFieldChange(index, 'owner', v)}
                      placeholder="Owner..."
                    />
                  </td>
                  <td className="px-1 py-1">
                    <EditableCell
                      value={ask.quarter}
                      onChange={(v) => handleFieldChange(index, 'quarter', v)}
                      placeholder="Q1"
                    />
                  </td>
                  <td className="px-1 py-1 text-center">
                    <button
                      onClick={() => handleDeleteRow(index)}
                      className="text-gray-400 hover:text-red-500 transition"
                      title="Delete row"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
