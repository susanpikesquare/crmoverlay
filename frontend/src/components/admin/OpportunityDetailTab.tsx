import React, { useState, useRef, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../../services/api';

interface DetailField {
  label: string;
  salesforceField: string;
  fieldType: 'score' | 'text' | 'currency' | 'date' | 'percent' | 'url';
  showProgressBar?: boolean;
}

interface DetailSection {
  id: string;
  label: string;
  enabled: boolean;
  order: number;
  fields: DetailField[];
}

interface Props {
  config: any;
  onSave: (status: 'idle' | 'saving' | 'saved' | 'error') => void;
}

interface SearchableFieldSelectProps {
  value: string;
  onChange: (value: string) => void;
  fields: Array<{ name: string; label: string }>;
  placeholder?: string;
}

function SearchableFieldSelect({ value, onChange, fields, placeholder = "Select field..." }: SearchableFieldSelectProps) {
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
  const filteredFields = sortedFields.filter(field => {
    const search = searchTerm.toLowerCase();
    return field.label.toLowerCase().includes(search) || field.name.toLowerCase().includes(search);
  });

  const selectedField = fields.find(f => f.name === value);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3 py-1.5 text-sm text-left border border-gray-300 rounded bg-white hover:bg-gray-50 flex items-center justify-between"
      >
        <span className={selectedField ? 'text-gray-900 truncate' : 'text-gray-500'}>
          {selectedField ? `${selectedField.label} (${selectedField.name})` : placeholder}
        </span>
        <span className="text-gray-400 ml-1">&#x25BC;</span>
      </button>
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-hidden">
          <div className="p-2 border-b border-gray-200 sticky top-0 bg-white">
            <input
              ref={searchInputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search fields..."
              className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="overflow-y-auto max-h-48">
            {filteredFields.length === 0 ? (
              <div className="px-3 py-2 text-sm text-gray-500 text-center">No fields found</div>
            ) : (
              filteredFields.map(field => (
                <button
                  key={field.name}
                  type="button"
                  onClick={() => { onChange(field.name); setIsOpen(false); setSearchTerm(''); }}
                  className={`w-full px-3 py-1.5 text-sm text-left hover:bg-blue-50 ${value === field.name ? 'bg-blue-100 font-medium' : ''}`}
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

const FIELD_TYPES: { value: DetailField['fieldType']; label: string }[] = [
  { value: 'score', label: 'Score (0-100)' },
  { value: 'text', label: 'Text' },
  { value: 'currency', label: 'Currency' },
  { value: 'date', label: 'Date' },
  { value: 'percent', label: 'Percent' },
  { value: 'url', label: 'URL/Link' },
];

export default function OpportunityDetailTab({ config, onSave }: Props) {
  const queryClient = useQueryClient();
  const [sections, setSections] = useState<DetailSection[]>(
    config.opportunityDetailConfig?.sections || []
  );
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  // Fetch available Salesforce fields
  const { data: sfFieldsData } = useQuery({
    queryKey: ['salesforceFields'],
    queryFn: async () => {
      const response = await api.get('/api/admin/salesforce/fields');
      return response.data.data;
    },
    retry: 1,
  });

  const allSalesforceFields = [
    ...(sfFieldsData?.accountFields || []),
    ...(sfFieldsData?.opportunityFields || []),
  ];

  const saveMutation = useMutation({
    mutationFn: async (updatedSections: DetailSection[]) => {
      const response = await api.put('/api/admin/config/opportunity-detail', {
        sections: updatedSections,
      });
      return response.data;
    },
    onMutate: () => onSave('saving'),
    onSuccess: () => {
      onSave('saved');
      queryClient.invalidateQueries({ queryKey: ['adminConfig'] });
      setTimeout(() => onSave('idle'), 2000);
    },
    onError: () => {
      onSave('error');
      setTimeout(() => onSave('idle'), 3000);
    },
  });

  const handleSave = () => saveMutation.mutate(sections);

  const addSection = () => {
    const newSection: DetailSection = {
      id: `section_${Date.now()}`,
      label: 'New Section',
      enabled: true,
      order: sections.length + 1,
      fields: [],
    };
    setSections([...sections, newSection]);
    setExpandedSection(newSection.id);
  };

  const updateSection = (sectionId: string, updates: Partial<DetailSection>) => {
    setSections(sections.map(s => s.id === sectionId ? { ...s, ...updates } : s));
  };

  const deleteSection = (sectionId: string) => {
    if (confirm('Delete this section and all its fields?')) {
      setSections(sections.filter(s => s.id !== sectionId));
    }
  };

  const moveSection = (sectionId: string, direction: 'up' | 'down') => {
    const idx = sections.findIndex(s => s.id === sectionId);
    if (direction === 'up' && idx > 0) {
      const newSections = [...sections];
      [newSections[idx - 1], newSections[idx]] = [newSections[idx], newSections[idx - 1]];
      newSections.forEach((s, i) => s.order = i + 1);
      setSections(newSections);
    } else if (direction === 'down' && idx < sections.length - 1) {
      const newSections = [...sections];
      [newSections[idx], newSections[idx + 1]] = [newSections[idx + 1], newSections[idx]];
      newSections.forEach((s, i) => s.order = i + 1);
      setSections(newSections);
    }
  };

  const addField = (sectionId: string) => {
    setSections(sections.map(s => {
      if (s.id !== sectionId) return s;
      return {
        ...s,
        fields: [...s.fields, {
          label: '',
          salesforceField: '',
          fieldType: 'text' as const,
        }],
      };
    }));
  };

  const updateField = (sectionId: string, fieldIdx: number, updates: Partial<DetailField>) => {
    setSections(sections.map(s => {
      if (s.id !== sectionId) return s;
      const newFields = [...s.fields];
      newFields[fieldIdx] = { ...newFields[fieldIdx], ...updates };
      return { ...s, fields: newFields };
    }));
  };

  const deleteField = (sectionId: string, fieldIdx: number) => {
    setSections(sections.map(s => {
      if (s.id !== sectionId) return s;
      return { ...s, fields: s.fields.filter((_, i) => i !== fieldIdx) };
    }));
  };

  const moveField = (sectionId: string, fieldIdx: number, direction: 'up' | 'down') => {
    setSections(sections.map(s => {
      if (s.id !== sectionId) return s;
      const newFields = [...s.fields];
      if (direction === 'up' && fieldIdx > 0) {
        [newFields[fieldIdx - 1], newFields[fieldIdx]] = [newFields[fieldIdx], newFields[fieldIdx - 1]];
      } else if (direction === 'down' && fieldIdx < newFields.length - 1) {
        [newFields[fieldIdx], newFields[fieldIdx + 1]] = [newFields[fieldIdx + 1], newFields[fieldIdx]];
      }
      return { ...s, fields: newFields };
    }));
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Opportunity Detail Layout</h3>
          <p className="text-sm text-gray-600 mt-1">
            Configure which sections and fields appear on the opportunity detail page.
            Map each field to its Salesforce API name.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={addSection}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
          >
            + Add Section
          </button>
          <button
            onClick={handleSave}
            disabled={saveMutation.isPending}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium disabled:bg-gray-400"
          >
            {saveMutation.isPending ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* Sections */}
      <div className="space-y-4">
        {sections.sort((a, b) => a.order - b.order).map((section, sIdx) => {
          const isExpanded = expandedSection === section.id;
          return (
            <div
              key={section.id}
              className={`border rounded-lg ${section.enabled ? 'border-gray-200' : 'border-gray-200 opacity-60'}`}
            >
              {/* Section Header */}
              <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 rounded-t-lg">
                <button
                  onClick={() => setExpandedSection(isExpanded ? null : section.id)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  {isExpanded ? '\u25BC' : '\u25B6'}
                </button>

                <input
                  type="text"
                  value={section.label}
                  onChange={(e) => updateSection(section.id, { label: e.target.value })}
                  className="flex-1 px-2 py-1 text-sm font-semibold border border-transparent hover:border-gray-300 rounded focus:border-blue-500 focus:outline-none bg-transparent"
                />

                <label className="flex items-center gap-1.5 text-sm">
                  <input
                    type="checkbox"
                    checked={section.enabled}
                    onChange={(e) => updateSection(section.id, { enabled: e.target.checked })}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded"
                  />
                  Enabled
                </label>

                <div className="flex gap-1">
                  <button
                    onClick={() => moveSection(section.id, 'up')}
                    disabled={sIdx === 0}
                    className="px-2 py-1 text-xs text-gray-600 hover:bg-gray-200 rounded disabled:opacity-30"
                    title="Move up"
                  >
                    &#x2191;
                  </button>
                  <button
                    onClick={() => moveSection(section.id, 'down')}
                    disabled={sIdx === sections.length - 1}
                    className="px-2 py-1 text-xs text-gray-600 hover:bg-gray-200 rounded disabled:opacity-30"
                    title="Move down"
                  >
                    &#x2193;
                  </button>
                  <button
                    onClick={() => deleteSection(section.id)}
                    className="px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded"
                    title="Delete section"
                  >
                    Delete
                  </button>
                </div>

                <span className="text-xs text-gray-500">
                  {section.fields.length} field{section.fields.length !== 1 ? 's' : ''}
                </span>
              </div>

              {/* Section Fields (expanded) */}
              {isExpanded && (
                <div className="p-4">
                  {section.fields.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-4">
                      No fields configured. Click "Add Field" to get started.
                    </p>
                  ) : (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200">
                          <th className="text-left py-2 px-2 text-xs font-medium text-gray-600 uppercase w-1/4">Label</th>
                          <th className="text-left py-2 px-2 text-xs font-medium text-gray-600 uppercase w-1/3">Salesforce Field</th>
                          <th className="text-left py-2 px-2 text-xs font-medium text-gray-600 uppercase w-1/6">Type</th>
                          <th className="text-left py-2 px-2 text-xs font-medium text-gray-600 uppercase w-20">Bar</th>
                          <th className="text-left py-2 px-2 text-xs font-medium text-gray-600 uppercase w-24">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {section.fields.map((field, fIdx) => (
                          <tr key={fIdx} className="border-b border-gray-100">
                            <td className="py-2 px-2">
                              <input
                                type="text"
                                value={field.label}
                                onChange={(e) => updateField(section.id, fIdx, { label: e.target.value })}
                                placeholder="Field label"
                                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                              />
                            </td>
                            <td className="py-2 px-2">
                              {allSalesforceFields.length > 0 ? (
                                <SearchableFieldSelect
                                  value={field.salesforceField}
                                  onChange={(val) => updateField(section.id, fIdx, { salesforceField: val })}
                                  fields={allSalesforceFields}
                                />
                              ) : (
                                <input
                                  type="text"
                                  value={field.salesforceField}
                                  onChange={(e) => updateField(section.id, fIdx, { salesforceField: e.target.value })}
                                  placeholder="API_Name__c"
                                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded font-mono focus:ring-1 focus:ring-blue-500"
                                />
                              )}
                            </td>
                            <td className="py-2 px-2">
                              <select
                                value={field.fieldType}
                                onChange={(e) => updateField(section.id, fIdx, { fieldType: e.target.value as DetailField['fieldType'] })}
                                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
                              >
                                {FIELD_TYPES.map(ft => (
                                  <option key={ft.value} value={ft.value}>{ft.label}</option>
                                ))}
                              </select>
                            </td>
                            <td className="py-2 px-2 text-center">
                              {field.fieldType === 'score' && (
                                <input
                                  type="checkbox"
                                  checked={field.showProgressBar ?? true}
                                  onChange={(e) => updateField(section.id, fIdx, { showProgressBar: e.target.checked })}
                                  className="w-4 h-4 text-blue-600 border-gray-300 rounded"
                                  title="Show progress bar"
                                />
                              )}
                            </td>
                            <td className="py-2 px-2">
                              <div className="flex gap-1">
                                <button
                                  onClick={() => moveField(section.id, fIdx, 'up')}
                                  disabled={fIdx === 0}
                                  className="px-1.5 py-0.5 text-xs text-gray-500 hover:bg-gray-100 rounded disabled:opacity-30"
                                >
                                  &#x2191;
                                </button>
                                <button
                                  onClick={() => moveField(section.id, fIdx, 'down')}
                                  disabled={fIdx === section.fields.length - 1}
                                  className="px-1.5 py-0.5 text-xs text-gray-500 hover:bg-gray-100 rounded disabled:opacity-30"
                                >
                                  &#x2193;
                                </button>
                                <button
                                  onClick={() => deleteField(section.id, fIdx)}
                                  className="px-1.5 py-0.5 text-xs text-red-600 hover:bg-red-50 rounded"
                                >
                                  X
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}

                  <button
                    onClick={() => addField(section.id)}
                    className="mt-3 px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-lg font-medium"
                  >
                    + Add Field
                  </button>
                </div>
              )}
            </div>
          );
        })}

        {sections.length === 0 && (
          <div className="text-center py-12 border-2 border-dashed border-gray-300 rounded-lg">
            <p className="text-gray-500 mb-4">No sections configured yet.</p>
            <button
              onClick={addSection}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
            >
              + Add Section
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
