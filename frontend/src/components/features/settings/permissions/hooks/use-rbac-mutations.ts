import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import { useToast } from '@/hooks/use-toast'
import type { CreateUserData, UpdateUserData, CreateRoleData, UpdateRoleData } from '../types'
import { useMemo } from 'react'

export function useRbacMutations() {
  const { apiCall } = useApi()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  // User mutations
  const createUser = useMutation({
    mutationFn: async (data: CreateUserData) => {
      return apiCall('rbac/users', {
        method: 'POST',
        body: JSON.stringify(data)
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.rbac.users() })
      toast({
        title: 'Success',
        description: 'User created successfully',
      })
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: `Failed to create user: ${error.message}`,
        variant: 'destructive'
      })
    }
  })

  const updateUser = useMutation({
    mutationFn: async ({ userId, data }: { userId: number; data: UpdateUserData }) => {
      return apiCall(`rbac/users/${userId}`, {
        method: 'PUT',
        body: JSON.stringify(data)
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.rbac.users() })
      toast({
        title: 'Success',
        description: 'User updated successfully',
      })
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: `Failed to update user: ${error.message}`,
        variant: 'destructive'
      })
    }
  })

  const deleteUser = useMutation({
    mutationFn: async (userId: number) => {
      return apiCall(`rbac/users/${userId}`, { method: 'DELETE' })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.rbac.users() })
      toast({
        title: 'Success',
        description: 'User deleted successfully',
      })
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: `Failed to delete user: ${error.message}`,
        variant: 'destructive'
      })
    }
  })

  // Role mutations
  const createRole = useMutation({
    mutationFn: async (data: CreateRoleData) => {
      return apiCall('rbac/roles', {
        method: 'POST',
        body: JSON.stringify(data)
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.rbac.roles() })
      toast({ title: 'Success', description: 'Role created successfully' })
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: `Failed to create role: ${error.message}`,
        variant: 'destructive'
      })
    }
  })

  const updateRole = useMutation({
    mutationFn: async ({ roleId, data }: { roleId: number; data: UpdateRoleData }) => {
      return apiCall(`rbac/roles/${roleId}`, {
        method: 'PUT',
        body: JSON.stringify(data)
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.rbac.roles() })
      toast({ title: 'Success', description: 'Role updated successfully' })
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: `Failed to update role: ${error.message}`,
        variant: 'destructive'
      })
    }
  })

  const deleteRole = useMutation({
    mutationFn: async (roleId: number) => {
      return apiCall(`rbac/roles/${roleId}`, { method: 'DELETE' })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.rbac.roles() })
      toast({ title: 'Success', description: 'Role deleted successfully' })
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: `Failed to delete role: ${error.message}`,
        variant: 'destructive'
      })
    }
  })

  // User-role assignment mutations
  const assignRoleToUser = useMutation({
    mutationFn: async ({ userId, roleId }: { userId: number; roleId: number }) => {
      return apiCall(`rbac/users/${userId}/roles`, {
        method: 'POST',
        body: JSON.stringify({ user_id: userId, role_id: roleId })
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.rbac.users() })
      toast({ title: 'Success', description: 'Role assigned to user' })
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: `Failed to assign role: ${error.message}`,
        variant: 'destructive'
      })
    }
  })

  const removeRoleFromUser = useMutation({
    mutationFn: async ({ userId, roleId }: { userId: number; roleId: number }) => {
      return apiCall(`rbac/users/${userId}/roles/${roleId}`, { method: 'DELETE' })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.rbac.users() })
      toast({ title: 'Success', description: 'Role removed from user' })
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: `Failed to remove role: ${error.message}`,
        variant: 'destructive'
      })
    }
  })

  // Permission assignment mutations
  const toggleRolePermission = useMutation({
    mutationFn: async ({ roleId, permissionId, granted }: { roleId: number; permissionId: number; granted: boolean }) => {
      if (granted) {
        // Remove permission
        return apiCall(`rbac/roles/${roleId}/permissions/${permissionId}`, { method: 'DELETE' })
      } else {
        // Add permission
        return apiCall(`rbac/roles/${roleId}/permissions`, {
          method: 'POST',
          body: JSON.stringify({ role_id: roleId, permission_id: permissionId, granted: true })
        })
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.rbac.rolePermissions(variables.roleId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.rbac.roles() })
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: `Failed to update permission: ${error.message}`,
        variant: 'destructive'
      })
    }
  })

  const setUserPermissionOverride = useMutation({
    mutationFn: async ({ userId, permissionId, granted }: { userId: number; permissionId: number; granted: boolean }) => {
      return apiCall(`rbac/users/${userId}/permissions`, {
        method: 'POST',
        body: JSON.stringify({ user_id: userId, permission_id: permissionId, granted })
      })
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.rbac.userPermissions(variables.userId) })
      toast({
        title: 'Success',
        description: `Permission ${variables.granted ? 'granted' : 'denied'} for user`
      })
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: `Failed to set permission override: ${error.message}`,
        variant: 'destructive'
      })
    }
  })

  const removeUserPermissionOverride = useMutation({
    mutationFn: async ({ userId, permissionId }: { userId: number; permissionId: number }) => {
      return apiCall(`rbac/users/${userId}/permissions/${permissionId}`, {
        method: 'DELETE'
      })
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.rbac.userPermissions(variables.userId) })
      toast({
        title: 'Success',
        description: 'Override removed'
      })
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: `Failed to remove override: ${error.message}`,
        variant: 'destructive'
      })
    }
  })

  // Memoize return object to prevent re-renders
  return useMemo(() => ({
    createUser,
    updateUser,
    deleteUser,
    createRole,
    updateRole,
    deleteRole,
    assignRoleToUser,
    removeRoleFromUser,
    toggleRolePermission,
    setUserPermissionOverride,
    removeUserPermissionOverride,
  }), [
    createUser,
    updateUser,
    deleteUser,
    createRole,
    updateRole,
    deleteRole,
    assignRoleToUser,
    removeRoleFromUser,
    toggleRolePermission,
    setUserPermissionOverride,
    removeUserPermissionOverride
  ])
}
