export interface User {
  id: number
  username: string
  realname: string
  email: string
  roles?: Role[]
  is_active: boolean
  created_at: string
  updated_at?: string
}

export interface Role {
  id: number
  name: string
  description: string
  is_system: boolean
  created_at: string
  updated_at: string
}

export interface Permission {
  id: number
  resource: string
  action: string
  description: string
  granted?: boolean
  source?: string
  created_at: string
}

export interface RoleWithPermissions extends Role {
  permissions: Permission[]
}

export interface UserWithRoles extends User {
  roles: Role[]
}

export interface PermissionOverride {
  permission_id: number
  user_id: number
  granted: boolean
}

export interface UsersResponse {
  users: User[]
}

// Form data types for validation
export interface CreateUserData {
  username: string
  realname: string
  email: string
  password: string
  is_active: boolean
}

export interface UpdateUserData {
  realname?: string
  email?: string
  password?: string
  is_active?: boolean
}

export interface CreateRoleData {
  name: string
  description: string
}

export interface UpdateRoleData {
  name?: string
  description?: string
}
