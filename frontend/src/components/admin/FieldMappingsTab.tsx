import React, { useState, useRef, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../../services/api';

interface FieldMapping {
  conceptName: string;
  category: string;
  salesforceField: string | null;
  calculateInApp: boolean;
}

interface Props {
  config: any;
  onSave: (status: 'idle' | 'saving' | 'saved' | 'error') => void;
}

interface SearchableFieldSelectProps {
  value: string | null;
  onChange: (value: string | null) => void;
  fields: Array<{ name: string; label: string }>;
  placeholder?: string;
  disabled?: boolean;
}

const CATEGORIES = [
  { id: 'clay', label: 'Clay Enrichment', icon: '🏺', color: 'bg-purple-100 text-purple-800' },
  { id: '6sense', label: '6sense Intent', icon: '🎯', color: 'bg-blue-100 text-blue-800' },
  { id: 'health', label: 'Health & Status', icon: '💚', color: 'bg-green-100 text-green-800' },
  { id: 'meddpicc', label: 'MEDDPICC', icon: '📊', color: 'bg-orange-100 text-orange-800' },
  { id: 'other', label: 'Other', icon: '📌', color: 'bg-gray-100 text-gray-800' },
];

function SearchableFieldSelect({ value, onChange, fields, placeholder = "-- Select Field --", disabled = false }: SearchableFieldSelectProps) {
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

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const sortedFields = [...fields].sort((a, b) => a.label.localeCompare(b.label));

  const filteredFields = sortedFields.filter(field => {
    const searchLower = searchTerm.toLowerCase();
    return (
      field.label.toLowerCase().includes(searchLower) ||
      field.name.toLowerCase().includes(searchLower)
    );
  });

  const selectedField = fields.find(f => f.name === value);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className="w-full px-3 py-2 text-sm text-left border border-gray-300 rounded bg-white hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed flex items-center justify-between"
      >
        <span className={selectedField ? 'text-gray-900' : 'text-gray-500'}>
          {selectedField ? `${selectedField.label} (${selectedField.name})` : placeholder}
        </span>
        <span className="text-gray-400">▼</span>
      </button>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-80 overflow-hidden">
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
          <div className="overflow-y-auto max-h-64">
            <button
              type="button"
              onClick={() => {
                onChange(null);
                setIsOpen(false);
                setSearchTerm('');
              }}
              className="w-full px-3 py-2 text-sm text-left hover:bg-gray-100 text-gray-500 italic"
            >
              {placeholder}
            </button>
            {filteredFields.length === 0 ? (
              <div className="px-3 py-2 text-sm text-gray-500 text-center">
                No fields found
              </div>
            ) : (
              filteredFields.map(field => (
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
                  <div>{field.label}</div>
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

export default function FieldMappingsTab({ config, onSave }: Props) {
  const queryClient = useQueryClient();
  const [mappings, setMappings] = useState<FieldMapping[]>(config.fieldMappings || []);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [newMapping, setNewMapping] = useState<FieldMapping | null>(null);

  // Fetch available Salesforce fields
  const { data: sfFieldsData, isLoading: isLoadingFields } = useQuery({
    queryKey: ['salesforceFields'],
    queryFn: async () => {
      const response = await api.get('/api/admin/salesforce/fields');
      return response.data.data;
    },
    retry: 1,
  });

  const updateMappingsMutation = useMutation({
    mutationFn: async (updatedMappings: FieldMapping[]) => {
      const response = await api.put('/api/admin/config/field-mappings', {
        mappings: updatedMappings,
      });
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
      console.error('Error updating field mappings:', error);
      onSave('error');
      setTimeout(() => onSave('idle'), 3000);
    },
  });

  const handleSave = () => {
    updateMappingsMutation.mutate(mappings);
  };

  const handleUpdateMapping = (conceptName: string, field: keyof FieldMapping, value: any) => {
    setMappings(mappings.map(m =>
      m.conceptName === conceptName ? { ...m, [field]: value } : m
    ));
  };

  const handleAddMapping = () => {
    if (!newMapping) {
      setNewMapping({
        conceptName: '',
        category: 'other',
        salesforceField: null,
        calculateInApp: false,
      });
    }
  };

  const handleSaveNewMapping = () => {
    if (!newMapping || !newMapping.conceptName) {
      alert('Concept name is required');
      return;
    }

    setMappings([...mappings, newMapping]);
    setNewMapping(null);
  };

  const handleDeleteMapping = (conceptName: string) => {
    if (confirm('Are you sure you want to delete this mapping?')) {
      setMappings(mappings.filter(m => m.conceptName !== conceptName));
    }
  };

  const filteredMappings = selectedCategory === 'all'
    ? mappings
    : mappings.filter(m => m.category === selectedCategory);

  const getCategoryInfo = (categoryId: string) => {
    return CATEGORIES.find(c => c.id === categoryId) || CATEGORIES[CATEGORIES.length - 1];
  };

  const allSalesforceFields = [
    ...(sfFieldsData?.accountFields || []),
    ...(sfFieldsData?.opportunityFields || []),
  ];

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Field Mappings</h3>
          <p className="text-sm text-gray-600 mt-1">
            Map Salesforce custom fields to application concepts
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleAddMapping}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
          >
            + Add Mapping
          </button>
          <button
            onClick={handleSave}
            disabled={updateMappingsMutation.isPending}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium disabled:bg-gray-400"
          >
            {updateMappingsMutation.isPending ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* Category Filter */}
      <div className="mb-6">
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
              selectedCategory === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            All ({mappings.length})
          </button>
          {CATEGORIES.map(cat => {
            const count = mappings.filter(m => m.category === cat.id).length;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1.5 ${
                  selectedCategory === cat.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <span>{cat.icon}</span>
                <span>{cat.label}</span>
                <span className="ml-1 opacity-75">({count})</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Salesforce Fields Info */}
      {isLoadingFields ? (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-700">Loading available Salesforce fields...</p>
        </div>
      ) : sfFieldsData ? (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-700">
            ℹ️ Found {sfFieldsData.accountFields?.length || 0} Account fields and{' '}
            {sfFieldsData.opportunityFields?.length || 0} Opportunity fields in Salesforce
          </p>
        </div>
      ) : null}

      {/* Mappings Table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                Category
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                Concept Name
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                Salesforce Field
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                Source
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredMappings.map((mapping) => {
              const categoryInfo = getCategoryInfo(mapping.category);
              return (
                <tr key={mapping.conceptName} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 text-xs font-medium rounded ${categoryInfo.color}`}>
                      {categoryInfo.icon} {categoryInfo.label}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{mapping.conceptName}</div>
                  </td>
                  <td className="px-4 py-3">
                    {mapping.calculateInApp ? (
                      <span className="text-sm text-gray-500 italic">Calculated in app</span>
                    ) : (
                      <SearchableFieldSelect
                        value={mapping.salesforceField}
                        onChange={(value) => handleUpdateMapping(mapping.conceptName, 'salesforceField', value)}
                        fields={allSalesforceFields}
                        placeholder="-- Select Field --"
                      />
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={mapping.calculateInApp}
                        onChange={(e) => {
                          handleUpdateMapping(mapping.conceptName, 'calculateInApp', e.target.checked);
                          if (e.target.checked) {
                            handleUpdateMapping(mapping.conceptName, 'salesforceField', null);
                          }
                        }}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">Calculate in app</span>
                    </label>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleDeleteMapping(mapping.conceptName)}
                      className="px-2 py-1 text-sm text-red-600 hover:bg-red-50 rounded"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              );
            })}

            {filteredMappings.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                  No mappings found for this category
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* New Mapping Modal */}
      {newMapping && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Add New Field Mapping</h3>

            {/* Concept Name */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Concept Name *
              </label>
              <input
                type="text"
                value={newMapping.conceptName}
                onChange={(e) => setNewMapping({ ...newMapping, conceptName: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                placeholder="e.g., Employee Count"
              />
            </div>

            {/* Category */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Category
              </label>
              <select
                value={newMapping.category}
                onChange={(e) => setNewMapping({ ...newMapping, category: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                {CATEGORIES.map(cat => (
                  <option key={cat.id} value={cat.id}>
                    {cat.icon} {cat.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Calculate in App */}
            <div className="mb-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newMapping.calculateInApp}
                  onChange={(e) => setNewMapping({
                    ...newMapping,
                    calculateInApp: e.target.checked,
                    salesforceField: e.target.checked ? null : newMapping.salesforceField,
                  })}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700">Calculate in application</span>
              </label>
            </div>

            {/* Salesforce Field */}
            {!newMapping.calculateInApp && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Salesforce Field
                </label>
                <SearchableFieldSelect
                  value={newMapping.salesforceField}
                  onChange={(value) => setNewMapping({ ...newMapping, salesforceField: value })}
                  fields={allSalesforceFields}
                  placeholder="-- Select Field --"
                />
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex justify-end gap-2 mt-6 pt-4 border-t">
              <button
                onClick={() => setNewMapping(null)}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveNewMapping}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Add Mapping
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
