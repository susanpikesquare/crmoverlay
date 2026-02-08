import { useState, useEffect, useRef, useCallback } from 'react';

interface StrategySectionProps {
  executiveSummary: string;
  retentionStrategy: string;
  growthStrategy: string;
  keyInitiatives: string;
  risksAndMitigations: string;
  nextSteps: string;
  additionalNotes: string;
  onFieldChange: (field: string, value: string) => void;
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
}

function AutoSaveTextarea({
  label,
  fieldName,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  fieldName: string;
  value: string;
  placeholder: string;
  onChange: (field: string, value: string) => void;
}) {
  const [localValue, setLocalValue] = useState(value);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setLocalValue(newValue);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      onChange(fieldName, newValue);
    }, 500);
  }, [fieldName, onChange]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  return (
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-2">{label}</label>
      <textarea
        value={localValue}
        onChange={handleChange}
        placeholder={placeholder}
        rows={4}
        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 resize-y text-sm text-gray-900 placeholder-gray-400"
      />
    </div>
  );
}

export default function StrategySection({
  executiveSummary,
  retentionStrategy,
  growthStrategy,
  keyInitiatives,
  risksAndMitigations,
  nextSteps,
  additionalNotes,
  onFieldChange,
  saveStatus,
}: StrategySectionProps) {
  return (
    <div className="bg-white rounded-xl shadow-md p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-900">Strategy & Plan</h2>
        <span className={`text-xs font-medium px-3 py-1 rounded-full ${
          saveStatus === 'saving' ? 'bg-yellow-100 text-yellow-700' :
          saveStatus === 'saved' ? 'bg-green-100 text-green-700' :
          saveStatus === 'error' ? 'bg-red-100 text-red-700' :
          'bg-gray-100 text-gray-500'
        }`}>
          {saveStatus === 'saving' ? 'Saving...' :
           saveStatus === 'saved' ? 'Saved' :
           saveStatus === 'error' ? 'Error saving' :
           ''}
        </span>
      </div>

      <div className="space-y-6">
        <AutoSaveTextarea
          label="Executive Summary"
          fieldName="executiveSummary"
          value={executiveSummary}
          placeholder="Provide a high-level summary of the account situation and strategic objectives..."
          onChange={onFieldChange}
        />

        <AutoSaveTextarea
          label="Retention Strategy"
          fieldName="retentionStrategy"
          value={retentionStrategy}
          placeholder="Describe the strategy to retain this account through the renewal period..."
          onChange={onFieldChange}
        />

        <AutoSaveTextarea
          label="Growth Strategy"
          fieldName="growthStrategy"
          value={growthStrategy}
          placeholder="Outline plans for expanding the account (new products, more seats, upsell)..."
          onChange={onFieldChange}
        />

        <AutoSaveTextarea
          label="Key Initiatives"
          fieldName="keyInitiatives"
          value={keyInitiatives}
          placeholder="List specific initiatives and their expected outcomes..."
          onChange={onFieldChange}
        />

        <AutoSaveTextarea
          label="Risks & Mitigations"
          fieldName="risksAndMitigations"
          value={risksAndMitigations}
          placeholder="Identify key risks and the planned mitigation strategies..."
          onChange={onFieldChange}
        />

        <AutoSaveTextarea
          label="Next Steps"
          fieldName="nextSteps"
          value={nextSteps}
          placeholder="Define immediate next steps with owners and target dates..."
          onChange={onFieldChange}
        />

        <AutoSaveTextarea
          label="Additional Notes"
          fieldName="additionalNotes"
          value={additionalNotes}
          placeholder="Any other relevant context, notes, or observations..."
          onChange={onFieldChange}
        />
      </div>
    </div>
  );
}
