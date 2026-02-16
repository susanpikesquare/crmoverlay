/**
 * ScopeSelector Component
 *
 * Segmented control for "My Records" / "My Team's" / "All Records" filtering.
 * Maps to Salesforce ownership scope (OwnerId filter vs no filter).
 */

type OwnershipScope = 'my' | 'team' | 'all';

interface ScopeSelectorProps {
  scope: OwnershipScope;
  onChange: (scope: OwnershipScope) => void;
}

const SCOPE_OPTIONS: { value: OwnershipScope; label: string }[] = [
  { value: 'my', label: 'My Records' },
  { value: 'team', label: "My Team's" },
  { value: 'all', label: 'All Records' },
];

export default function ScopeSelector({ scope, onChange }: ScopeSelectorProps) {
  return (
    <div className="inline-flex rounded-lg border border-gray-300 overflow-hidden">
      {SCOPE_OPTIONS.map((option) => (
        <button
          key={option.value}
          onClick={() => onChange(option.value)}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            scope === option.value
              ? 'bg-purple-600 text-white'
              : 'bg-white text-gray-700 hover:bg-gray-50'
          } ${option.value !== 'my' ? 'border-l border-gray-300' : ''}`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
