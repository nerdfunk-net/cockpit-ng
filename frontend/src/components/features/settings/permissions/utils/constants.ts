import type { User, Role, Permission } from '../types'

// React best practice: Extract default arrays/objects to prevent re-render loops
export const EMPTY_USERS: User[] = []
export const EMPTY_ROLES: Role[] = []
export const EMPTY_PERMISSIONS: Permission[] = []

export const DEFAULT_USER: Partial<{ is_active: boolean; debug: boolean }> = {
  is_active: true,
  debug: false,
} as const

export const CACHE_TIME = {
  USERS: 2 * 60 * 1000,        // 2 minutes
  ROLES: 5 * 60 * 1000,        // 5 minutes (more static)
  PERMISSIONS: 10 * 60 * 1000, // 10 minutes (very static)
} as const
