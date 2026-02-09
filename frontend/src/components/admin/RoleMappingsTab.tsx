import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../services/api';

interface RoleMapping {
  salesforceProfile: string;
  appRole: 'ae' | 'am' | 'csm' | 'admin' | 'executive' | 'sales-leader';
}

interface UserRoleOverride {
  userName: string;
  appRole: 'ae' | 'am' | 'csm' | 'admin' | 'executive' | 'sales-leader';
}

interface Props {
  config: any;
  onSave: (status: 'idle' | 'saving' | 'saved' | 'error') => void;
}

const APP_ROLES = [
  { value: 'ae', label: 'Account Executive (AE)', icon: '💼' },
  { value: 'am', label: 'Account Manager (AM)', icon: '🤝' },
  { value: 'csm', label: 'Customer Success Manager (CSM)', icon: '💚' },
  { value: 'sales-leader', label: 'Sales Leader', icon: '📊' },
  { value: 'executive', label: 'Executive', icon: '👔' },
  { value: 'admin', label: 'Administrator', icon: '⚙️' },
];

export default function RoleMappingsTab({ config, onSave }: Props) {
  const queryClient = useQueryClient();
  const [mappings, setMappings] = useState<RoleMapping[]>(config.roleMapping || []);
  const [newMapping, setNewMapping] = useState<RoleMapping | null>(null);
  const [userOverrides, setUserOverrides] = useState<UserRoleOverride[]>(config.userRoleOverrides || []);
  const [newUserOverride, setNewUserOverride] = useState<UserRoleOverride | null>(null);

  // Profile-based role mappings mutation
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

  // User-name-based role overrides mutation
  const updateUserOverridesMutation = useMutation({
    mutationFn: async (overrides: UserRoleOverride[]) => {
      const response = await api.put('/api/admin/config/user-role-overrides', {
        overrides,
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
      console.error('Error updating user role overrides:', error);
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

  // User override handlers
  const handleSaveUserOverrides = () => {
    updateUserOverridesMutation.mutate(userOverrides);
  };

  const handleAddUserOverride = () => {
    setNewUserOverride({
      userName: '',
      appRole: 'executive',
    });
  };

  const handleSaveNewUserOverride = () => {
    if (!newUserOverride || !newUserOverride.userName) {
      alert('User name or email is required');
      return;
    }

    setUserOverrides([...userOverrides, newUserOverride]);
    setNewUserOverride(null);
  };

  const handleUpdateUserOverride = (userName: string, role: string) => {
    setUserOverrides(userOverrides.map(o =>
      o.userName === userName ? { ...o, appRole: role as any } : o
    ));
  };

  const handleDeleteUserOverride = (userName: string) => {
    if (confirm('Are you sure you want to delete this override?')) {
      setUserOverrides(userOverrides.filter(o => o.userName !== userName));
    }
  };

  const getRoleInfo = (roleValue: string) => {
    return APP_ROLES.find(r => r.value === roleValue) || APP_ROLES[0];
  };

  const isSaving = updateMappingsMutation.isPending || updateUserOverridesMutation.isPending;

  return (
    <div>
      {/* User Role Overrides Section */}
      <div className="mb-10">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">User Role Overrides</h3>
            <p className="text-sm text-gray-600 mt-1">
              Assign roles to specific users by name or email. These take priority over profile-based mappings.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleAddUserOverride}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
            >
              + Add User Override
            </button>
            <button
              onClick={handleSaveUserOverrides}
              disabled={isSaving}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium disabled:bg-gray-400"
            >
              {updateUserOverridesMutation.isPending ? 'Saving...' : 'Save Overrides'}
            </button>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                  User Name or Email
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
              {userOverrides.map((override) => (
                <tr key={override.userName} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{override.userName}</div>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={override.appRole}
                      onChange={(e) => handleUpdateUserOverride(override.userName, e.target.value)}
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
                      onClick={() => handleDeleteUserOverride(override.userName)}
                      className="px-2 py-1 text-sm text-red-600 hover:bg-red-50 rounded"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}

              {userOverrides.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-gray-500">
                    No user role overrides configured
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Profile-based Role Mappings Section */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Profile Role Mappings</h3>
          <p className="text-sm text-gray-600 mt-1">
            Map Salesforce profiles to application roles. Used when no user override matches.
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
            disabled={isSaving}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium disabled:bg-gray-400"
          >
            {updateMappingsMutation.isPending ? 'Saving...' : 'Save Mappings'}
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

      {/* New Profile Mapping Modal */}
      {newMapping && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Add Profile Mapping</h3>

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

      {/* New User Override Modal */}
      {newUserOverride && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Add User Role Override</h3>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                User Full Name or Email *
              </label>
              <input
                type="text"
                value={newUserOverride.userName}
                onChange={(e) => setNewUserOverride({ ...newUserOverride, userName: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                placeholder="e.g., Larysa Wood or larysa@company.com"
              />
              <p className="text-xs text-gray-500 mt-1">
                Matches against the user's Salesforce full name or email (case-insensitive)
              </p>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Application Role
              </label>
              <select
                value={newUserOverride.appRole}
                onChange={(e) => setNewUserOverride({ ...newUserOverride, appRole: e.target.value as any })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                {APP_ROLES.map(role => (
                  <option key={role.value} value={role.value}>
                    {role.icon} {role.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex justify-end gap-2 mt-6 pt-4 border-t">
              <button
                onClick={() => setNewUserOverride(null)}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveNewUserOverride}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Add Override
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
