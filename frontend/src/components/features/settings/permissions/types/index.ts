export interface User {
  id: number
  username: string
  realname: string
  email: string
  roles?: Role[]
  is_active: boolean
  last_login?: string | null
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

// User deletion impact preview (GET /rbac/users/{id}/deletion-impact)
export interface UserDeletionImpactTemplate {
  id: number
  name: string
  job_type: string
}

export interface UserDeletionImpactSchedule {
  id: number
  job_identifier: string
  template_name: string | null
}

export interface UserDeletionImpactCascadeSchedule {
  id: number
  job_identifier: string
  owner_user_id: number | null
  is_global: boolean
}

export interface UserDeletionImpact {
  user_id: number
  username: string
  global_templates: UserDeletionImpactTemplate[]
  global_schedules: UserDeletionImpactSchedule[]
  private_templates: UserDeletionImpactTemplate[]
  private_schedules: UserDeletionImpactSchedule[]
  cascade_schedules_from_other_users: UserDeletionImpactCascadeSchedule[]
  private_credentials_count: number
  requires_global_reassignment: boolean
  requires_private_confirmation: boolean
}
