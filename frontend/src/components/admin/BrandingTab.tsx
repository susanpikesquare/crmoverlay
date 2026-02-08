import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../services/api';

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

export default function BrandingTab({ config, onSave }: Props) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [brandName, setBrandName] = useState('');
  const [logoBase64, setLogoBase64] = useState('');
  const [logoHeight, setLogoHeight] = useState(32);
  const [fileError, setFileError] = useState('');
  const [initialized, setInitialized] = useState(false);

  // Fetch current branding config
  const { data: brandingData, isLoading } = useQuery({
    queryKey: ['adminBranding'],
    queryFn: async () => {
      const response = await api.get('/api/admin/config/branding');
      return response.data.data as BrandingConfig | null;
    },
  });

  // Initialize form state from fetched data
  if (brandingData && !initialized) {
    setBrandName(brandingData.brandName || '');
    setLogoBase64(brandingData.logoBase64 || '');
    setLogoHeight(brandingData.logoHeight || 32);
    setInitialized(true);
  } else if (brandingData === null && !initialized) {
    setInitialized(true);
  }

  const saveMutation = useMutation({
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

  const removeMutation = useMutation({
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

  const handleSave = () => {
    saveMutation.mutate({
      brandName,
      logoBase64,
      logoHeight,
    });
  };

  const handleRemove = () => {
    removeMutation.mutate();
  };

  const hasChanges = brandName !== (brandingData?.brandName || '') ||
    logoBase64 !== (brandingData?.logoBase64 || '') ||
    logoHeight !== (brandingData?.logoHeight || 32);

  const hasAnyBranding = logoBase64 || brandName || brandingData;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Branding</h3>
          <p className="text-sm text-gray-600 mt-1">
            Customize the logo and brand name displayed in the navigation bar
          </p>
        </div>
        <div className="flex items-center gap-3">
          {hasAnyBranding && (
            <button
              onClick={handleRemove}
              disabled={removeMutation.isPending}
              className="px-4 py-2 text-red-600 border border-red-300 rounded-lg hover:bg-red-50 text-sm font-medium disabled:opacity-50"
            >
              Remove Logo
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={saveMutation.isPending || !hasChanges}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium disabled:bg-gray-400"
          >
            {saveMutation.isPending ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      <div className="space-y-6">
        {/* Logo Upload */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h4 className="font-semibold text-gray-900 mb-4">Logo Image</h4>

          <div className="space-y-4">
            {/* Current Logo Preview */}
            {logoBase64 && (
              <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                <div className="flex-shrink-0">
                  <img
                    src={logoBase64}
                    alt="Logo preview"
                    style={{ height: `${logoHeight}px` }}
                    className="object-contain"
                  />
                </div>
                <div className="text-sm text-gray-600">
                  Current logo preview at {logoHeight}px height
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

            {/* File Input */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Upload Logo
              </label>
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
          </div>
        </div>

        {/* Brand Name */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h4 className="font-semibold text-gray-900 mb-4">Brand Name</h4>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Organization Name
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
        </div>

        {/* Logo Height */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h4 className="font-semibold text-gray-900 mb-4">Logo Size</h4>

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
            <p className="text-xs text-gray-500 mt-1">
              Controls the display height of the logo in the navigation bar
            </p>
          </div>
        </div>

        {/* Navigation Preview */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h4 className="font-semibold text-gray-900 mb-4">Navigation Preview</h4>

          <div className="border border-gray-200 rounded-lg bg-white shadow-sm p-4">
            <div className="flex items-center gap-6">
              {/* Logo area */}
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
              {/* Simulated nav links */}
              <div className="flex items-center gap-4 text-sm text-gray-400">
                <span>Hub</span>
                <span>Accounts</span>
                <span>Opportunities</span>
              </div>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Preview of how the navigation bar will appear
          </p>
        </div>
      </div>
    </div>
  );
}
