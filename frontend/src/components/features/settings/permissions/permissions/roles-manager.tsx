'use client'

import { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Plus, Edit, Trash2, Shield, Lock, Settings } from 'lucide-react'
import { useRbacRoles, useRbacPermissions, useRolePermissions } from '../hooks/use-rbac-queries'
import { useRbacMutations } from '../hooks/use-rbac-mutations'
import { RoleDialog } from '../components/dialogs/role-dialog'
import { RolePermissionsDialog } from '../components/dialogs/role-permissions-dialog'
import { RBACDataTable } from '../components/rbac-data-table'
import { RBACLoading } from '../components/rbac-loading'
import type { Role, CreateRoleData, UpdateRoleData } from '../types'
import { EMPTY_ROLES, EMPTY_PERMISSIONS } from '../utils/constants'

export function RolesManager() {
  // TanStack Query hooks
  const { data: roles = EMPTY_ROLES, isLoading: rolesLoading } = useRbacRoles()
  const { data: allPermissions = EMPTY_PERMISSIONS } = useRbacPermissions()
  const { createRole, updateRole, deleteRole, toggleRolePermission } = useRbacMutations()

  // Client-side UI state
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isPermissionsOpen, setIsPermissionsOpen] = useState(false)
  const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null)
  const [editingRole, setEditingRole] = useState<Role | null>(null)

  // Load role with permissions when managing permissions
  const { data: selectedRoleWithPermissions } = useRolePermissions(selectedRoleId, {
    enabled: isPermissionsOpen && !!selectedRoleId
  })

  const handleCreateSubmit = useCallback((data: CreateRoleData) => {
    createRole.mutate(data)
    setIsCreateOpen(false)
  }, [createRole])

  const handleEditSubmit = useCallback((data: UpdateRoleData) => {
    if (editingRole) {
      updateRole.mutate({ roleId: editingRole.id, data })
      setIsEditOpen(false)
      setEditingRole(null)
    }
  }, [editingRole, updateRole])

  const handleDelete = useCallback((roleId: number, isSystem: boolean) => {
    if (isSystem) {
      alert('System roles cannot be deleted')
      return
    }
    if (confirm('Are you sure you want to delete this role?')) {
      deleteRole.mutate(roleId)
    }
  }, [deleteRole])

  const handleEditRole = useCallback((role: Role) => {
    setEditingRole(role)
    setIsEditOpen(true)
  }, [])

  const handleManagePermissions = useCallback((roleId: number) => {
    setSelectedRoleId(roleId)
    setIsPermissionsOpen(true)
  }, [])

  const handleTogglePermission = useCallback((permissionId: number, granted: boolean) => {
    if (selectedRoleId) {
      toggleRolePermission.mutate({ roleId: selectedRoleId, permissionId, granted })
    }
  }, [selectedRoleId, toggleRolePermission])

  const handlePermissionsDialogClose = useCallback(() => {
    setIsPermissionsOpen(false)
    setSelectedRoleId(null)
  }, [])

  if (rolesLoading) {
    return <RBACLoading message="Loading roles..." />
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">System Roles</h3>
          <p className="text-sm text-muted-foreground">{roles.length} roles configured</p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Create Role
        </Button>
      </div>

      <RBACDataTable
        data={roles}
        columns={[
          {
            header: 'Name',
            accessor: (role) => (
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-blue-500" />
                <span className="font-medium">{role.name}</span>
              </div>
            )
          },
          {
            header: 'Description',
            accessor: (role) => <span className="text-muted-foreground">{role.description}</span>
          },
          {
            header: 'Type',
            accessor: (role) =>
              role.is_system ? (
                <Badge variant="secondary" className="flex items-center gap-1 w-fit">
                  <Lock className="h-3 w-3" />
                  System
                </Badge>
              ) : (
                <Badge variant="outline">Custom</Badge>
              )
          },
        ]}
        actions={(role) => (
          <div className="flex gap-1 justify-end">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleManagePermissions(role.id)}
              title="Manage Permissions"
            >
              <Settings className="h-4 w-4" />
            </Button>
            {!role.is_system && (
              <>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleEditRole(role)}
                  title="Edit Role"
                >
                  <Edit className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleDelete(role.id, role.is_system)}
                  title="Delete Role"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        )}
        emptyMessage="No roles found"
      />

      <RoleDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        onSubmit={handleCreateSubmit}
        isEdit={false}
      />

      <RoleDialog
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
        onSubmit={handleEditSubmit}
        role={editingRole}
        isEdit={true}
      />

      <RolePermissionsDialog
        open={isPermissionsOpen}
        onOpenChange={handlePermissionsDialogClose}
        role={selectedRoleWithPermissions || null}
        allPermissions={allPermissions}
        onTogglePermission={handleTogglePermission}
      />
    </div>
  )
}
