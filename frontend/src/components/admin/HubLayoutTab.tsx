import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../services/api';

interface HubSectionConfig {
  id: string;
  name: string;
  enabled: boolean;
  order: number;
}

interface CustomLink {
  id: string;
  title: string;
  url: string;
  description?: string;
  icon?: string;
}

interface RoleHubConfig {
  sections: HubSectionConfig[];
  customLinks: CustomLink[];
}

interface HubLayoutConfig {
  ae: RoleHubConfig;
  am: RoleHubConfig;
  csm: RoleHubConfig;
  salesLeader: RoleHubConfig;
  executive: RoleHubConfig;
}

interface Props {
  config: any;
  onSave: (status: 'idle' | 'saving' | 'saved' | 'error') => void;
}

export default function HubLayoutTab({ config, onSave }: Props) {
  const queryClient = useQueryClient();
  const [hubLayout, setHubLayout] = useState<HubLayoutConfig>(() => {
    const defaults = getDefaultHubLayout();
    const stored = config.hubLayout || defaults;
    // Ensure executive config exists (backward compatibility)
    if (!stored.executive) stored.executive = defaults.executive;
    return stored;
  }
  );
  const [selectedRole, setSelectedRole] = useState<'ae' | 'am' | 'csm' | 'salesLeader' | 'executive'>('ae');
  const [editingLink, setEditingLink] = useState<CustomLink | null>(null);
  const [showLinkDialog, setShowLinkDialog] = useState(false);

  function getDefaultHubLayout(): HubLayoutConfig {
    return {
      ae: {
        sections: [
          { id: 'metrics', name: 'Key Metrics', enabled: true, order: 1 },
          { id: 'ai-assistant', name: 'AI Assistant', enabled: true, order: 2 },
          { id: 'priorities', name: "Today's Priorities", enabled: true, order: 3 },
          { id: 'forecast', name: 'Pipeline Forecast', enabled: true, order: 4 },
          { id: 'priority-accounts', name: 'Priority Actions', enabled: true, order: 5 },
          { id: 'at-risk-deals', name: 'At-Risk Deals', enabled: true, order: 6 },
          { id: 'custom-links', name: 'Quick Links', enabled: true, order: 7 },
        ],
        customLinks: [],
      },
      am: {
        sections: [
          { id: 'metrics', name: 'Key Metrics', enabled: true, order: 1 },
          { id: 'ai-assistant', name: 'AI Assistant', enabled: true, order: 2 },
          { id: 'priorities', name: "Today's Priorities", enabled: true, order: 3 },
          { id: 'renewals', name: 'Upcoming Renewals', enabled: true, order: 4 },
          { id: 'expansion', name: 'Expansion Opportunities', enabled: true, order: 5 },
          { id: 'custom-links', name: 'Quick Links', enabled: true, order: 6 },
        ],
        customLinks: [],
      },
      csm: {
        sections: [
          { id: 'metrics', name: 'Key Metrics', enabled: true, order: 1 },
          { id: 'ai-assistant', name: 'AI Assistant', enabled: true, order: 2 },
          { id: 'priorities', name: "Today's Priorities", enabled: true, order: 3 },
          { id: 'at-risk', name: 'At-Risk Accounts', enabled: true, order: 4 },
          { id: 'health', name: 'Health Score Trends', enabled: true, order: 5 },
          { id: 'custom-links', name: 'Quick Links', enabled: true, order: 6 },
        ],
        customLinks: [],
      },
      salesLeader: {
        sections: [
          { id: 'metrics', name: 'Key Metrics', enabled: true, order: 1 },
          { id: 'ai-assistant', name: 'AI Assistant', enabled: true, order: 2 },
          { id: 'team-performance', name: 'Team Performance', enabled: true, order: 3 },
          { id: 'pipeline', name: 'Pipeline Analysis', enabled: true, order: 4 },
          { id: 'forecasts', name: 'Forecasts', enabled: true, order: 5 },
          { id: 'custom-links', name: 'Quick Links', enabled: true, order: 6 },
        ],
        customLinks: [],
      },
      executive: {
        sections: [
          { id: 'metrics', name: 'Executive Summary', enabled: true, order: 1 },
          { id: 'ai-assistant', name: 'AI Assistant', enabled: true, order: 2 },
          { id: 'priorities', name: 'Executive Priorities', enabled: true, order: 3 },
          { id: 'at-risk-deals', name: 'At-Risk Deals', enabled: true, order: 4 },
          { id: 'new-business', name: 'New Business', enabled: true, order: 5 },
          { id: 'renewals', name: 'Renewals & Retention', enabled: true, order: 6 },
          { id: 'customer-health', name: 'Customer Health', enabled: true, order: 7 },
          { id: 'team-performance', name: 'Team Performance', enabled: true, order: 8 },
          { id: 'custom-links', name: 'Quick Links', enabled: true, order: 9 },
        ],
        customLinks: [],
      },
    };
  }

  const updateHubLayoutMutation = useMutation({
    mutationFn: async (updatedLayout: HubLayoutConfig) => {
      const response = await api.put('/api/admin/config/hub-layout', {
        hubLayout: updatedLayout,
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
      console.error('Error updating hub layout:', error);
      onSave('error');
      setTimeout(() => onSave('idle'), 3000);
    },
  });

  const handleToggleSection = (sectionId: string) => {
    const roleConfig = hubLayout[selectedRole];
    const updatedSections = roleConfig.sections.map((section) =>
      section.id === sectionId ? { ...section, enabled: !section.enabled } : section
    );

    setHubLayout({
      ...hubLayout,
      [selectedRole]: { ...roleConfig, sections: updatedSections },
    });
  };

  const handleMoveSection = (sectionId: string, direction: 'up' | 'down') => {
    const roleConfig = hubLayout[selectedRole];
    const sections = [...roleConfig.sections].sort((a, b) => a.order - b.order);
    const index = sections.findIndex((s) => s.id === sectionId);

    if (
      (direction === 'up' && index > 0) ||
      (direction === 'down' && index < sections.length - 1)
    ) {
      const newIndex = direction === 'up' ? index - 1 : index + 1;
      [sections[index], sections[newIndex]] = [sections[newIndex], sections[index]];

      const updatedSections = sections.map((section, idx) => ({
        ...section,
        order: idx + 1,
      }));

      setHubLayout({
        ...hubLayout,
        [selectedRole]: { ...roleConfig, sections: updatedSections },
      });
    }
  };

  const handleSave = () => {
    updateHubLayoutMutation.mutate(hubLayout);
  };

  const handleAddLink = () => {
    setEditingLink({
      id: Date.now().toString(),
      title: '',
      url: '',
      description: '',
      icon: '🔗',
    });
    setShowLinkDialog(true);
  };

  const handleEditLink = (link: CustomLink) => {
    setEditingLink(link);
    setShowLinkDialog(true);
  };

  const handleSaveLink = () => {
    if (!editingLink) return;

    const roleConfig = hubLayout[selectedRole];
    const existingLinkIndex = roleConfig.customLinks.findIndex(
      (l) => l.id === editingLink.id
    );

    let updatedLinks;
    if (existingLinkIndex >= 0) {
      updatedLinks = roleConfig.customLinks.map((l) =>
        l.id === editingLink.id ? editingLink : l
      );
    } else {
      updatedLinks = [...roleConfig.customLinks, editingLink];
    }

    setHubLayout({
      ...hubLayout,
      [selectedRole]: { ...roleConfig, customLinks: updatedLinks },
    });

    setShowLinkDialog(false);
    setEditingLink(null);
  };

  const handleDeleteLink = (linkId: string) => {
    const roleConfig = hubLayout[selectedRole];
    const updatedLinks = roleConfig.customLinks.filter((l) => l.id !== linkId);

    setHubLayout({
      ...hubLayout,
      [selectedRole]: { ...roleConfig, customLinks: updatedLinks },
    });
  };

  const roleConfig = hubLayout[selectedRole];
  const sortedSections = [...roleConfig.sections].sort((a, b) => a.order - b.order);

  const roleLabels = {
    ae: 'Account Executive',
    am: 'Account Manager',
    csm: 'Customer Success Manager',
    salesLeader: 'Sales Leader',
    executive: 'Executive',
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="text-lg font-semibold">Hub Layout Configuration</h3>
          <p className="text-sm text-gray-600">Customize sections and add custom links for each role</p>
        </div>
        <button
          onClick={handleSave}
          disabled={updateHubLayoutMutation.isPending}
          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
        >
          {updateHubLayoutMutation.isPending ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      <div className="mb-6">
        <div className="flex gap-2 border-b">
          {Object.entries(roleLabels).map(([role, label]) => (
            <button
              key={role}
              onClick={() => setSelectedRole(role as any)}
              className={`px-4 py-2 ${
                selectedRole === role ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg border mb-6">
        <h4 className="font-semibold mb-4">Page Sections</h4>
        <div className="space-y-2">
          {sortedSections.map((section, index) => (
            <div key={section.id} className="flex items-center justify-between p-3 border rounded">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={section.enabled}
                  onChange={() => handleToggleSection(section.id)}
                  className="w-5 h-5"
                />
                <span>{section.name}</span>
                {!section.enabled && <span className="text-gray-500 italic text-sm">(Hidden)</span>}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleMoveSection(section.id, 'up')}
                  disabled={index === 0}
                  className="px-2 py-1 disabled:opacity-30"
                >
                  ↑
                </button>
                <button
                  onClick={() => handleMoveSection(section.id, 'down')}
                  disabled={index === sortedSections.length - 1}
                  className="px-2 py-1 disabled:opacity-30"
                >
                  ↓
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg border">
        <div className="flex justify-between items-center mb-4">
          <h4 className="font-semibold">Custom Links</h4>
          <button
            onClick={handleAddLink}
            className="px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            + Add Link
          </button>
        </div>

        {roleConfig.customLinks.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No custom links configured</p>
        ) : (
          <div className="space-y-2">
            {roleConfig.customLinks.map((link) => (
              <div key={link.id} className="flex items-center justify-between p-3 border rounded">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{link.icon || '🔗'}</span>
                  <div>
                    <div className="font-medium">{link.title}</div>
                    <div className="text-xs text-gray-500">{link.url}</div>
                    {link.description && <div className="text-xs text-gray-600 mt-1">{link.description}</div>}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleEditLink(link)} className="px-2 py-1 text-blue-600">
                    Edit
                  </button>
                  <button onClick={() => handleDeleteLink(link.id)} className="px-2 py-1 text-red-600">
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showLinkDialog && editingLink && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-lg w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">
              {roleConfig.customLinks.some((l) => l.id === editingLink.id) ? 'Edit Link' : 'Add Link'}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Icon (Emoji)</label>
                <input
                  type="text"
                  value={editingLink.icon || ''}
                  onChange={(e) => setEditingLink({ ...editingLink, icon: e.target.value })}
                  className="w-full px-3 py-2 border rounded"
                  placeholder="🔗"
                  maxLength={2}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Title *</label>
                <input
                  type="text"
                  value={editingLink.title}
                  onChange={(e) => setEditingLink({ ...editingLink, title: e.target.value })}
                  className="w-full px-3 py-2 border rounded"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">URL *</label>
                <input
                  type="url"
                  value={editingLink.url}
                  onChange={(e) => setEditingLink({ ...editingLink, url: e.target.value })}
                  className="w-full px-3 py-2 border rounded"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Description</label>
                <textarea
                  value={editingLink.description || ''}
                  onChange={(e) => setEditingLink({ ...editingLink, description: e.target.value })}
                  className="w-full px-3 py-2 border rounded"
                  rows={2}
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowLinkDialog(false);
                  setEditingLink(null);
                }}
                className="flex-1 px-4 py-2 border rounded hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveLink}
                disabled={!editingLink.title || !editingLink.url}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                Save Link
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
