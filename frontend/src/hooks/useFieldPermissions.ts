/**
 * useFieldPermissions Hook
 *
 * Fetches and caches field-level permissions for a given Salesforce object type.
 * Used to conditionally hide columns and detail sections based on FLS.
 */

import { useQuery } from '@tanstack/react-query';
import apiClient from '../services/api';

interface FieldPermission {
  accessible: boolean;
  updateable: boolean;
  label: string;
  type: string;
}

type FieldPermissionsMap = Record<string, FieldPermission>;

export function useFieldPermissions(objectType: string) {
  const { data, isLoading } = useQuery({
    queryKey: ['fieldPermissions', objectType],
    queryFn: async () => {
      const response = await apiClient.get(`/api/metadata/fields/${objectType}`);
      return response.data.data as FieldPermissionsMap;
    },
    staleTime: 30 * 60 * 1000, // 30 minutes
    enabled: !!objectType,
  });

  const isFieldAccessible = (fieldName: string): boolean => {
    if (!data) return true; // Default to accessible while loading
    const perm = data[fieldName];
    if (!perm) return true; // Unknown fields default to accessible
    return perm.accessible;
  };

  const isFieldUpdateable = (fieldName: string): boolean => {
    if (!data) return false;
    return data[fieldName]?.updateable ?? false;
  };

  const getFieldLabel = (fieldName: string): string => {
    return data?.[fieldName]?.label || fieldName;
  };

  const getFieldType = (fieldName: string): string => {
    return data?.[fieldName]?.type || 'string';
  };

  return {
    permissions: data,
    isLoading,
    isFieldAccessible,
    isFieldUpdateable,
    getFieldLabel,
    getFieldType,
  };
}
