/**
 * Field-Level Security (FLS) Service
 *
 * Uses Salesforce describe() to determine which fields the current user
 * can access (read) and update (write) for a given object type.
 * Results are cached for 30 minutes via sessionMetadataCache.
 */

import { Connection } from 'jsforce';
import { metadataCache } from './sessionMetadataCache';

const CACHE_NAMESPACE = 'fieldPermissions';

export interface FieldPermission {
  accessible: boolean;
  updateable: boolean;
  label: string;
  type: string;
}

export type FieldPermissionsMap = Record<string, FieldPermission>;

/**
 * Get field permissions for an object type.
 * Uses the user's OAuth connection so results respect their profile/permission set.
 */
export async function getFieldPermissions(
  connection: Connection,
  objectType: string,
  userId: string,
  orgId: string
): Promise<FieldPermissionsMap> {
  const cacheKey = `${CACHE_NAMESPACE}_${objectType}`;

  // Check cache
  const cached = metadataCache.get<FieldPermissionsMap>(userId, orgId, cacheKey);
  if (cached) {
    return cached;
  }

  try {
    const describe = await connection.sobject(objectType).describe();

    const permissions: FieldPermissionsMap = {};
    for (const field of describe.fields) {
      // jsforce typings omit 'accessible' but Salesforce describe API returns it
      const fieldAny = field as any;
      permissions[field.name] = {
        accessible: fieldAny.accessible ?? true,
        updateable: field.updateable ?? false,
        label: field.label,
        type: field.type,
      };
    }

    // Cache for 30 minutes
    metadataCache.set(userId, orgId, cacheKey, permissions);

    return permissions;
  } catch (error: any) {
    console.error(`Error fetching field permissions for ${objectType}:`, error.message);
    return {};
  }
}

/**
 * Get the set of accessible field names for an object type.
 * Convenience wrapper used by QueryBuilder.
 */
export async function getAccessibleFields(
  connection: Connection,
  objectType: string,
  userId: string,
  orgId: string
): Promise<Set<string>> {
  const permissions = await getFieldPermissions(connection, objectType, userId, orgId);
  const accessible = new Set<string>();

  for (const [fieldName, perm] of Object.entries(permissions)) {
    if (perm.accessible) {
      accessible.add(fieldName);
    }
  }

  return accessible;
}
