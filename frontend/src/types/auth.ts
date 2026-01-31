/**
 * Centralized authentication and authorization type definitions.
 * Import these types instead of defining User/Permission locally.
 */

export interface Permission {
  id: number
  resource: string
  action: string
  description?: string
  granted: boolean
  source: 'role' | 'override'
}

export interface User {
  id: string
  username: string
  email?: string
  roles: string[]
  permissions?: number | Permission[]
}
