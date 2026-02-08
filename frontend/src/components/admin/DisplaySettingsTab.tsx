import React, { useState, useRef } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import api from '../../services/api';

interface DisplaySettings {
  accountsPerPage: number;
  dealsPerPage: number;
  defaultSort: string;
  viewMode: 'table' | 'cards';
}

interface SalesforceFieldConfig {
  opportunityAmountField: string;
  forecastCategoryField: string;
}

interface BrandingConfig {
  brandName: string;
  logoBase64: string;
  logoHeight: number;
}

interface Props {
  config: any;
  onSave: (status: 'idle' | 'saving' | 'saved' | 'error') => void;
}

const MAX_FILE_SIZE = 500 * 1024; // 500KB

export default function DisplaySettingsTab({ config, onSave }: Props) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [settings, setSettings] = useState<DisplaySettings>(config.displaySettings);
  const [salesforceFields, setSalesforceFields] = useState<SalesforceFieldConfig>(
    config.salesforceFields || { opportunityAmountField: 'Amount', forecastCategoryField: 'ForecastCategory' }
  );

  // Branding state
  const [brandName, setBrandName] = useState('');
  const [logoBase64, setLogoBase64] = useState('');
  const [logoHeight, setLogoHeight] = useState(32);
  const [fileError, setFileError] = useState('');
  const [brandingInitialized, setBrandingInitialized] = useState(false);

  // Fetch available Salesforce fields
  const { data: sfFieldsData } = useQuery({
    queryKey: ['salesforceFields'],
    queryFn: async () => {
      const response = await api.get('/api/admin/salesforce/fields');
      return response.data.data;
    },
    retry: 1,
  });

  // Fetch current branding config
  const { data: brandingData, isLoading: isBrandingLoading } = useQuery({
    queryKey: ['adminBranding'],
    queryFn: async () => {
      const response = await api.get('/api/admin/config/branding');
      return response.data.data as BrandingConfig | null;
    },
  });

  // Initialize branding form state from fetched data
  if (brandingData && !brandingInitialized) {
    setBrandName(brandingData.brandName || '');
    setLogoBase64(brandingData.logoBase64 || '');
    setLogoHeight(brandingData.logoHeight || 32);
    setBrandingInitialized(true);
  } else if (brandingData === null && !brandingInitialized) {
    setBrandingInitialized(true);
  }

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

  const updateSalesforceFieldsMutation = useMutation({
    mutationFn: async (updatedFields: SalesforceFieldConfig) => {
      const response = await api.put('/api/admin/config/salesforce-fields', updatedFields);
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
      console.error('Error updating Salesforce field settings:', error);
      onSave('error');
      setTimeout(() => onSave('idle'), 3000);
    },
  });

  const saveBrandingMutation = useMutation({
    mutationFn: async (data: BrandingConfig) => {
      const response = await api.put('/api/admin/config/branding', data);
      return response.data;
    },
    onMutate: () => onSave('saving'),
    onSuccess: () => {
      onSave('saved');
      queryClient.invalidateQueries({ queryKey: ['adminBranding'] });
      queryClient.invalidateQueries({ queryKey: ['branding'] });
      setTimeout(() => onSave('idle'), 2000);
    },
    onError: () => {
      onSave('error');
      setTimeout(() => onSave('idle'), 3000);
    },
  });

  const removeBrandingMutation = useMutation({
    mutationFn: async () => {
      const response = await api.put('/api/admin/config/branding', {});
      return response.data;
    },
    onMutate: () => onSave('saving'),
    onSuccess: () => {
      setBrandName('');
      setLogoBase64('');
      setLogoHeight(32);
      onSave('saved');
      queryClient.invalidateQueries({ queryKey: ['adminBranding'] });
      queryClient.invalidateQueries({ queryKey: ['branding'] });
      setTimeout(() => onSave('idle'), 2000);
    },
    onError: () => {
      onSave('error');
      setTimeout(() => onSave('idle'), 3000);
    },
  });

  const handleSave = () => {
    updateSettingsMutation.mutate(settings);
  };

  const handleSaveSalesforceFields = () => {
    updateSalesforceFieldsMutation.mutate(salesforceFields);
  };

  const handleSaveBranding = () => {
    saveBrandingMutation.mutate({ brandName, logoBase64, logoHeight });
  };

  const handleRemoveBranding = () => {
    removeBrandingMutation.mutate();
  };

  const handleUpdateSetting = (key: keyof DisplaySettings, value: any) => {
    setSettings({ ...settings, [key]: value });
  };

  const handleUpdateSalesforceField = (key: keyof SalesforceFieldConfig, value: string) => {
    setSalesforceFields({ ...salesforceFields, [key]: value });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFileError('');
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setFileError('Please select an image file (PNG, JPG, SVG, etc.)');
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setFileError(`File is too large (${(file.size / 1024).toFixed(0)}KB). Maximum size is 500KB.`);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setLogoBase64(reader.result as string);
    };
    reader.onerror = () => {
      setFileError('Failed to read file');
    };
    reader.readAsDataURL(file);
  };

  const hasBrandingChanges = brandName !== (brandingData?.brandName || '') ||
    logoBase64 !== (brandingData?.logoBase64 || '') ||
    logoHeight !== (brandingData?.logoHeight || 32);

  const hasAnyBranding = logoBase64 || brandName || brandingData;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Display & Branding</h3>
          <p className="text-sm text-gray-600 mt-1">
            Configure display preferences, pagination, and logo/branding
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

        {/* Salesforce Fields Configuration */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-semibold text-gray-900">Salesforce Field Configuration</h4>
            <button
              onClick={handleSaveSalesforceFields}
              disabled={updateSalesforceFieldsMutation.isPending}
              className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium disabled:bg-gray-400"
            >
              {updateSalesforceFieldsMutation.isPending ? 'Saving...' : 'Save Field Settings'}
            </button>
          </div>

          <div className="space-y-4">
            {/* Opportunity Amount Field */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Opportunity Amount Field
              </label>
              <select
                value={salesforceFields.opportunityAmountField}
                onChange={(e) => handleUpdateSalesforceField('opportunityAmountField', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="Amount">Amount (Standard)</option>
                {sfFieldsData?.opportunityFields
                  ?.filter((field: any) =>
                    (field.type === 'currency' || field.type === 'double') && field.name !== 'Amount'
                  )
                  .map((field: any) => (
                    <option key={field.name} value={field.name}>
                      {field.label} ({field.name})
                    </option>
                  ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Select which Salesforce field to use for opportunity amounts in metrics, pipeline forecasts, and deal summaries.
                Common custom fields: New_ARR__c, ACV__c, TCV__c
              </p>
            </div>

            {/* Forecast Category Field */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Forecast Category Field
              </label>
              <select
                value={salesforceFields.forecastCategoryField}
                onChange={(e) => handleUpdateSalesforceField('forecastCategoryField', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="ForecastCategory">ForecastCategory (Standard)</option>
                {sfFieldsData?.opportunityFields
                  ?.filter((field: any) =>
                    field.type === 'picklist' && field.name !== 'ForecastCategory'
                  )
                  .map((field: any) => (
                    <option key={field.name} value={field.name}>
                      {field.label} ({field.name})
                    </option>
                  ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Select which Salesforce field to use for forecast categorization (Pipeline, Best Case, Commit, Closed)
              </p>
            </div>
          </div>

          {/* Current Configuration */}
          <div className="mt-4 p-3 bg-gray-50 rounded-lg">
            <div className="text-xs text-gray-700">
              <div className="font-medium mb-1">Current Configuration:</div>
              <div>• Amount Field: <span className="font-mono">{salesforceFields.opportunityAmountField}</span></div>
              <div>• Forecast Field: <span className="font-mono">{salesforceFields.forecastCategoryField}</span></div>
            </div>
          </div>
        </div>

        {/* Branding Section */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="font-semibold text-gray-900">Branding</h4>
              <p className="text-xs text-gray-500 mt-1">
                Customize the logo and brand name displayed in the navigation bar
              </p>
            </div>
            <div className="flex items-center gap-3">
              {hasAnyBranding && (
                <button
                  onClick={handleRemoveBranding}
                  disabled={removeBrandingMutation.isPending}
                  className="px-3 py-1.5 text-red-600 border border-red-300 rounded-lg hover:bg-red-50 text-sm font-medium disabled:opacity-50"
                >
                  Remove Logo
                </button>
              )}
              <button
                onClick={handleSaveBranding}
                disabled={saveBrandingMutation.isPending || !hasBrandingChanges}
                className="px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium disabled:bg-gray-400"
              >
                {saveBrandingMutation.isPending ? 'Saving...' : 'Save Branding'}
              </button>
            </div>
          </div>

          {isBrandingLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Logo Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Logo Image
                </label>
                {logoBase64 && (
                  <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg mb-3">
                    <div className="flex-shrink-0">
                      <img
                        src={logoBase64}
                        alt="Logo preview"
                        style={{ height: `${logoHeight}px` }}
                        className="object-contain"
                      />
                    </div>
                    <div className="text-sm text-gray-600">
                      Preview at {logoHeight}px height
                    </div>
                    <button
                      onClick={() => {
                        setLogoBase64('');
                        if (fileInputRef.current) fileInputRef.current.value = '';
                      }}
                      className="ml-auto text-sm text-red-600 hover:text-red-800"
                    >
                      Clear
                    </button>
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
                <p className="text-xs text-gray-500 mt-1">
                  PNG, JPG, SVG, or GIF. Maximum 500KB. Recommended: transparent background, max 200px wide.
                </p>
                {fileError && (
                  <p className="text-sm text-red-600 mt-1">{fileError}</p>
                )}
              </div>

              {/* Brand Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Brand Name
                </label>
                <input
                  type="text"
                  value={brandName}
                  onChange={(e) => setBrandName(e.target.value)}
                  placeholder="FormationIQ"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  maxLength={50}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Displayed as text when no logo image is uploaded, or as alt text for the logo
                </p>
              </div>

              {/* Logo Height */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Logo Height: {logoHeight}px
                </label>
                <div className="flex items-center gap-4">
                  <span className="text-xs text-gray-500">24px</span>
                  <input
                    type="range"
                    min="24"
                    max="64"
                    step="2"
                    value={logoHeight}
                    onChange={(e) => setLogoHeight(parseInt(e.target.value))}
                    className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  />
                  <span className="text-xs text-gray-500">64px</span>
                </div>
              </div>

              {/* Navigation Preview */}
              <div className="mt-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Navigation Preview
                </label>
                <div className="border border-gray-200 rounded-lg bg-white shadow-sm p-4">
                  <div className="flex items-center gap-6">
                    <div className="flex items-center">
                      {logoBase64 ? (
                        <img
                          src={logoBase64}
                          alt={brandName || 'Logo'}
                          style={{ height: `${logoHeight}px` }}
                          className="object-contain"
                        />
                      ) : brandName ? (
                        <span className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                          {brandName}
                        </span>
                      ) : (
                        <span className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                          FormationIQ
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-400">
                      <span>Hub</span>
                      <span>Accounts</span>
                      <span>Opportunities</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
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
