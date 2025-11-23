import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../services/api';

interface RoleMapping {
  salesforceProfile: string;
  appRole: 'ae' | 'am' | 'csm' | 'admin';
}

interface Props {
  config: any;
  onSave: (status: 'idle' | 'saving' | 'saved' | 'error') => void;
}

const APP_ROLES = [
  { value: 'ae', label: 'Account Executive (AE)', icon: '💼' },
  { value: 'am', label: 'Account Manager (AM)', icon: '🤝' },
  { value: 'csm', label: 'Customer Success Manager (CSM)', icon: '💚' },
  { value: 'admin', label: 'Administrator', icon: '⚙️' },
];

export default function RoleMappingsTab({ config, onSave }: Props) {
  const queryClient = useQueryClient();
  const [mappings, setMappings] = useState<RoleMapping[]>(config.roleMapping || []);
  const [newMapping, setNewMapping] = useState<RoleMapping | null>(null);

  const updateMappingsMutation = useMutation({
    mutationFn: async (updatedMappings: RoleMapping[]) => {
      const response = await api.put('/api/admin/config/role-mappings', {
        mappings: updatedMappings,
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
      console.error('Error updating role mappings:', error);
      onSave('error');
      setTimeout(() => onSave('idle'), 3000);
    },
  });

  const handleSave = () => {
    updateMappingsMutation.mutate(mappings);
  };

  const handleAddMapping = () => {
    setNewMapping({
      salesforceProfile: '',
      appRole: 'ae',
    });
  };

  const handleSaveNewMapping = () => {
    if (!newMapping || !newMapping.salesforceProfile) {
      alert('Salesforce profile name is required');
      return;
    }

    setMappings([...mappings, newMapping]);
    setNewMapping(null);
  };

  const handleUpdateMapping = (profile: string, role: string) => {
    setMappings(mappings.map(m =>
      m.salesforceProfile === profile ? { ...m, appRole: role as any } : m
    ));
  };

  const handleDeleteMapping = (profile: string) => {
    if (confirm('Are you sure you want to delete this mapping?')) {
      setMappings(mappings.filter(m => m.salesforceProfile !== profile));
    }
  };

  const getRoleInfo = (roleValue: string) => {
    return APP_ROLES.find(r => r.value === roleValue) || APP_ROLES[0];
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">User Role Mappings</h3>
          <p className="text-sm text-gray-600 mt-1">
            Map Salesforce profiles to application roles
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleAddMapping}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
          >
            + Add Mapping
          </button>
          <button
            onClick={handleSave}
            disabled={updateMappingsMutation.isPending}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium disabled:bg-gray-400"
          >
            {updateMappingsMutation.isPending ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* Mappings Table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                Salesforce Profile
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                Application Role
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {mappings.map((mapping) => {
              const roleInfo = getRoleInfo(mapping.appRole);
              return (
                <tr key={mapping.salesforceProfile} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{mapping.salesforceProfile}</div>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={mapping.appRole}
                      onChange={(e) => handleUpdateMapping(mapping.salesforceProfile, e.target.value)}
                      className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                    >
                      {APP_ROLES.map(role => (
                        <option key={role.value} value={role.value}>
                          {role.icon} {role.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleDeleteMapping(mapping.salesforceProfile)}
                      className="px-2 py-1 text-sm text-red-600 hover:bg-red-50 rounded"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              );
            })}

            {mappings.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-gray-500">
                  No role mappings configured
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* New Mapping Modal */}
      {newMapping && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Add Role Mapping</h3>

            {/* Salesforce Profile */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Salesforce Profile Name *
              </label>
              <input
                type="text"
                value={newMapping.salesforceProfile}
                onChange={(e) => setNewMapping({ ...newMapping, salesforceProfile: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                placeholder="e.g., Sales User"
              />
            </div>

            {/* App Role */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Application Role
              </label>
              <select
                value={newMapping.appRole}
                onChange={(e) => setNewMapping({ ...newMapping, appRole: e.target.value as any })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                {APP_ROLES.map(role => (
                  <option key={role.value} value={role.value}>
                    {role.icon} {role.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Modal Actions */}
            <div className="flex justify-end gap-2 mt-6 pt-4 border-t">
              <button
                onClick={() => setNewMapping(null)}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveNewMapping}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Add Mapping
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
