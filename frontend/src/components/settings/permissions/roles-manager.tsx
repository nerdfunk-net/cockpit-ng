'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Checkbox } from '@/components/ui/checkbox'
import { Plus, Edit, Trash2, Shield, Lock, Settings } from 'lucide-react'
import { useApi } from '@/hooks/use-api'
import { useToast } from '@/hooks/use-toast'

interface Role {
  id: number
  name: string
  description: string
  is_system: boolean
  created_at: string
  updated_at: string
}

interface Permission {
  id: number
  resource: string
  action: string
  description: string
  granted?: boolean
}

interface RoleWithPermissions extends Role {
  permissions: Permission[]
}

export function RolesManager() {
  const [roles, setRoles] = useState<Role[]>([])
  const [allPermissions, setAllPermissions] = useState<Permission[]>([])
  const [loading, setLoading] = useState(true)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isPermissionsOpen, setIsPermissionsOpen] = useState(false)
  const [selectedRole, setSelectedRole] = useState<RoleWithPermissions | null>(null)
  const [newRole, setNewRole] = useState({ name: '', description: '' })
  const { apiCall } = useApi()
  const { toast } = useToast()

  const loadRoles = useCallback(async () => {
    try {
      setLoading(true)
      const data = await apiCall<Role[]>('rbac/roles')
      setRoles(data)
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to load roles',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [apiCall, toast])

  const loadAllPermissions = useCallback(async () => {
    try {
      const data = await apiCall<Permission[]>('rbac/permissions')
      setAllPermissions(data)
    } catch (error) {
      console.error('Failed to load permissions:', error)
    }
  }, [apiCall])

  useEffect(() => {
    loadRoles()
    loadAllPermissions()
  }, [loadRoles, loadAllPermissions])

  const loadRoleWithPermissions = async (roleId: number) => {
    try {
      const data = await apiCall<RoleWithPermissions>(`rbac/roles/${roleId}`)
      setSelectedRole(data)
      setIsPermissionsOpen(true)
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to load role permissions',
        variant: 'destructive',
      })
    }
  }

  const createRole = async () => {
    if (!newRole.name.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Role name is required',
        variant: 'destructive',
      })
      return
    }

    try {
      await apiCall('rbac/roles', {
        method: 'POST',
        body: JSON.stringify({
          name: newRole.name,
          description: newRole.description,
          is_system: false,
        }),
      })

      toast({
        title: 'Success',
        description: `Role "${newRole.name}" created successfully`,
      })

      setNewRole({ name: '', description: '' })
      setIsCreateOpen(false)
      loadRoles()
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create role',
        variant: 'destructive',
      })
    }
  }

  const updateRole = async () => {
    if (!selectedRole) return

    try {
      await apiCall(`rbac/roles/${selectedRole.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: selectedRole.name,
          description: selectedRole.description,
        }),
      })

      toast({
        title: 'Success',
        description: `Role "${selectedRole.name}" updated successfully`,
      })

      setIsEditOpen(false)
      setSelectedRole(null)
      loadRoles()
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update role',
        variant: 'destructive',
      })
    }
  }

  const deleteRole = async (role: Role) => {
    if (role.is_system) {
      toast({
        title: 'Cannot Delete',
        description: 'System roles cannot be deleted',
        variant: 'destructive',
      })
      return
    }

    if (!confirm(`Are you sure you want to delete the role "${role.name}"?`)) {
      return
    }

    try {
      await apiCall(`rbac/roles/${role.id}`, { method: 'DELETE' })

      toast({
        title: 'Success',
        description: `Role "${role.name}" deleted successfully`,
      })

      loadRoles()
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete role',
        variant: 'destructive',
      })
    }
  }

  const togglePermission = async (permissionId: number, currentlyGranted: boolean) => {
    if (!selectedRole) return

    try {
      if (currentlyGranted) {
        // Remove permission
        await apiCall(`rbac/roles/${selectedRole.id}/permissions/${permissionId}`, {
          method: 'DELETE',
        })
      } else {
        // Add permission
        await apiCall(`rbac/roles/${selectedRole.id}/permissions`, {
          method: 'POST',
          body: JSON.stringify({
            role_id: selectedRole.id,
            permission_id: permissionId,
            granted: true,
          }),
        })
      }

      // Reload role permissions
      const updatedRole = await apiCall<RoleWithPermissions>(`rbac/roles/${selectedRole.id}`)
      setSelectedRole(updatedRole)

      toast({
        title: 'Success',
        description: 'Permission updated successfully',
      })
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update permission',
        variant: 'destructive',
      })
    }
  }

  // Group permissions by resource
  const groupedPermissions = allPermissions.reduce((acc, perm) => {
    if (!acc[perm.resource]) {
      acc[perm.resource] = []
    }
    acc[perm.resource]!.push(perm)
    return acc
  }, {} as Record<string, Permission[]>)

  if (loading) {
    return <div className="text-center py-8">Loading roles...</div>
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">System Roles</h3>
          <p className="text-sm text-slate-600">{roles.length} roles configured</p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Create Role
        </Button>
      </div>

      {/* Roles Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {roles.map((role) => (
              <TableRow key={role.id}>
                <TableCell className="font-medium flex items-center gap-2">
                  <Shield className="h-4 w-4 text-blue-500" />
                  {role.name}
                </TableCell>
                <TableCell className="text-slate-600">{role.description}</TableCell>
                <TableCell>
                  {role.is_system ? (
                    <Badge variant="secondary" className="flex items-center gap-1 w-fit">
                      <Lock className="h-3 w-3" />
                      System
                    </Badge>
                  ) : (
                    <Badge variant="outline">Custom</Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => loadRoleWithPermissions(role.id)}
                    >
                      <Settings className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedRole({ ...role, permissions: [] })
                        setIsEditOpen(true)
                      }}
                      disabled={role.is_system}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteRole(role)}
                      disabled={role.is_system}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Create Role Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Role</DialogTitle>
            <DialogDescription>
              Create a custom role with specific permissions
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="role-name">Role Name</Label>
              <Input
                id="role-name"
                placeholder="e.g., config_admin"
                value={newRole.name}
                onChange={(e) => setNewRole({ ...newRole, name: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="role-description">Description</Label>
              <Textarea
                id="role-description"
                placeholder="Describe this role's purpose..."
                value={newRole.description}
                onChange={(e) => setNewRole({ ...newRole, description: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={createRole}>Create Role</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Role Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Role</DialogTitle>
            <DialogDescription>Update role name and description</DialogDescription>
          </DialogHeader>
          {selectedRole && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="edit-role-name">Role Name</Label>
                <Input
                  id="edit-role-name"
                  value={selectedRole.name}
                  onChange={(e) =>
                    setSelectedRole({ ...selectedRole, name: e.target.value })
                  }
                />
              </div>
              <div>
                <Label htmlFor="edit-role-description">Description</Label>
                <Textarea
                  id="edit-role-description"
                  value={selectedRole.description}
                  onChange={(e) =>
                    setSelectedRole({ ...selectedRole, description: e.target.value })
                  }
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={updateRole}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Permissions Management Dialog */}
      <Dialog open={isPermissionsOpen} onOpenChange={setIsPermissionsOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Manage Permissions: {selectedRole?.name}</DialogTitle>
            <DialogDescription>
              Select permissions to assign to this role
            </DialogDescription>
          </DialogHeader>
          {selectedRole && (
            <div className="space-y-6">
              {Object.entries(groupedPermissions).map(([resource, permissions]) => (
                <div key={resource} className="border rounded-lg p-4">
                  <h4 className="font-semibold mb-3 text-blue-600">{resource}</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {permissions.map((perm) => {
                      const isGranted = selectedRole.permissions.some(
                        (p) => p.id === perm.id && p.granted
                      )
                      return (
                        <div key={perm.id} className="flex items-start space-x-2">
                          <Checkbox
                            id={`perm-${perm.id}`}
                            checked={isGranted}
                            onCheckedChange={() => togglePermission(perm.id, isGranted)}
                          />
                          <div className="grid gap-1.5 leading-none">
                            <label
                              htmlFor={`perm-${perm.id}`}
                              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                            >
                              {perm.action}
                            </label>
                            {perm.description && (
                              <p className="text-xs text-slate-500">{perm.description}</p>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setIsPermissionsOpen(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
