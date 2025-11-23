import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../services/api';

interface DisplaySettings {
  accountsPerPage: number;
  dealsPerPage: number;
  defaultSort: string;
  viewMode: 'table' | 'cards';
}

interface Props {
  config: any;
  onSave: (status: 'idle' | 'saving' | 'saved' | 'error') => void;
}

export default function DisplaySettingsTab({ config, onSave }: Props) {
  const queryClient = useQueryClient();
  const [settings, setSettings] = useState<DisplaySettings>(config.displaySettings);

  const updateSettingsMutation = useMutation({
    mutationFn: async (updatedSettings: DisplaySettings) => {
      const response = await api.put('/api/admin/config/display-settings', {
        displaySettings: updatedSettings,
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
      console.error('Error updating display settings:', error);
      onSave('error');
      setTimeout(() => onSave('idle'), 3000);
    },
  });

  const handleSave = () => {
    updateSettingsMutation.mutate(settings);
  };

  const handleUpdateSetting = (key: keyof DisplaySettings, value: any) => {
    setSettings({ ...settings, [key]: value });
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Display Settings</h3>
          <p className="text-sm text-gray-600 mt-1">
            Configure default display preferences and pagination
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={updateSettingsMutation.isPending}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium disabled:bg-gray-400"
        >
          {updateSettingsMutation.isPending ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      {/* Settings Form */}
      <div className="space-y-6">
        {/* Pagination Settings */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h4 className="font-semibold text-gray-900 mb-4">Pagination</h4>

          <div className="space-y-4">
            {/* Accounts Per Page */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Accounts Per Page
              </label>
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min="5"
                  max="50"
                  step="5"
                  value={settings.accountsPerPage}
                  onChange={(e) => handleUpdateSetting('accountsPerPage', parseInt(e.target.value))}
                  className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
                <input
                  type="number"
                  value={settings.accountsPerPage}
                  onChange={(e) => handleUpdateSetting('accountsPerPage', parseInt(e.target.value) || 10)}
                  className="w-20 px-3 py-2 border border-gray-300 rounded-lg text-center"
                  min="5"
                  max="50"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Number of accounts to display per page in list views
              </p>
            </div>

            {/* Deals Per Page */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Deals Per Page
              </label>
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min="5"
                  max="50"
                  step="5"
                  value={settings.dealsPerPage}
                  onChange={(e) => handleUpdateSetting('dealsPerPage', parseInt(e.target.value))}
                  className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
                <input
                  type="number"
                  value={settings.dealsPerPage}
                  onChange={(e) => handleUpdateSetting('dealsPerPage', parseInt(e.target.value) || 8)}
                  className="w-20 px-3 py-2 border border-gray-300 rounded-lg text-center"
                  min="5"
                  max="50"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Number of opportunities to display per page in list views
              </p>
            </div>
          </div>
        </div>

        {/* Sorting Settings */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h4 className="font-semibold text-gray-900 mb-4">Default Sorting</h4>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Default Sort Order
            </label>
            <select
              value={settings.defaultSort}
              onChange={(e) => handleUpdateSetting('defaultSort', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="priority">Priority (High to Low)</option>
              <option value="name">Name (A-Z)</option>
              <option value="intentScore">Intent Score (High to Low)</option>
              <option value="revenue">Revenue (High to Low)</option>
              <option value="lastModified">Last Modified (Recent First)</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Default sort order for account and opportunity lists
            </p>
          </div>
        </div>

        {/* View Mode Settings */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h4 className="font-semibold text-gray-900 mb-4">Default View Mode</h4>

          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => handleUpdateSetting('viewMode', 'table')}
              className={`p-4 border-2 rounded-lg transition-all ${
                settings.viewMode === 'table'
                  ? 'border-blue-600 bg-blue-50'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <div className="text-3xl mb-2">📊</div>
              <div className="font-semibold text-gray-900">Table View</div>
              <div className="text-xs text-gray-600 mt-1">
                Compact table layout (recommended)
              </div>
            </button>

            <button
              onClick={() => handleUpdateSetting('viewMode', 'cards')}
              className={`p-4 border-2 rounded-lg transition-all ${
                settings.viewMode === 'cards'
                  ? 'border-blue-600 bg-blue-50'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <div className="text-3xl mb-2">📇</div>
              <div className="font-semibold text-gray-900">Card View</div>
              <div className="text-xs text-gray-600 mt-1">
                Visual card layout
              </div>
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-3">
            Default view mode for account and opportunity lists (users can toggle)
          </p>
        </div>

        {/* Preview */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-semibold text-blue-900 mb-2">Current Settings Preview</h4>
          <div className="text-sm text-blue-700 space-y-1">
            <div>• Showing {settings.accountsPerPage} accounts per page</div>
            <div>• Showing {settings.dealsPerPage} deals per page</div>
            <div>• Default sort: {settings.defaultSort}</div>
            <div>• Default view: {settings.viewMode}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
