import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../services/api';

interface PriorityComponent {
  id: string;
  name: string;
  weight: number;
  field?: string;
  scoreRanges?: Array<{
    min: number;
    max: number;
    score: number;
  }>;
}

interface PriorityConfig {
  components: PriorityComponent[];
  thresholds: {
    hot: { min: number; max: number };
    warm: { min: number; max: number };
    cool: { min: number; max: number };
    cold: { min: number; max: number };
  };
}

interface Props {
  config: any;
  onSave: (status: 'idle' | 'saving' | 'saved' | 'error') => void;
}

export default function PriorityScoringTab({ config, onSave }: Props) {
  const queryClient = useQueryClient();
  const [priorityConfig, setPriorityConfig] = useState<PriorityConfig>(config.priorityScoring);
  const [totalWeight, setTotalWeight] = useState(0);
  const [editingComponent, setEditingComponent] = useState<PriorityComponent | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Calculate total weight whenever components change
  useEffect(() => {
    const total = priorityConfig.components.reduce((sum, comp) => sum + comp.weight, 0);
    setTotalWeight(total);
  }, [priorityConfig.components]);

  const updateScoringMutation = useMutation({
    mutationFn: async (updatedConfig: PriorityConfig) => {
      const response = await api.put('/api/admin/config/priority-scoring', {
        priorityScoring: updatedConfig,
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
    onError: (error: any) => {
      console.error('Error updating priority scoring:', error);
      onSave('error');
      alert(error.response?.data?.message || 'Failed to save priority scoring');
      setTimeout(() => onSave('idle'), 3000);
    },
  });

  const handleSave = () => {
    if (Math.abs(totalWeight - 100) > 0.01) {
      alert('Component weights must sum to 100%');
      return;
    }
    updateScoringMutation.mutate(priorityConfig);
  };

  const handleAddComponent = () => {
    const newComponent: PriorityComponent = {
      id: `comp_${Date.now()}`,
      name: 'New Component',
      weight: 0,
      field: '',
    };
    setEditingComponent(newComponent);
    setIsCreating(true);
  };

  const handleSaveEditedComponent = () => {
    if (!editingComponent) return;

    if (isCreating) {
      setPriorityConfig({
        ...priorityConfig,
        components: [...priorityConfig.components, editingComponent],
      });
    } else {
      setPriorityConfig({
        ...priorityConfig,
        components: priorityConfig.components.map(c =>
          c.id === editingComponent.id ? editingComponent : c
        ),
      });
    }

    setEditingComponent(null);
    setIsCreating(false);
  };

  const handleDeleteComponent = (compId: string) => {
    if (confirm('Are you sure you want to delete this component?')) {
      setPriorityConfig({
        ...priorityConfig,
        components: priorityConfig.components.filter(c => c.id !== compId),
      });
    }
  };

  const handleUpdateWeight = (compId: string, weight: number) => {
    setPriorityConfig({
      ...priorityConfig,
      components: priorityConfig.components.map(c =>
        c.id === compId ? { ...c, weight } : c
      ),
    });
  };

  const handleUpdateThreshold = (tier: 'hot' | 'warm' | 'cool' | 'cold', field: 'min' | 'max', value: number) => {
    setPriorityConfig({
      ...priorityConfig,
      thresholds: {
        ...priorityConfig.thresholds,
        [tier]: {
          ...priorityConfig.thresholds[tier],
          [field]: value,
        },
      },
    });
  };

  const handleAddScoreRange = () => {
    if (!editingComponent) return;
    setEditingComponent({
      ...editingComponent,
      scoreRanges: [
        ...(editingComponent.scoreRanges || []),
        { min: 0, max: 100, score: 50 },
      ],
    });
  };

  const handleUpdateScoreRange = (index: number, field: 'min' | 'max' | 'score', value: number) => {
    if (!editingComponent || !editingComponent.scoreRanges) return;
    const newRanges = [...editingComponent.scoreRanges];
    newRanges[index] = { ...newRanges[index], [field]: value };
    setEditingComponent({ ...editingComponent, scoreRanges: newRanges });
  };

  const handleRemoveScoreRange = (index: number) => {
    if (!editingComponent || !editingComponent.scoreRanges) return;
    setEditingComponent({
      ...editingComponent,
      scoreRanges: editingComponent.scoreRanges.filter((_, i) => i !== index),
    });
  };

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'hot': return 'text-red-600 bg-red-50 border-red-300';
      case 'warm': return 'text-orange-600 bg-orange-50 border-orange-300';
      case 'cool': return 'text-blue-600 bg-blue-50 border-blue-300';
      case 'cold': return 'text-gray-600 bg-gray-50 border-gray-300';
      default: return '';
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Priority Scoring Formula</h3>
          <p className="text-sm text-gray-600 mt-1">
            Configure weighted components to calculate account priority scores
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={updateScoringMutation.isPending || Math.abs(totalWeight - 100) > 0.01}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium disabled:bg-gray-400"
        >
          {updateScoringMutation.isPending ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      {/* Total Weight Indicator */}
      <div className={`mb-6 p-4 rounded-lg border-2 ${
        Math.abs(totalWeight - 100) < 0.01
          ? 'bg-green-50 border-green-300'
          : 'bg-red-50 border-red-300'
      }`}>
        <div className="flex items-center justify-between">
          <div>
            <div className="font-semibold text-gray-900">Total Weight: {totalWeight.toFixed(1)}%</div>
            <div className="text-sm text-gray-600">
              {Math.abs(totalWeight - 100) < 0.01
                ? '✓ Weights sum to 100% (valid)'
                : `⚠ Weights must sum to 100% (currently ${totalWeight.toFixed(1)}%)`
              }
            </div>
          </div>
          <button
            onClick={handleAddComponent}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
          >
            + Add Component
          </button>
        </div>
      </div>

      {/* Components List */}
      <div className="mb-8 space-y-4">
        <h4 className="font-semibold text-gray-900">Score Components</h4>

        {priorityConfig.components.map((component) => (
          <div key={component.id} className="border border-gray-200 rounded-lg p-4 bg-white">
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <h5 className="font-semibold text-gray-900">{component.name}</h5>
                {component.field && (
                  <p className="text-sm text-gray-600 font-mono mt-1">{component.field}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setEditingComponent(component);
                    setIsCreating(false);
                  }}
                  className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDeleteComponent(component.id)}
                  className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200"
                >
                  Delete
                </button>
              </div>
            </div>

            {/* Weight Slider */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-700">Weight</label>
                <input
                  type="number"
                  value={component.weight}
                  onChange={(e) => handleUpdateWeight(component.id, parseFloat(e.target.value) || 0)}
                  className="w-20 px-2 py-1 border border-gray-300 rounded text-sm text-right"
                  min="0"
                  max="100"
                  step="1"
                />
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={component.weight}
                onChange={(e) => handleUpdateWeight(component.id, parseFloat(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>0%</span>
                <span className="font-semibold text-blue-600">{component.weight}%</span>
                <span>100%</span>
              </div>
            </div>

            {/* Score Ranges Preview */}
            {component.scoreRanges && component.scoreRanges.length > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-200">
                <div className="text-xs text-gray-600">
                  <span className="font-medium">Score Ranges:</span>
                  {component.scoreRanges.map((range, idx) => (
                    <span key={idx} className="ml-2">
                      {range.min}-{range.max} → {range.score}
                      {idx < component.scoreRanges!.length - 1 && ','}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Priority Tier Thresholds */}
      <div className="mb-6">
        <h4 className="font-semibold text-gray-900 mb-4">Priority Tier Thresholds</h4>
        <div className="grid grid-cols-2 gap-4">
          {Object.entries(priorityConfig.thresholds).map(([tier, range]) => (
            <div key={tier} className={`border-2 rounded-lg p-4 ${getTierColor(tier)}`}>
              <div className="font-semibold capitalize mb-2">
                {tier === 'hot' && '🔥 '}{tier} Priority
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-medium block mb-1">Min Score</label>
                  <input
                    type="number"
                    value={range.min}
                    onChange={(e) => handleUpdateThreshold(tier as any, 'min', parseFloat(e.target.value) || 0)}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                    min="0"
                    max="100"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1">Max Score</label>
                  <input
                    type="number"
                    value={range.max}
                    onChange={(e) => handleUpdateThreshold(tier as any, 'max', parseFloat(e.target.value) || 0)}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                    min="0"
                    max="100"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Component Editor Modal */}
      {editingComponent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4">
              {isCreating ? 'Create Component' : 'Edit Component'}
            </h3>

            {/* Component Name */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Component Name
              </label>
              <input
                type="text"
                value={editingComponent.name}
                onChange={(e) => setEditingComponent({ ...editingComponent, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                placeholder="e.g., Intent Score"
              />
            </div>

            {/* Weight */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Weight (%)
              </label>
              <input
                type="number"
                value={editingComponent.weight}
                onChange={(e) => setEditingComponent({ ...editingComponent, weight: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                min="0"
                max="100"
                step="1"
              />
            </div>

            {/* Salesforce Field */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Salesforce Field (optional)
              </label>
              <input
                type="text"
                value={editingComponent.field || ''}
                onChange={(e) => setEditingComponent({ ...editingComponent, field: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                placeholder="e.g., accountIntentScore6sense__c"
              />
              <p className="text-xs text-gray-500 mt-1">
                Leave blank if using score ranges instead
              </p>
            </div>

            {/* Score Ranges */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  Score Ranges (optional)
                </label>
                <button
                  onClick={handleAddScoreRange}
                  className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                >
                  + Add Range
                </button>
              </div>

              {editingComponent.scoreRanges && editingComponent.scoreRanges.length > 0 && (
                <div className="space-y-2">
                  {editingComponent.scoreRanges.map((range, idx) => (
                    <div key={idx} className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                      <input
                        type="number"
                        value={range.min}
                        onChange={(e) => handleUpdateScoreRange(idx, 'min', parseFloat(e.target.value) || 0)}
                        placeholder="Min"
                        className="w-24 px-2 py-1 border border-gray-300 rounded text-sm"
                      />
                      <span className="text-gray-500">to</span>
                      <input
                        type="number"
                        value={range.max}
                        onChange={(e) => handleUpdateScoreRange(idx, 'max', parseFloat(e.target.value) || 0)}
                        placeholder="Max"
                        className="w-24 px-2 py-1 border border-gray-300 rounded text-sm"
                      />
                      <span className="text-gray-500">→ Score:</span>
                      <input
                        type="number"
                        value={range.score}
                        onChange={(e) => handleUpdateScoreRange(idx, 'score', parseFloat(e.target.value) || 0)}
                        placeholder="Score"
                        className="w-24 px-2 py-1 border border-gray-300 rounded text-sm"
                      />
                      <button
                        onClick={() => handleRemoveScoreRange(idx)}
                        className="px-2 py-1 text-red-600 hover:bg-red-50 rounded"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="flex justify-end gap-2 mt-6 pt-4 border-t">
              <button
                onClick={() => {
                  setEditingComponent(null);
                  setIsCreating(false);
                }}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEditedComponent}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                {isCreating ? 'Create Component' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
