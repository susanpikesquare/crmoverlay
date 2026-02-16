/**
 * Role Hierarchy Service
 *
 * Queries the Salesforce UserRole hierarchy to determine all subordinate
 * user IDs for a given user. Used for "My Team's" scope filtering.
 *
 * Falls back to ManagerId-based direct reports if no role hierarchy exists.
 * Results are cached for 30 minutes via sessionMetadataCache.
 */

import { Connection } from 'jsforce';
import { metadataCache } from './sessionMetadataCache';
import { escapeSoqlValue } from '../utils/soqlSanitizer';

const CACHE_NAMESPACE = 'roleHierarchy';

interface RoleNode {
  id: string;
  parentRoleId: string | null;
  name: string;
}

interface UserWithRole {
  id: string;
  userRoleId: string | null;
  managerId: string | null;
  isActive: boolean;
}

export interface RoleHierarchyResult {
  userId: string;
  userRoleId: string | null;
  subordinateUserIds: string[];
  source: 'role_hierarchy' | 'manager_id' | 'none';
}

/**
 * Get all subordinate user IDs for a given user, traversing the
 * Salesforce role hierarchy tree.
 */
export async function getRoleHierarchy(
  connection: Connection,
  userId: string,
  orgId: string
): Promise<RoleHierarchyResult> {
  // Check cache first
  const cached = metadataCache.get<RoleHierarchyResult>(userId, orgId, CACHE_NAMESPACE);
  if (cached) {
    return cached;
  }

  try {
    // Query 1: Get all roles
    const rolesResult = await connection.query<any>(
      'SELECT Id, ParentRoleId, Name FROM UserRole'
    );
    const roles: RoleNode[] = (rolesResult.records || []).map((r: any) => ({
      id: r.Id,
      parentRoleId: r.ParentRoleId,
      name: r.Name,
    }));

    // Query 2: Get current user's role
    const userResult = await connection.query<any>(
      `SELECT Id, UserRoleId FROM User WHERE Id = '${escapeSoqlValue(userId)}' LIMIT 1`
    );
    const currentUser = userResult.records?.[0];
    const userRoleId = currentUser?.UserRoleId;

    // Query 3: Get all active users with their roles and managers
    const usersResult = await connection.query<any>(
      'SELECT Id, UserRoleId, ManagerId, IsActive FROM User WHERE IsActive = true'
    );
    const allUsers: UserWithRole[] = (usersResult.records || []).map((u: any) => ({
      id: u.Id,
      userRoleId: u.UserRoleId,
      managerId: u.ManagerId,
      isActive: u.IsActive,
    }));

    let subordinateUserIds: string[] = [];
    let source: 'role_hierarchy' | 'manager_id' | 'none' = 'none';

    if (userRoleId && roles.length > 0) {
      // Build role hierarchy tree and find all subordinate roles
      const subordinateRoleIds = getSubordinateRoleIds(userRoleId, roles);

      // Find all users whose role is in the subordinate set
      subordinateUserIds = allUsers
        .filter(u => u.id !== userId && u.userRoleId && subordinateRoleIds.has(u.userRoleId))
        .map(u => u.id);

      source = 'role_hierarchy';
    }

    // Fallback to ManagerId if no role hierarchy results
    if (subordinateUserIds.length === 0) {
      subordinateUserIds = allUsers
        .filter(u => u.managerId === userId && u.id !== userId)
        .map(u => u.id);

      if (subordinateUserIds.length > 0) {
        source = 'manager_id';
      }
    }

    const result: RoleHierarchyResult = {
      userId,
      userRoleId,
      subordinateUserIds,
      source,
    };

    // Cache for 30 minutes
    metadataCache.set(userId, orgId, CACHE_NAMESPACE, result);

    return result;
  } catch (error: any) {
    console.error('Error fetching role hierarchy:', error.message);
    // Return empty result on error — don't break the request
    return {
      userId,
      userRoleId: null,
      subordinateUserIds: [],
      source: 'none',
    };
  }
}

/**
 * Walk the role tree to find all role IDs that are subordinate to the given role.
 */
function getSubordinateRoleIds(rootRoleId: string, roles: RoleNode[]): Set<string> {
  const childrenByParent = new Map<string, string[]>();
  for (const role of roles) {
    if (role.parentRoleId) {
      const siblings = childrenByParent.get(role.parentRoleId) || [];
      siblings.push(role.id);
      childrenByParent.set(role.parentRoleId, siblings);
    }
  }

  const subordinateIds = new Set<string>();
  const queue = [rootRoleId];

  while (queue.length > 0) {
    const current = queue.shift()!;
    const children = childrenByParent.get(current) || [];
    for (const childId of children) {
      if (!subordinateIds.has(childId)) {
        subordinateIds.add(childId);
        queue.push(childId);
      }
    }
  }

  return subordinateIds;
}
