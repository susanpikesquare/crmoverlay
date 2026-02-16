/**
 * Object Permissions Service
 *
 * Uses Salesforce describeGlobal() to determine which objects the current
 * user can access, create, update, and delete.
 * Results are cached for 30 minutes via sessionMetadataCache.
 */

import { Connection } from 'jsforce';
import { metadataCache } from './sessionMetadataCache';

const CACHE_NAMESPACE = 'objectPermissions';

export interface ObjectPermission {
  accessible: boolean;
  createable: boolean;
  updateable: boolean;
  deletable: boolean;
  label: string;
}

export type ObjectPermissionsMap = Record<string, ObjectPermission>;

/**
 * Get object-level permissions for all objects visible to the current user.
 */
export async function getObjectPermissions(
  connection: Connection,
  userId: string,
  orgId: string
): Promise<ObjectPermissionsMap> {
  // Check cache
  const cached = metadataCache.get<ObjectPermissionsMap>(userId, orgId, CACHE_NAMESPACE);
  if (cached) {
    return cached;
  }

  try {
    const globalDescribe = await connection.describeGlobal();

    const permissions: ObjectPermissionsMap = {};
    for (const obj of globalDescribe.sobjects) {
      permissions[obj.name] = {
        accessible: obj.queryable ?? false,
        createable: obj.createable ?? false,
        updateable: obj.updateable ?? false,
        deletable: obj.deletable ?? false,
        label: obj.label,
      };
    }

    // Cache for 30 minutes
    metadataCache.set(userId, orgId, CACHE_NAMESPACE, permissions);

    return permissions;
  } catch (error: any) {
    console.error('Error fetching object permissions:', error.message);
    return {};
  }
}

/**
 * Check if a specific object is accessible to the current user
 */
export async function isObjectAccessible(
  connection: Connection,
  objectType: string,
  userId: string,
  orgId: string
): Promise<boolean> {
  const permissions = await getObjectPermissions(connection, userId, orgId);
  return permissions[objectType]?.accessible ?? false;
}
