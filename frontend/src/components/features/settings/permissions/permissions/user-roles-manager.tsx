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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { X, UserPlus, Shield } from 'lucide-react'
import { useRbacUsers, useRbacRoles } from '../hooks/use-rbac-queries'
import { useRbacMutations } from '../hooks/use-rbac-mutations'
import { RBACLoading } from '../components/rbac-loading'
import { EMPTY_USERS, EMPTY_ROLES } from '../utils/constants'

export function UserRolesManager() {
  // TanStack Query - no manual state management
  const { data: users = EMPTY_USERS, isLoading: usersLoading } = useRbacUsers()
  const { data: roles = EMPTY_ROLES, isLoading: rolesLoading } = useRbacRoles()
  const { assignRoleToUser, removeRoleFromUser } = useRbacMutations()

  // Client-side UI state only
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null)
  const [selectedRoleId, setSelectedRoleId] = useState<string>('')

  // Derived state with useMemo
  const getAvailableRoles = useCallback((userId: number) => {
    const user = users.find(u => u.id === userId)
    if (!user || !user.roles) return roles
    const userRoleIds = new Set(user.roles.map(r => r.id))
    return roles.filter(role => !userRoleIds.has(role.id))
  }, [users, roles])

  const usersWithRoles = useMemo(() => {
    return users.filter(u => u.roles && u.roles.length > 0).length
  }, [users])

  const handleAssignRole = useCallback(() => {
    if (!selectedUserId || !selectedRoleId) return

    assignRoleToUser.mutate(
      {
        userId: selectedUserId,
        roleId: parseInt(selectedRoleId)
      },
      {
        onSuccess: () => {
          setSelectedRoleId('')
        }
      }
    )
  }, [selectedUserId, selectedRoleId, assignRoleToUser])

  const handleRemoveRole = useCallback((userId: number, roleId: number) => {
    if (!confirm('Are you sure you want to remove this role from the user?')) {
      return
    }
    removeRoleFromUser.mutate({ userId, roleId })
  }, [removeRoleFromUser])

  if (usersLoading || rolesLoading) {
    return <RBACLoading message="Loading users and roles..." />
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold">User Role Assignments</h3>
        <p className="text-sm text-muted-foreground">
          Assign roles to users to grant them permissions
        </p>
      </div>

      {/* Users Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Assigned Roles</TableHead>
              <TableHead className="text-right w-[360px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => {
              const currentRoles = user.roles || []
              const availableRoles = getAvailableRoles(user.id)
              const isExpanded = selectedUserId === user.id

              return (
                <TableRow key={user.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{user.realname}</div>
                      <div className="text-sm text-muted-foreground">@{user.username}</div>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{user.email}</TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-2">
                      {currentRoles.length > 0 ? (
                        currentRoles.map((role) => (
                          <Badge
                            key={role.id}
                            variant={role.is_system ? 'default' : 'secondary'}
                            className="flex items-center gap-1 w-fit"
                          >
                            <Shield className="h-3 w-3" />
                            {role.name}
                            <button
                              onClick={() => handleRemoveRole(user.id, role.id)}
                              className="ml-1 hover:bg-white/20 rounded-full p-0.5"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))
                      ) : (
                        <span className="text-sm text-muted-foreground">No roles assigned</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right w-[360px]">
                    {isExpanded ? (
                      <div className="flex items-center justify-end gap-2">
                        <Select value={selectedRoleId} onValueChange={setSelectedRoleId}>
                          <SelectTrigger className="w-[200px]">
                            <SelectValue placeholder="Select role..." />
                          </SelectTrigger>
                          <SelectContent>
                            {availableRoles.map((role) => (
                              <SelectItem key={role.id} value={String(role.id)}>
                                {role.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button size="sm" onClick={handleAssignRole} disabled={!selectedRoleId}>
                          Add
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setSelectedUserId(null)
                            setSelectedRoleId('')
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedUserId(user.id)
                          setSelectedRoleId('')
                        }}
                        className="flex items-center gap-2"
                      >
                        <UserPlus className="h-4 w-4" />
                        Assign Role
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      {/* Summary */}
      <div className="bg-muted rounded-lg p-4">
        <h4 className="font-semibold mb-2">Summary</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <div className="text-muted-foreground">Total Users</div>
            <div className="text-2xl font-bold text-blue-600">{users.length}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Total Roles</div>
            <div className="text-2xl font-bold text-green-600">{roles.length}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Users with Roles</div>
            <div className="text-2xl font-bold text-purple-600">{usersWithRoles}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Unassigned Users</div>
            <div className="text-2xl font-bold text-orange-600">
              {users.length - usersWithRoles}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
