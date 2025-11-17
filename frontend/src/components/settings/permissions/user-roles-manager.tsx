'use client'

import { useState, useEffect } from 'react'
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
import { useApi } from '@/hooks/use-api'
import { useToast } from '@/hooks/use-toast'

interface User {
  id: number
  username: string
  realname: string
  email: string
}

interface Role {
  id: number
  name: string
  description: string
  is_system: boolean
}

// Reserved for future use
// interface UserWithRoles extends User {
//   roles: Role[]
// }

export function UserRolesManager() {
  const [users, setUsers] = useState<User[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [userRoles, setUserRoles] = useState<Record<number, Role[]>>({})
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null)
  const [selectedRoleId, setSelectedRoleId] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)
  const { apiCall } = useApi()
  const { toast } = useToast()

  useEffect(() => {
    loadData()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const loadData = async () => {
    try {
      setLoading(true)
      await Promise.all([loadUsers(), loadRoles()])
    } finally {
      setLoading(false)
    }
  }

  const loadUsers = async () => {
    try {
      const response = await apiCall<{ users: User[] }>('rbac/users')
      const users = response.users || []
      setUsers(users)

      // Load roles for each user
      for (const user of users) {
        await loadUserRoles(user.id)
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to load users',
        variant: 'destructive',
      })
    }
  }

  const loadRoles = async () => {
    try {
      const data = await apiCall<Role[]>('rbac/roles')
      setRoles(data)
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to load roles',
        variant: 'destructive',
      })
    }
  }

  const loadUserRoles = async (userId: number) => {
    try {
      const data = await apiCall<Role[]>(`rbac/users/${userId}/roles`)
      // Force new object reference to trigger re-render
      setUserRoles((prev) => {
        const newState = { ...prev }
        newState[userId] = [...data] // Create new array reference
        return newState
      })
      // Force component re-render
      setRefreshKey((prev) => prev + 1)
    } catch (error) {
      console.error(`Failed to load roles for user ${userId}:`, error)
    }
  }

  const assignRole = async () => {
    if (!selectedUserId || !selectedRoleId) {
      toast({
        title: 'Validation Error',
        description: 'Please select both user and role',
        variant: 'destructive',
      })
      return
    }

    try {
      await apiCall(`rbac/users/${selectedUserId}/roles`, {
        method: 'POST',
        body: JSON.stringify({
          user_id: selectedUserId,
          role_id: parseInt(selectedRoleId),
        }),
      })

      toast({
        title: 'Success',
        description: 'Role assigned successfully',
      })

      setSelectedRoleId('')

      // Force refresh by reloading roles
      await loadUserRoles(selectedUserId)
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to assign role',
        variant: 'destructive',
      })
    }
  }

  const removeRole = async (userId: number, roleId: number) => {
    if (!confirm('Are you sure you want to remove this role from the user?')) {
      return
    }

    try {
      await apiCall(`rbac/users/${userId}/roles/${roleId}`, {
        method: 'DELETE',
      })

      toast({
        title: 'Success',
        description: 'Role removed successfully',
      })

      // Immediately update state to remove the role from UI
      setUserRoles((prev) => {
        const updatedRoles = (prev[userId] || []).filter((role) => role.id !== roleId)
        return { ...prev, [userId]: updatedRoles }
      })

      // Then reload from server to ensure consistency
      await loadUserRoles(userId)
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to remove role',
        variant: 'destructive',
      })
    }
  }

  const getAvailableRoles = (userId: number) => {
    const userCurrentRoles = userRoles[userId] || []
    const userRoleIds = new Set(userCurrentRoles.map((r) => r.id))
    return roles.filter((role) => !userRoleIds.has(role.id))
  }

  if (loading) {
    return <div className="text-center py-8">Loading users and roles...</div>
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold">User Role Assignments</h3>
        <p className="text-sm text-slate-600">
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
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => {
              const currentRoles = userRoles[user.id] || []
              const availableRoles = getAvailableRoles(user.id)
              const isExpanded = selectedUserId === user.id

              return (
                <TableRow key={`${user.id}-${refreshKey}`}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{user.realname}</div>
                      <div className="text-sm text-slate-500">@{user.username}</div>
                    </div>
                  </TableCell>
                  <TableCell className="text-slate-600">{user.email}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-2">
                      {currentRoles.length > 0 ? (
                        currentRoles.map((role) => (
                          <Badge
                            key={role.id}
                            variant={role.is_system ? 'default' : 'secondary'}
                            className="flex items-center gap-1"
                          >
                            <Shield className="h-3 w-3" />
                            {role.name}
                            <button
                              onClick={() => removeRole(user.id, role.id)}
                              className="ml-1 hover:bg-white/20 rounded-full p-0.5"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))
                      ) : (
                        <span className="text-sm text-slate-400">No roles assigned</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
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
                        <Button size="sm" onClick={assignRole} disabled={!selectedRoleId}>
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
      <div className="bg-slate-50 rounded-lg p-4">
        <h4 className="font-semibold mb-2">Summary</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <div className="text-slate-600">Total Users</div>
            <div className="text-2xl font-bold text-blue-600">{users.length}</div>
          </div>
          <div>
            <div className="text-slate-600">Total Roles</div>
            <div className="text-2xl font-bold text-green-600">{roles.length}</div>
          </div>
          <div>
            <div className="text-slate-600">Users with Roles</div>
            <div className="text-2xl font-bold text-purple-600">
              {Object.values(userRoles).filter((roles) => roles.length > 0).length}
            </div>
          </div>
          <div>
            <div className="text-slate-600">Unassigned Users</div>
            <div className="text-2xl font-bold text-orange-600">
              {users.length - Object.values(userRoles).filter((roles) => roles.length > 0).length}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
