'use client'

import { useState, useMemo, useCallback } from 'react'
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
import { useRbacUsers, useRbacPermissions, useUserPermissionOverrides } from '../hooks/use-rbac-queries'
import { useRbacMutations } from '../hooks/use-rbac-mutations'
import { RBACLoading } from '../components/rbac-loading'
import { groupPermissionsByResource } from '../utils/rbac-utils'
import { EMPTY_USERS, EMPTY_PERMISSIONS } from '../utils/constants'
import type { User } from '../types'

export function UserPermissionsManager() {
  // TanStack Query - no manual state management
  const { data: users = EMPTY_USERS, isLoading: usersLoading } = useRbacUsers()
  const { data: allPermissions = EMPTY_PERMISSIONS, isLoading: permissionsLoading } = useRbacPermissions()

  // Client-side UI state only
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  // Load overrides only when dialog is open and user is selected
  const { data: userOverrides = EMPTY_PERMISSIONS } = useUserPermissionOverrides(
    selectedUser?.id || null,
    { enabled: isDialogOpen && !!selectedUser }
  )

  const { setUserPermissionOverride, removeUserPermissionOverride } = useRbacMutations()

  // Derived state with useMemo
  const groupedPermissions = useMemo(
    () => groupPermissionsByResource(allPermissions),
    [allPermissions]
  )

  const handleOpenDialog = useCallback((user: User) => {
    setSelectedUser(user)
    setIsDialogOpen(true)
  }, [])

  const handleCloseDialog = useCallback(() => {
    setIsDialogOpen(false)
    setSelectedUser(null)
  }, [])

  const handleSetOverride = useCallback((permissionId: number, granted: boolean) => {
    if (!selectedUser) return
    setUserPermissionOverride.mutate({
      userId: selectedUser.id,
      permissionId,
      granted
    })
  }, [selectedUser, setUserPermissionOverride])

  const handleRemoveOverride = useCallback((permissionId: number) => {
    if (!selectedUser) return
    removeUserPermissionOverride.mutate({
      userId: selectedUser.id,
      permissionId
    })
  }, [selectedUser, removeUserPermissionOverride])

  if (usersLoading || permissionsLoading) {
    return <RBACLoading message="Loading users and permissions..." />
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold">User Permission Overrides</h3>
        <p className="text-sm text-muted-foreground">
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
                    <div className="text-sm text-muted-foreground">@{user.username}</div>
                  </div>
                </TableCell>
                <TableCell>
                  <span className="text-sm text-muted-foreground">
                    Click &quot;Manage&quot; to view and edit
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleOpenDialog(user)}
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
      <Dialog open={isDialogOpen} onOpenChange={handleCloseDialog}>
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
                <div className="border rounded-lg p-4 bg-muted">
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
                          onClick={() => handleRemoveOverride(override.id)}
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
                          <div key={perm.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted">
                            <div className="flex-1">
                              <div className="font-medium text-sm">{perm.action}</div>
                              {perm.description && (
                                <p className="text-xs text-muted-foreground mt-0.5">{perm.description}</p>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <Select
                                key={`${perm.id}-${currentValue}`}
                                value={currentValue}
                                onValueChange={(value) => {
                                  if (value === 'none') {
                                    handleRemoveOverride(perm.id)
                                  } else {
                                    handleSetOverride(perm.id, value === 'grant')
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
            <Button onClick={handleCloseDialog}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
