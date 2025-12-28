'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
import { UserPlus, X, ShieldAlert, ShieldCheck } from 'lucide-react'
import { useApi } from '@/hooks/use-api'
import { useToast } from '@/hooks/use-toast'

interface User {
  id: number
  username: string
  realname: string
}

interface Permission {
  id: number
  resource: string
  action: string
  description: string
  granted?: boolean
  source?: string
}

export function UserPermissionsManager() {
  const [users, setUsers] = useState<User[]>([])
  const [allPermissions, setAllPermissions] = useState<Permission[]>([])
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [userOverrides, setUserOverrides] = useState<Permission[]>([])
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const { apiCall } = useApi()
  const { toast } = useToast()

  const loadUsers = useCallback(async () => {
    try {
      const response = await apiCall<{ users: User[] }>('rbac/users')
      setUsers(response.users || [])
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to load users',
        variant: 'destructive',
      })
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

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      await Promise.all([loadUsers(), loadAllPermissions()])
    } finally {
      setLoading(false)
    }
  }, [loadUsers, loadAllPermissions])

  useEffect(() => {
    loadData()
  }, [loadData])

  const loadUserOverrides = async (userId: number) => {
    try {
      const data = await apiCall<Permission[]>(`rbac/users/${userId}/permissions/overrides`)
      console.log('Loaded user overrides:', data)
      setUserOverrides(data)
    } catch (error) {
      console.error('Failed to load user overrides:', error)
      setUserOverrides([])
    }
  }

  const openManageOverrides = async (user: User) => {
    setSelectedUser(user)
    await loadUserOverrides(user.id)
    setIsDialogOpen(true)
  }

  const setPermissionOverride = async (permissionId: number, granted: boolean) => {
    if (!selectedUser) return

    try {
      console.log('Setting permission override:', { userId: selectedUser.id, permissionId, granted })
      await apiCall(`rbac/users/${selectedUser.id}/permissions`, {
        method: 'POST',
        body: JSON.stringify({
          user_id: selectedUser.id,
          permission_id: permissionId,
          granted: granted,
        }),
      })

      console.log('Permission override set successfully, reloading...')
      // Reload overrides
      await loadUserOverrides(selectedUser.id)

      toast({
        title: 'Success',
        description: `Permission ${granted ? 'granted' : 'denied'} for user`,
      })
    } catch (error) {
      console.error('Error setting permission override:', error)
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update permission',
        variant: 'destructive',
      })
    }
  }

  const removeOverride = async (userId: number, permissionId: number) => {
    try {
      await apiCall(`rbac/users/${userId}/permissions/${permissionId}`, {
        method: 'DELETE',
      })

      toast({
        title: 'Success',
        description: 'Override removed',
      })

      // Reload if viewing this user
      if (selectedUser?.id === userId) {
        await loadUserOverrides(userId)
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to remove override',
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
    return <div className="text-center py-8">Loading...</div>
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold">User Permission Overrides</h3>
        <p className="text-sm text-slate-600">
          Grant or deny specific permissions to individual users
        </p>
      </div>

      {/* Info Alert */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex gap-2">
          <ShieldAlert className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800">
            <strong>Note:</strong> Permission overrides take precedence over role-based permissions.
            Use overrides sparingly for exceptions only.
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Current Overrides</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell>
                  <div>
                    <div className="font-medium">{user.realname}</div>
                    <div className="text-sm text-slate-500">@{user.username}</div>
                  </div>
                </TableCell>
                <TableCell>
                  <span className="text-sm text-slate-500">
                    Click &quot;Manage&quot; to view and edit
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openManageOverrides(user)}
                    className="flex items-center gap-2"
                  >
                    <UserPlus className="h-4 w-4" />
                    Manage Overrides
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Manage Overrides Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Permission Overrides: {selectedUser?.realname}
            </DialogTitle>
            <DialogDescription>
              Grant or deny specific permissions for this user. These override role-based permissions.
            </DialogDescription>
          </DialogHeader>

          {selectedUser && (
            <div className="space-y-6">
              {/* Current Overrides */}
              {userOverrides.length > 0 && (
                <div className="border rounded-lg p-4 bg-slate-50">
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-blue-600" />
                    Current Overrides ({userOverrides.length})
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {userOverrides.map((override) => (
                      <Badge
                        key={override.id}
                        variant={override.granted ? 'default' : 'destructive'}
                        className="flex items-center gap-1"
                      >
                        {override.resource}:{override.action}
                        {override.granted ? ' (granted)' : ' (denied)'}
                        <button
                          onClick={() => removeOverride(selectedUser.id, override.id)}
                          className="ml-1 hover:bg-white/20 rounded-full p-0.5"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* All Permissions */}
              <div className="space-y-4">
                <h4 className="font-semibold">Add New Override</h4>
                {Object.entries(groupedPermissions).map(([resource, permissions]) => (
                  <div key={resource} className="border rounded-lg p-4">
                    <h5 className="font-semibold mb-3 text-blue-600">{resource}</h5>
                    <div className="space-y-3">
                      {permissions.map((perm) => {
                        const override = userOverrides.find((o) => o.id === perm.id)
                        const hasOverride = override !== undefined
                        const isGranted = override?.granted
                        const currentValue = !hasOverride ? 'none' : (isGranted ? 'grant' : 'deny')

                        return (
                          <div key={perm.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-slate-50">
                            <div className="flex-1">
                              <div className="font-medium text-sm">{perm.action}</div>
                              {perm.description && (
                                <p className="text-xs text-slate-500 mt-0.5">{perm.description}</p>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <Select
                                key={`${perm.id}-${currentValue}`}
                                value={currentValue}
                                onValueChange={(value) => {
                                  if (value === 'none') {
                                    removeOverride(selectedUser.id, perm.id)
                                  } else {
                                    setPermissionOverride(perm.id, value === 'grant')
                                  }
                                }}
                              >
                                <SelectTrigger className="w-[140px]">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">No Override</SelectItem>
                                  <SelectItem value="grant">Grant</SelectItem>
                                  <SelectItem value="deny">Deny</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button onClick={() => setIsDialogOpen(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
