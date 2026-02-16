import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';

// Tab Components
import RiskRulesTab from '../components/admin/RiskRulesTab';
import PriorityScoringTab from '../components/admin/PriorityScoringTab';
import FieldMappingsTab from '../components/admin/FieldMappingsTab';
import RoleMappingsTab from '../components/admin/RoleMappingsTab';
import DisplaySettingsTab from '../components/admin/DisplaySettingsTab';
import HubLayoutTab from '../components/admin/HubLayoutTab';
import ConfigManagementTab from '../components/admin/ConfigManagementTab';
import AIConfigTab from '../components/admin/AIConfigTab';
import OpportunityStagesTab from '../components/admin/OpportunityStagesTab';
import ForecastSettingsTab from '../components/admin/ForecastSettingsTab';
import OpportunityDetailTab from '../components/admin/OpportunityDetailTab';

type TabType = 'risk-rules' | 'priority-scoring' | 'field-mappings' | 'opportunity-stages' | 'opportunity-detail' | 'forecast-settings' | 'role-mappings' | 'display-settings' | 'hub-layout' | 'ai-config' | 'config-management';

interface TabConfig {
  id: TabType;
  label: string;
  icon: string;
}

interface SidebarGroup {
  id: string;
  label: string;
  icon: string;
  tabs: TabConfig[];
}

const SIDEBAR_GROUPS: SidebarGroup[] = [
  {
    id: 'scoring-risk',
    label: 'Risk & Scoring',
    icon: '🎯',
    tabs: [
      { id: 'risk-rules', label: 'Risk Rules', icon: '⚠️' },
      { id: 'priority-scoring', label: 'Priority Scoring', icon: '🎯' },
      { id: 'forecast-settings', label: 'Forecast Settings', icon: '📊' },
    ],
  },
  {
    id: 'opportunities',
    label: 'Opportunities',
    icon: '📋',
    tabs: [
      { id: 'opportunity-stages', label: 'Stages', icon: '📊' },
      { id: 'opportunity-detail', label: 'Detail Layout', icon: '📋' },
    ],
  },
  {
    id: 'layout-branding',
    label: 'Layout & Branding',
    icon: '🎨',
    tabs: [
      { id: 'field-mappings', label: 'Field Mappings', icon: '🔗' },
      { id: 'display-settings', label: 'Display & Branding', icon: '⚙️' },
      { id: 'hub-layout', label: 'Hub Layout', icon: '🏠' },
    ],
  },
  {
    id: 'users-integrations',
    label: 'Users & Integrations',
    icon: '👥',
    tabs: [
      { id: 'role-mappings', label: 'User Roles', icon: '👥' },
      { id: 'ai-config', label: 'AI Configuration', icon: '🤖' },
    ],
  },
  {
    id: 'system',
    label: 'System',
    icon: '💾',
    tabs: [
      { id: 'config-management', label: 'Import / Export', icon: '💾' },
    ],
  },
];

// Flat lookup for tab metadata
const ALL_TABS: TabConfig[] = SIDEBAR_GROUPS.flatMap(g => g.tabs);

// Find which group a tab belongs to
function groupForTab(tabId: TabType): string {
  return SIDEBAR_GROUPS.find(g => g.tabs.some(t => t.id === tabId))?.id || '';
}

export default function AdminPanel() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabType>('risk-rules');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => new Set([groupForTab('risk-rules')]));

  const toggleGroup = (groupId: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  const handleTabClick = (tabId: TabType) => {
    setActiveTab(tabId);
    // Auto-expand the group when a tab is selected
    const gId = groupForTab(tabId);
    if (gId) setExpandedGroups(prev => new Set(prev).add(gId));
  };

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

  const currentTab = ALL_TABS.find(t => t.id === activeTab)!;
  const currentGroup = SIDEBAR_GROUPS.find(g => g.tabs.some(t => t.id === activeTab));

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
        <aside className="w-56 bg-white border-r border-gray-200 min-h-[calc(100vh-81px)]">
          <nav className="py-3">
            {SIDEBAR_GROUPS.map((group) => {
              const isExpanded = expandedGroups.has(group.id);
              const hasActiveTab = group.tabs.some(t => t.id === activeTab);

              return (
                <div key={group.id} className="mb-0.5">
                  {/* Group header */}
                  <button
                    onClick={() => toggleGroup(group.id)}
                    className={`w-full flex items-center gap-2 px-4 py-2 text-left transition-colors ${
                      hasActiveTab ? 'text-blue-700' : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <svg
                      className={`w-3 h-3 text-gray-400 transition-transform flex-shrink-0 ${isExpanded ? 'rotate-90' : ''}`}
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                    </svg>
                    <span className="text-xs font-semibold uppercase tracking-wider">{group.label}</span>
                  </button>

                  {/* Tabs within group */}
                  {isExpanded && (
                    <div className="ml-5 border-l border-gray-200">
                      {group.tabs.map((tab) => (
                        <button
                          key={tab.id}
                          onClick={() => handleTabClick(tab.id)}
                          className={`w-full flex items-center gap-2 pl-4 pr-3 py-1.5 text-left text-sm transition-colors ${
                            activeTab === tab.id
                              ? 'text-blue-700 font-medium bg-blue-50 border-l-2 border-blue-600 -ml-px'
                              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                          }`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>

          {/* Configuration Info */}
          {configData.lastModified && (
            <div className="px-4 py-3 border-t border-gray-200">
              <div className="text-xs text-gray-400">
                Last saved by <span className="text-gray-600">{configData.lastModified.by}</span>
                <br />
                {new Date(configData.lastModified.date).toLocaleDateString()}
              </div>
            </div>
          )}
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 p-6">
          {/* Tab Header */}
          <div className="mb-6">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">{currentGroup?.label}</span>
              <span className="text-gray-300">/</span>
              <h2 className="text-lg font-bold text-gray-900">{currentTab.label}</h2>
            </div>
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
            {activeTab === 'opportunity-stages' && (
              <OpportunityStagesTab
                config={configData}
                onSave={(status) => setSaveStatus(status)}
              />
            )}
            {activeTab === 'opportunity-detail' && (
              <OpportunityDetailTab
                config={configData}
                onSave={(status) => setSaveStatus(status)}
              />
            )}
            {activeTab === 'forecast-settings' && (
              <ForecastSettingsTab
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
            {activeTab === 'hub-layout' && (
              <HubLayoutTab
                config={configData}
                onSave={(status) => setSaveStatus(status)}
              />
            )}
            {activeTab === 'ai-config' && <AIConfigTab />}
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
