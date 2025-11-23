import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../services/api';

interface Props {
  config: any;
  onSave: (status: 'idle' | 'saving' | 'saved' | 'error') => void;
}

export default function ConfigManagementTab({ config, onSave }: Props) {
  const queryClient = useQueryClient();
  const [importJson, setImportJson] = useState('');
  const [showImportModal, setShowImportModal] = useState(false);

  const exportConfigMutation = useMutation({
    mutationFn: async () => {
      const response = await api.get('/api/admin/config/export', {
        responseType: 'blob',
      });
      return response.data;
    },
    onSuccess: (blob) => {
      // Create download link
      const url = window.URL.createObjectURL(new Blob([blob]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `crm-overlay-config-${new Date().toISOString().split('T')[0]}.json`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    },
    onError: (error) => {
      console.error('Error exporting config:', error);
      alert('Failed to export configuration');
    },
  });

  const importConfigMutation = useMutation({
    mutationFn: async (configJson: string) => {
      const response = await api.post('/api/admin/config/import', { configJson });
      return response.data;
    },
    onMutate: () => {
      onSave('saving');
    },
    onSuccess: () => {
      onSave('saved');
      queryClient.invalidateQueries({ queryKey: ['adminConfig'] });
      setShowImportModal(false);
      setImportJson('');
      setTimeout(() => onSave('idle'), 2000);
    },
    onError: (error: any) => {
      console.error('Error importing config:', error);
      onSave('error');
      alert(error.response?.data?.message || 'Failed to import configuration');
      setTimeout(() => onSave('idle'), 3000);
    },
  });

  const resetConfigMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post('/api/admin/config/reset');
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
      console.error('Error resetting config:', error);
      onSave('error');
      setTimeout(() => onSave('idle'), 3000);
    },
  });

  const handleExport = () => {
    exportConfigMutation.mutate();
  };

  const handleImport = () => {
    if (!importJson.trim()) {
      alert('Please paste configuration JSON');
      return;
    }

    try {
      // Validate JSON
      JSON.parse(importJson);
      importConfigMutation.mutate(importJson);
    } catch (error) {
      alert('Invalid JSON format');
    }
  };

  const handleReset = () => {
    if (confirm('Are you sure you want to reset all configuration to defaults? This cannot be undone.')) {
      resetConfigMutation.mutate();
    }
  };

  const handleCopyCurrentConfig = () => {
    const configJson = JSON.stringify(config, null, 2);
    navigator.clipboard.writeText(configJson);
    alert('Configuration copied to clipboard');
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900">Configuration Management</h3>
        <p className="text-sm text-gray-600 mt-1">
          Import, export, and manage application configuration
        </p>
      </div>

      {/* Actions Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Export Configuration */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-start gap-4">
            <div className="text-4xl">📤</div>
            <div className="flex-1">
              <h4 className="font-semibold text-gray-900 mb-2">Export Configuration</h4>
              <p className="text-sm text-gray-600 mb-4">
                Download current configuration as a JSON file for backup or sharing
              </p>
              <button
                onClick={handleExport}
                disabled={exportConfigMutation.isPending}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium disabled:bg-gray-400"
              >
                {exportConfigMutation.isPending ? 'Exporting...' : 'Export Configuration'}
              </button>
            </div>
          </div>
        </div>

        {/* Import Configuration */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-start gap-4">
            <div className="text-4xl">📥</div>
            <div className="flex-1">
              <h4 className="font-semibold text-gray-900 mb-2">Import Configuration</h4>
              <p className="text-sm text-gray-600 mb-4">
                Restore configuration from a previously exported JSON file
              </p>
              <button
                onClick={() => setShowImportModal(true)}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium"
              >
                Import Configuration
              </button>
            </div>
          </div>
        </div>

        {/* Copy Current Config */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-start gap-4">
            <div className="text-4xl">📋</div>
            <div className="flex-1">
              <h4 className="font-semibold text-gray-900 mb-2">Copy Configuration</h4>
              <p className="text-sm text-gray-600 mb-4">
                Copy current configuration to clipboard as JSON
              </p>
              <button
                onClick={handleCopyCurrentConfig}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm font-medium"
              >
                Copy to Clipboard
              </button>
            </div>
          </div>
        </div>

        {/* Reset to Defaults */}
        <div className="bg-white border border-red-200 rounded-lg p-6">
          <div className="flex items-start gap-4">
            <div className="text-4xl">🔄</div>
            <div className="flex-1">
              <h4 className="font-semibold text-red-900 mb-2">Reset to Defaults</h4>
              <p className="text-sm text-red-600 mb-4">
                ⚠️ Reset all configuration to factory defaults (cannot be undone)
              </p>
              <button
                onClick={handleReset}
                disabled={resetConfigMutation.isPending}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium disabled:bg-gray-400"
              >
                {resetConfigMutation.isPending ? 'Resetting...' : 'Reset to Defaults'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Configuration Preview */}
      <div className="mt-6 bg-white border border-gray-200 rounded-lg p-6">
        <h4 className="font-semibold text-gray-900 mb-4">Current Configuration Summary</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div className="p-3 bg-gray-50 rounded">
            <div className="text-gray-600">Risk Rules</div>
            <div className="text-2xl font-bold text-gray-900">{config.riskRules?.length || 0}</div>
          </div>
          <div className="p-3 bg-gray-50 rounded">
            <div className="text-gray-600">Score Components</div>
            <div className="text-2xl font-bold text-gray-900">{config.priorityScoring?.components?.length || 0}</div>
          </div>
          <div className="p-3 bg-gray-50 rounded">
            <div className="text-gray-600">Field Mappings</div>
            <div className="text-2xl font-bold text-gray-900">{config.fieldMappings?.length || 0}</div>
          </div>
          <div className="p-3 bg-gray-50 rounded">
            <div className="text-gray-600">Role Mappings</div>
            <div className="text-2xl font-bold text-gray-900">{config.roleMapping?.length || 0}</div>
          </div>
        </div>

        {config.lastModified && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="text-xs text-gray-600">
              Last modified by <span className="font-semibold text-gray-900">{config.lastModified.by}</span> on{' '}
              <span className="font-semibold text-gray-900">
                {new Date(config.lastModified.date).toLocaleString()}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Import Configuration</h3>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Paste Configuration JSON
              </label>
              <textarea
                value={importJson}
                onChange={(e) => setImportJson(e.target.value)}
                className="w-full h-64 px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm focus:ring-2 focus:ring-blue-500"
                placeholder='{"riskRules": [...], "priorityScoring": {...}, ...}'
              />
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
              <p className="text-sm text-yellow-800">
                ⚠️ <strong>Warning:</strong> Importing will replace your current configuration. Make sure to export
                your current configuration first if you want to keep it.
              </p>
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowImportModal(false);
                  setImportJson('');
                }}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleImport}
                disabled={importConfigMutation.isPending}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400"
              >
                {importConfigMutation.isPending ? 'Importing...' : 'Import Configuration'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
