import React, { useState, useRef, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../../services/api';

interface RiskRule {
  id: string;
  name: string;
  objectType: 'Account' | 'Opportunity';
  conditions: Array<{
    field: string;
    operator: '=' | '!=' | '<' | '>' | '<=' | '>=' | 'IN' | 'NOT IN' | 'contains';
    value: any;
  }>;
  logic: 'AND' | 'OR';
  flag: 'at-risk' | 'critical' | 'warning';
  active: boolean;
}

interface Props {
  config: any;
  onSave: (status: 'idle' | 'saving' | 'saved' | 'error') => void;
}

interface SalesforceField {
  name: string;
  label: string;
  type: string;
  custom: boolean;
}

const OPERATORS = [
  { value: '=', label: 'equals' },
  { value: '!=', label: 'not equals' },
  { value: '<', label: 'less than' },
  { value: '>', label: 'greater than' },
  { value: '<=', label: 'less than or equal' },
  { value: '>=', label: 'greater than or equal' },
  { value: 'IN', label: 'in list' },
  { value: 'NOT IN', label: 'not in list' },
  { value: 'contains', label: 'contains' },
];

const FLAG_OPTIONS = [
  { value: 'at-risk', label: 'At Risk', color: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
  { value: 'critical', label: 'Critical', color: 'bg-red-100 text-red-800 border-red-300' },
  { value: 'warning', label: 'Warning', color: 'bg-orange-100 text-orange-800 border-orange-300' },
];

function FieldSelect({ value, onChange, fields, placeholder = "Select a field..." }: {
  value: string;
  onChange: (value: string) => void;
  fields: SalesforceField[];
  placeholder?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      setTimeout(() => searchInputRef.current?.focus(), 0);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const sortedFields = [...fields].sort((a, b) => a.label.localeCompare(b.label));
  const filtered = sortedFields.filter(f => {
    const s = searchTerm.toLowerCase();
    return f.label.toLowerCase().includes(s) || f.name.toLowerCase().includes(s);
  });
  const selectedField = fields.find(f => f.name === value);

  return (
    <div className="relative flex-1" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3 py-2 text-sm text-left border border-gray-300 rounded bg-white hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 flex items-center justify-between"
      >
        <span className={selectedField ? 'text-gray-900 truncate' : 'text-gray-400 truncate'}>
          {selectedField ? `${selectedField.label} (${selectedField.name})` : value || placeholder}
        </span>
        <span className="text-gray-400 ml-1 flex-shrink-0">▼</span>
      </button>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-72 overflow-hidden">
          <div className="p-2 border-b border-gray-200 sticky top-0 bg-white">
            <input
              ref={searchInputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search fields..."
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="overflow-y-auto max-h-56">
            {filtered.length === 0 ? (
              <div className="px-3 py-3 text-sm text-gray-500 text-center">
                No fields found matching "{searchTerm}"
              </div>
            ) : (
              filtered.map(field => (
                <button
                  key={field.name}
                  type="button"
                  onClick={() => {
                    onChange(field.name);
                    setIsOpen(false);
                    setSearchTerm('');
                  }}
                  className={`w-full px-3 py-2 text-sm text-left hover:bg-blue-50 ${
                    value === field.name ? 'bg-blue-100 font-medium' : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span>{field.label}</span>
                    {field.custom && (
                      <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">Custom</span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 font-mono">{field.name}</div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function RiskRulesTab({ config, onSave }: Props) {
  const queryClient = useQueryClient();
  const [rules, setRules] = useState<RiskRule[]>(config.riskRules || []);
  const [editingRule, setEditingRule] = useState<RiskRule | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Fetch available Salesforce fields
  const { data: sfFieldsData } = useQuery({
    queryKey: ['salesforceFields'],
    queryFn: async () => {
      const response = await api.get('/api/admin/salesforce/fields');
      return response.data.data as { accountFields: SalesforceField[]; opportunityFields: SalesforceField[] };
    },
    retry: 1,
  });

  // Get fields for current object type
  const getFieldsForObjectType = (objectType: 'Account' | 'Opportunity'): SalesforceField[] => {
    if (!sfFieldsData) return [];
    return objectType === 'Account' ? sfFieldsData.accountFields : sfFieldsData.opportunityFields;
  };

  const updateRulesMutation = useMutation({
    mutationFn: async (updatedRules: RiskRule[]) => {
      const response = await api.put('/api/admin/config/risk-rules', { rules: updatedRules });
      return response.data;
    },
    onMutate: () => {
      onSave('saving');
    },
    onSuccess: () => {
      onSave('saved');
      queryClient.invalidateQueries({ queryKey: ['adminConfig'] });
      setTimeout(() => onSave('idle'), 2000);
    },
    onError: (error) => {
      console.error('Error updating risk rules:', error);
      onSave('error');
      setTimeout(() => onSave('idle'), 3000);
    },
  });

  const handleSaveRules = () => {
    updateRulesMutation.mutate(rules);
  };

  const handleAddRule = () => {
    const newRule: RiskRule = {
      id: `rule_${Date.now()}`,
      name: 'New Rule',
      objectType: 'Account',
      conditions: [
        { field: '', operator: '=', value: '' }
      ],
      logic: 'AND',
      flag: 'at-risk',
      active: true,
    };
    setEditingRule(newRule);
    setIsCreating(true);
  };

  const handleSaveEditedRule = () => {
    if (!editingRule) return;

    if (isCreating) {
      setRules([...rules, editingRule]);
    } else {
      setRules(rules.map(r => r.id === editingRule.id ? editingRule : r));
    }

    setEditingRule(null);
    setIsCreating(false);
  };

  const handleDeleteRule = (ruleId: string) => {
    if (confirm('Are you sure you want to delete this rule?')) {
      setRules(rules.filter(r => r.id !== ruleId));
    }
  };

  const handleToggleActive = (ruleId: string) => {
    setRules(rules.map(r =>
      r.id === ruleId ? { ...r, active: !r.active } : r
    ));
  };

  const handleAddCondition = () => {
    if (!editingRule) return;
    setEditingRule({
      ...editingRule,
      conditions: [
        ...editingRule.conditions,
        { field: '', operator: '=', value: '' }
      ],
    });
  };

  const handleRemoveCondition = (index: number) => {
    if (!editingRule) return;
    setEditingRule({
      ...editingRule,
      conditions: editingRule.conditions.filter((_, i) => i !== index),
    });
  };

  const handleUpdateCondition = (index: number, field: string, value: any) => {
    if (!editingRule) return;
    const newConditions = [...editingRule.conditions];
    newConditions[index] = { ...newConditions[index], [field]: value };
    setEditingRule({ ...editingRule, conditions: newConditions });
  };

  const getFlagColor = (flag: string) => {
    return FLAG_OPTIONS.find(f => f.value === flag)?.color || 'bg-gray-100 text-gray-800';
  };

  const getFieldLabel = (fieldName: string, objectType: 'Account' | 'Opportunity') => {
    const fields = getFieldsForObjectType(objectType);
    const field = fields.find(f => f.name === fieldName);
    return field ? field.label : fieldName;
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Risk Detection Rules</h3>
          <p className="text-sm text-gray-600 mt-1">
            Define automated rules to flag at-risk accounts and opportunities
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleAddRule}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
          >
            + Add Rule
          </button>
          <button
            onClick={handleSaveRules}
            disabled={updateRulesMutation.isPending}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium disabled:bg-gray-400"
          >
            {updateRulesMutation.isPending ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* Salesforce Fields Status */}
      {!sfFieldsData && (
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-700">
          Loading Salesforce fields... Field names can still be typed manually.
        </div>
      )}

      {/* Rules List */}
      <div className="space-y-4">
        {rules.map((rule) => (
          <div
            key={rule.id}
            className={`border rounded-lg p-4 ${
              rule.active ? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-300 opacity-60'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h4 className="font-semibold text-gray-900">{rule.name}</h4>
                  <span className={`px-2 py-1 text-xs font-medium rounded border ${getFlagColor(rule.flag)}`}>
                    {FLAG_OPTIONS.find(f => f.value === rule.flag)?.label}
                  </span>
                  <span className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded">
                    {rule.objectType}
                  </span>
                  <span className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded">
                    {rule.logic}
                  </span>
                </div>

                {/* Conditions Display */}
                <div className="space-y-1 text-sm text-gray-600">
                  {rule.conditions.map((condition, idx) => (
                    <div key={idx}>
                      {idx > 0 && (
                        <span className="font-medium text-blue-600 mr-2">{rule.logic}</span>
                      )}
                      <span className="font-mono bg-gray-100 px-2 py-0.5 rounded" title={condition.field}>
                        {getFieldLabel(condition.field, rule.objectType)}
                      </span>
                      {' '}
                      <span className="text-gray-500">
                        {OPERATORS.find(op => op.value === condition.operator)?.label}
                      </span>
                      {' '}
                      <span className="font-semibold">{String(condition.value)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleToggleActive(rule.id)}
                  className={`px-3 py-1 text-sm rounded ${
                    rule.active
                      ? 'bg-green-100 text-green-700 hover:bg-green-200'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  {rule.active ? 'Active' : 'Inactive'}
                </button>
                <button
                  onClick={() => {
                    setEditingRule(rule);
                    setIsCreating(false);
                  }}
                  className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDeleteRule(rule.id)}
                  className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}

        {rules.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <p className="mb-4">No risk rules configured</p>
            <button
              onClick={handleAddRule}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Create Your First Rule
            </button>
          </div>
        )}
      </div>

      {/* Rule Editor Modal */}
      {editingRule && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4">
              {isCreating ? 'Create New Rule' : 'Edit Rule'}
            </h3>

            {/* Rule Name */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Rule Name
              </label>
              <input
                type="text"
                value={editingRule.name}
                onChange={(e) => setEditingRule({ ...editingRule, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g., Low Health Score"
              />
            </div>

            {/* Object Type */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Object Type
              </label>
              <select
                value={editingRule.objectType}
                onChange={(e) => {
                  const newObjectType = e.target.value as 'Account' | 'Opportunity';
                  // Clear condition fields when object type changes since available fields differ
                  setEditingRule({
                    ...editingRule,
                    objectType: newObjectType,
                    conditions: editingRule.conditions.map(c => ({ ...c, field: '' })),
                  });
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="Account">Account</option>
                <option value="Opportunity">Opportunity</option>
              </select>
            </div>

            {/* Flag Type */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Flag Type
              </label>
              <select
                value={editingRule.flag}
                onChange={(e) => setEditingRule({ ...editingRule, flag: e.target.value as any })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {FLAG_OPTIONS.map(flag => (
                  <option key={flag.value} value={flag.value}>{flag.label}</option>
                ))}
              </select>
            </div>

            {/* Logic Operator */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Condition Logic
              </label>
              <select
                value={editingRule.logic}
                onChange={(e) => setEditingRule({ ...editingRule, logic: e.target.value as 'AND' | 'OR' })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="AND">AND (all conditions must be true)</option>
                <option value="OR">OR (any condition can be true)</option>
              </select>
            </div>

            {/* Conditions */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  Conditions
                </label>
                <button
                  onClick={handleAddCondition}
                  className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                >
                  + Add Condition
                </button>
              </div>

              {sfFieldsData && (
                <p className="text-xs text-gray-500 mb-2">
                  {editingRule.objectType === 'Account'
                    ? `${sfFieldsData.accountFields.length} Account fields available`
                    : `${sfFieldsData.opportunityFields.length} Opportunity fields available`
                  }
                </p>
              )}

              <div className="space-y-3">
                {editingRule.conditions.map((condition, idx) => (
                  <div key={idx} className="p-3 bg-gray-50 rounded-lg">
                    {idx > 0 && (
                      <div className="text-xs font-medium text-blue-600 mb-2">{editingRule.logic}</div>
                    )}
                    <div className="flex items-center gap-2">
                      <FieldSelect
                        value={condition.field}
                        onChange={(val) => handleUpdateCondition(idx, 'field', val)}
                        fields={getFieldsForObjectType(editingRule.objectType)}
                        placeholder="Select a field..."
                      />
                      <select
                        value={condition.operator}
                        onChange={(e) => handleUpdateCondition(idx, 'operator', e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded text-sm flex-shrink-0"
                      >
                        {OPERATORS.map(op => (
                          <option key={op.value} value={op.value}>{op.label}</option>
                        ))}
                      </select>
                      <input
                        type="text"
                        value={condition.value}
                        onChange={(e) => handleUpdateCondition(idx, 'value', e.target.value)}
                        placeholder="Value"
                        className="w-32 px-3 py-2 border border-gray-300 rounded text-sm flex-shrink-0"
                      />
                      <button
                        onClick={() => handleRemoveCondition(idx)}
                        className="px-2 py-1 text-red-600 hover:bg-red-50 rounded flex-shrink-0"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex justify-end gap-2 mt-6 pt-4 border-t">
              <button
                onClick={() => {
                  setEditingRule(null);
                  setIsCreating(false);
                }}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEditedRule}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                {isCreating ? 'Create Rule' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
