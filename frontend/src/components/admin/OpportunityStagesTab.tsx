import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../services/api';

interface Props {
  config: any;
  onSave: (status: 'idle' | 'saving' | 'saved' | 'error') => void;
}

export default function OpportunityStagesTab({ config, onSave }: Props) {
  const queryClient = useQueryClient();
  const [stages, setStages] = useState<string[]>(config.opportunityStages || []);
  const [newStage, setNewStage] = useState('');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingValue, setEditingValue] = useState('');

  const updateStagesMutation = useMutation({
    mutationFn: async (updatedStages: string[]) => {
      const response = await api.put('/api/admin/config/opportunity-stages', {
        stages: updatedStages,
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
      console.error('Error updating opportunity stages:', error);
      onSave('error');
      setTimeout(() => onSave('idle'), 3000);
    },
  });

  const handleSave = () => {
    updateStagesMutation.mutate(stages);
  };

  const handleAddStage = () => {
    if (!newStage.trim()) {
      alert('Stage name cannot be empty');
      return;
    }

    if (stages.includes(newStage.trim())) {
      alert('This stage already exists');
      return;
    }

    setStages([...stages, newStage.trim()]);
    setNewStage('');
  };

  const handleDeleteStage = (index: number) => {
    if (confirm('Are you sure you want to delete this stage?')) {
      setStages(stages.filter((_, i) => i !== index));
    }
  };

  const handleStartEdit = (index: number) => {
    setEditingIndex(index);
    setEditingValue(stages[index]);
  };

  const handleSaveEdit = () => {
    if (editingIndex === null) return;

    if (!editingValue.trim()) {
      alert('Stage name cannot be empty');
      return;
    }

    const updatedStages = [...stages];
    updatedStages[editingIndex] = editingValue.trim();
    setStages(updatedStages);
    setEditingIndex(null);
    setEditingValue('');
  };

  const handleCancelEdit = () => {
    setEditingIndex(null);
    setEditingValue('');
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const newStages = [...stages];
    [newStages[index - 1], newStages[index]] = [newStages[index], newStages[index - 1]];
    setStages(newStages);
  };

  const handleMoveDown = (index: number) => {
    if (index === stages.length - 1) return;
    const newStages = [...stages];
    [newStages[index], newStages[index + 1]] = [newStages[index + 1], newStages[index]];
    setStages(newStages);
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Opportunity Stages</h3>
          <p className="text-sm text-gray-600 mt-1">
            Configure which sales stages to include in opportunity filters and dashboards
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={updateStagesMutation.isPending}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium disabled:bg-gray-400"
        >
          {updateStagesMutation.isPending ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      {/* Add New Stage */}
      <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Add New Stage
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={newStage}
            onChange={(e) => setNewStage(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleAddStage()}
            placeholder="e.g., Qualification, Proposal"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={handleAddStage}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
          >
            + Add
          </button>
        </div>
      </div>

      {/* Stages List */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="bg-gray-50 border-b border-gray-200 px-4 py-3">
          <h4 className="text-sm font-semibold text-gray-700 uppercase">
            Configured Stages ({stages.length})
          </h4>
        </div>

        {stages.length === 0 ? (
          <div className="px-4 py-12 text-center text-gray-500">
            No stages configured. Add your first stage above.
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {stages.map((stage, index) => (
              <div
                key={index}
                className="px-4 py-3 hover:bg-gray-50 flex items-center justify-between"
              >
                {editingIndex === index ? (
                  // Edit mode
                  <div className="flex-1 flex items-center gap-2">
                    <input
                      type="text"
                      value={editingValue}
                      onChange={(e) => setEditingValue(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') handleSaveEdit();
                        if (e.key === 'Escape') handleCancelEdit();
                      }}
                      className="flex-1 px-3 py-1 border border-blue-300 rounded focus:ring-2 focus:ring-blue-500"
                      autoFocus
                    />
                    <button
                      onClick={handleSaveEdit}
                      className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
                    >
                      Save
                    </button>
                    <button
                      onClick={handleCancelEdit}
                      className="px-3 py-1 bg-gray-300 text-gray-700 rounded text-sm hover:bg-gray-400"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  // View mode
                  <>
                    <div className="flex items-center gap-3">
                      <div className="flex flex-col gap-1">
                        <button
                          onClick={() => handleMoveUp(index)}
                          disabled={index === 0}
                          className="text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                          title="Move up"
                        >
                          ▲
                        </button>
                        <button
                          onClick={() => handleMoveDown(index)}
                          disabled={index === stages.length - 1}
                          className="text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                          title="Move down"
                        >
                          ▼
                        </button>
                      </div>
                      <span className="font-medium text-gray-900">{stage}</span>
                      <span className="text-xs text-gray-500">#{index + 1}</span>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => handleStartEdit(index)}
                        className="px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteStage(index)}
                        className="px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded"
                      >
                        Delete
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Info Box */}
      <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex gap-2">
          <span className="text-yellow-600">ℹ️</span>
          <div className="text-sm text-yellow-800">
            <p className="font-medium mb-1">Important Notes:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Stages are displayed in the order shown above</li>
              <li>Use the ▲▼ buttons to reorder stages</li>
              <li>Only the stages listed here will appear in opportunity filters</li>
              <li>Closed Won and Closed Lost stages are typically excluded from active pipeline views</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
