import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';

// Tab Components (will create these next)
import RiskRulesTab from '../components/admin/RiskRulesTab';
import PriorityScoringTab from '../components/admin/PriorityScoringTab';
import FieldMappingsTab from '../components/admin/FieldMappingsTab';
import RoleMappingsTab from '../components/admin/RoleMappingsTab';
import DisplaySettingsTab from '../components/admin/DisplaySettingsTab';
import ConfigManagementTab from '../components/admin/ConfigManagementTab';

type TabType = 'risk-rules' | 'priority-scoring' | 'field-mappings' | 'role-mappings' | 'display-settings' | 'config-management';

interface TabConfig {
  id: TabType;
  label: string;
  icon: string;
  description: string;
}

const TABS: TabConfig[] = [
  {
    id: 'risk-rules',
    label: 'Risk Rules',
    icon: '⚠️',
    description: 'Configure automated risk detection rules for accounts and opportunities',
  },
  {
    id: 'priority-scoring',
    label: 'Priority Scoring',
    icon: '🎯',
    description: 'Manage priority score components and thresholds',
  },
  {
    id: 'field-mappings',
    label: 'Field Mappings',
    icon: '🔗',
    description: 'Map Salesforce custom fields to application concepts',
  },
  {
    id: 'role-mappings',
    label: 'User Roles',
    icon: '👥',
    description: 'Configure Salesforce profile to application role mappings',
  },
  {
    id: 'display-settings',
    label: 'Display Settings',
    icon: '⚙️',
    description: 'Configure default display preferences and pagination',
  },
  {
    id: 'config-management',
    label: 'Configuration',
    icon: '💾',
    description: 'Import, export, and reset configuration',
  },
];

export default function AdminPanel() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabType>('risk-rules');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  // Fetch current user to verify admin access
  const { data: userData, isLoading: isLoadingUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: async () => {
      const response = await api.get('/auth/user');
      return response.data.data;
    },
  });

  // Fetch current configuration
  const { data: configData, isLoading: isLoadingConfig, error: configError } = useQuery({
    queryKey: ['adminConfig'],
    queryFn: async () => {
      const response = await api.get('/api/admin/config');
      return response.data.data;
    },
    retry: false, // Don't retry if unauthorized
  });

  // Check if user is admin
  useEffect(() => {
    if (!isLoadingUser && userData) {
      const user = userData.user;
      if (!user.isAdmin && user.role !== 'admin') {
        // Not an admin, redirect to dashboard
        navigate('/dashboard');
      }
    }
  }, [userData, isLoadingUser, navigate]);

  // Handle unauthorized access
  useEffect(() => {
    if (configError) {
      const error = configError as any;
      if (error.response?.status === 403) {
        navigate('/dashboard');
      }
    }
  }, [configError, navigate]);

  if (isLoadingUser || isLoadingConfig) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading admin panel...</p>
        </div>
      </div>
    );
  }

  if (!configData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-red-600 font-semibold">Failed to load configuration</p>
          <button
            onClick={() => queryClient.invalidateQueries({ queryKey: ['adminConfig'] })}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const currentTab = TABS.find(t => t.id === activeTab)!;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Admin Control Panel</h1>
              <p className="text-sm text-gray-600 mt-1">
                Configure application settings, rules, and mappings
              </p>
            </div>
            <div className="flex items-center gap-3">
              {saveStatus === 'saving' && (
                <span className="text-sm text-blue-600">
                  <span className="animate-pulse">●</span> Saving...
                </span>
              )}
              {saveStatus === 'saved' && (
                <span className="text-sm text-green-600">
                  ✓ Saved successfully
                </span>
              )}
              {saveStatus === 'error' && (
                <span className="text-sm text-red-600">
                  ✗ Error saving
                </span>
              )}
              <button
                onClick={() => navigate('/dashboard')}
                className="px-4 py-2 text-sm text-gray-700 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                ← Back to Dashboard
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex">
        {/* Sidebar Navigation */}
        <aside className="w-64 bg-white border-r border-gray-200 min-h-[calc(100vh-81px)]">
          <nav className="p-4">
            <div className="space-y-1">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    w-full flex items-start gap-3 px-3 py-2.5 rounded-lg text-left transition-colors
                    ${activeTab === tab.id
                      ? 'bg-blue-50 text-blue-700 font-medium'
                      : 'text-gray-700 hover:bg-gray-50'
                    }
                  `}
                >
                  <span className="text-xl mt-0.5">{tab.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">{tab.label}</div>
                    <div className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                      {tab.description}
                    </div>
                  </div>
                  {activeTab === tab.id && (
                    <div className="w-1 h-full bg-blue-600 rounded-full absolute right-0"></div>
                  )}
                </button>
              ))}
            </div>
          </nav>

          {/* Configuration Info */}
          <div className="p-4 mt-4 border-t border-gray-200">
            <div className="text-xs text-gray-500">
              <div className="font-medium text-gray-700 mb-2">Configuration Info</div>
              {configData.lastModified ? (
                <>
                  <div className="mb-1">
                    Last modified by:
                    <div className="font-medium text-gray-700">{configData.lastModified.by}</div>
                  </div>
                  <div>
                    Date:
                    <div className="font-medium text-gray-700">
                      {new Date(configData.lastModified.date).toLocaleString()}
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-gray-500">No modifications yet</div>
              )}
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 p-6">
          {/* Tab Header */}
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-3xl">{currentTab.icon}</span>
              <h2 className="text-2xl font-bold text-gray-900">{currentTab.label}</h2>
            </div>
            <p className="text-gray-600">{currentTab.description}</p>
          </div>

          {/* Tab Content */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            {activeTab === 'risk-rules' && (
              <RiskRulesTab
                config={configData}
                onSave={(status) => setSaveStatus(status)}
              />
            )}
            {activeTab === 'priority-scoring' && (
              <PriorityScoringTab
                config={configData}
                onSave={(status) => setSaveStatus(status)}
              />
            )}
            {activeTab === 'field-mappings' && (
              <FieldMappingsTab
                config={configData}
                onSave={(status) => setSaveStatus(status)}
              />
            )}
            {activeTab === 'role-mappings' && (
              <RoleMappingsTab
                config={configData}
                onSave={(status) => setSaveStatus(status)}
              />
            )}
            {activeTab === 'display-settings' && (
              <DisplaySettingsTab
                config={configData}
                onSave={(status) => setSaveStatus(status)}
              />
            )}
            {activeTab === 'config-management' && (
              <ConfigManagementTab
                config={configData}
                onSave={(status) => setSaveStatus(status)}
              />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
