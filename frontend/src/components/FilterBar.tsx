/**
 * FilterBar Component
 *
 * Report-style filter bar with "Add Filter" capability.
 * Supports field + operator + value filter criteria.
 * Displays active filters as removable chips.
 */

import { useState } from 'react';

export type FilterOperator =
  | 'eq' | 'neq' | 'lt' | 'gt' | 'lte' | 'gte'
  | 'contains' | 'in' | 'not_in' | 'between';

export interface FilterCriteria {
  field: string;
  operator: FilterOperator;
  value: string | number | string[];
}

interface FieldDefinition {
  name: string;
  label: string;
  type: 'string' | 'number' | 'date' | 'picklist';
  picklistValues?: string[];
}

interface FilterBarProps {
  filters: FilterCriteria[];
  onAddFilter: (filter: FilterCriteria) => void;
  onRemoveFilter: (index: number) => void;
  onClearAll: () => void;
  fields: FieldDefinition[];
}

const OPERATOR_LABELS: Record<FilterOperator, string> = {
  eq: 'equals',
  neq: 'not equals',
  lt: 'less than',
  gt: 'greater than',
  lte: 'at most',
  gte: 'at least',
  contains: 'contains',
  in: 'in',
  not_in: 'not in',
  between: 'between',
};

const OPERATORS_BY_TYPE: Record<string, FilterOperator[]> = {
  string: ['eq', 'neq', 'contains'],
  number: ['eq', 'neq', 'lt', 'gt', 'lte', 'gte'],
  date: ['eq', 'lt', 'gt', 'lte', 'gte'],
  picklist: ['eq', 'neq', 'in'],
};

export default function FilterBar({ filters, onAddFilter, onRemoveFilter, onClearAll, fields }: FilterBarProps) {
  const [showAddFilter, setShowAddFilter] = useState(false);
  const [selectedField, setSelectedField] = useState('');
  const [selectedOperator, setSelectedOperator] = useState<FilterOperator>('eq');
  const [filterValue, setFilterValue] = useState('');

  const selectedFieldDef = fields.find(f => f.name === selectedField);
  const availableOperators = selectedFieldDef
    ? OPERATORS_BY_TYPE[selectedFieldDef.type] || OPERATORS_BY_TYPE.string
    : OPERATORS_BY_TYPE.string;

  const handleAdd = () => {
    if (!selectedField || !filterValue) return;

    const value = selectedFieldDef?.type === 'number'
      ? parseFloat(filterValue)
      : filterValue;

    onAddFilter({
      field: selectedField,
      operator: selectedOperator,
      value,
    });

    // Reset form
    setSelectedField('');
    setSelectedOperator('eq');
    setFilterValue('');
    setShowAddFilter(false);
  };

  const getFilterLabel = (filter: FilterCriteria) => {
    const fieldDef = fields.find(f => f.name === filter.field);
    const fieldLabel = fieldDef?.label || filter.field;
    const opLabel = OPERATOR_LABELS[filter.operator] || filter.operator;
    const valueStr = Array.isArray(filter.value)
      ? filter.value.join(', ')
      : String(filter.value);
    return `${fieldLabel} ${opLabel} ${valueStr}`;
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Active filters as chips */}
      {filters.map((filter, index) => (
        <span
          key={index}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 text-purple-800 rounded-full text-sm font-medium border border-purple-200"
        >
          {getFilterLabel(filter)}
          <button
            onClick={() => onRemoveFilter(index)}
            className="ml-1 text-purple-500 hover:text-purple-700"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </span>
      ))}

      {/* Clear all button */}
      {filters.length > 0 && (
        <button
          onClick={onClearAll}
          className="text-sm text-gray-500 hover:text-gray-700 underline"
        >
          Clear all
        </button>
      )}

      {/* Add filter button / inline form */}
      {showAddFilter ? (
        <div className="flex items-center gap-2 bg-white border border-gray-300 rounded-lg p-2">
          <select
            value={selectedField}
            onChange={(e) => {
              setSelectedField(e.target.value);
              setSelectedOperator('eq');
              setFilterValue('');
            }}
            className="text-sm border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-purple-500"
          >
            <option value="">Select field...</option>
            {fields.map(f => (
              <option key={f.name} value={f.name}>{f.label}</option>
            ))}
          </select>

          {selectedField && (
            <select
              value={selectedOperator}
              onChange={(e) => setSelectedOperator(e.target.value as FilterOperator)}
              className="text-sm border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-purple-500"
            >
              {availableOperators.map(op => (
                <option key={op} value={op}>{OPERATOR_LABELS[op]}</option>
              ))}
            </select>
          )}

          {selectedField && selectedFieldDef?.type === 'picklist' && selectedFieldDef.picklistValues ? (
            <select
              value={filterValue}
              onChange={(e) => setFilterValue(e.target.value)}
              className="text-sm border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-purple-500"
            >
              <option value="">Select value...</option>
              {selectedFieldDef.picklistValues.map(v => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          ) : selectedField ? (
            <input
              type={selectedFieldDef?.type === 'number' ? 'number' : 'text'}
              placeholder="Value..."
              value={filterValue}
              onChange={(e) => setFilterValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); }}
              className="text-sm border border-gray-200 rounded px-2 py-1.5 w-32 focus:outline-none focus:ring-1 focus:ring-purple-500"
            />
          ) : null}

          <button
            onClick={handleAdd}
            disabled={!selectedField || !filterValue}
            className="text-sm px-3 py-1.5 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Apply
          </button>
          <button
            onClick={() => { setShowAddFilter(false); setSelectedField(''); setFilterValue(''); }}
            className="text-sm px-2 py-1.5 text-gray-500 hover:text-gray-700"
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          onClick={() => setShowAddFilter(true)}
          className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 border border-dashed border-gray-300 rounded-full hover:border-gray-400 transition"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Filter
        </button>
      )}
    </div>
  );
}
