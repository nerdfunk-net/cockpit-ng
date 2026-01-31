/**
 * Permission utilities for checking user permissions in the frontend.
 *
 * The RBAC system uses a permission format of "resource:action"
 * (e.g., "nautobot.devices:read", "dashboard.settings:read")
 */

import type { User } from '@/types/auth'

/**
 * Check if a user has a specific permission.
 *
 * @param user - User object from auth store
 * @param resource - Permission resource (e.g., "dashboard.settings")
 * @param action - Permission action (e.g., "read", "write", "execute")
 * @returns true if user has the permission, false otherwise
 */
export function hasPermission(
  user: User | null,
  resource: string,
  action: string
): boolean {
  if (!user) return false

  // If permissions is an array (RBAC system), check for the specific permission
  if (Array.isArray(user.permissions)) {
    return user.permissions.some(
      (perm) =>
        perm.resource === resource &&
        perm.action === action &&
        perm.granted === true
    )
  }

  // Legacy fallback: if user is admin role, grant all permissions
  // This ensures backward compatibility
  if (user.roles?.includes('admin')) {
    return true
  }

  return false
}

/**
 * Check if a user has any of the specified permissions.
 *
 * @param user - User object from auth store
 * @param resource - Permission resource
 * @param actions - Array of actions to check
 * @returns true if user has at least one of the permissions
 */
export function hasAnyPermission(
  user: User | null,
  resource: string,
  actions: string[]
): boolean {
  return actions.some((action) => hasPermission(user, resource, action))
}

/**
 * Check if a user has all of the specified permissions.
 *
 * @param user - User object from auth store
 * @param resource - Permission resource
 * @param actions - Array of actions to check
 * @returns true if user has all of the permissions
 */
export function hasAllPermissions(
  user: User | null,
  resource: string,
  actions: string[]
): boolean {
  return actions.every((action) => hasPermission(user, resource, action))
}

/**
 * Check if a user has a specific role.
 *
 * @param user - User object from auth store
 * @param roleName - Role name to check (e.g., "admin", "network_engineer")
 * @returns true if user has the role
 */
export function hasRole(user: User | null, roleName: string): boolean {
  if (!user) return false
  return user.roles?.includes(roleName) || false
}
