'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
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
import { UserPlus, Edit, Trash2, RefreshCw, ToggleLeft, ToggleRight } from 'lucide-react'
import { useApi } from '@/hooks/use-api'
import { useToast } from '@/hooks/use-toast'

interface Role {
  id: number
  name: string
}

interface User {
  id: number
  username: string
  realname: string
  email?: string
  roles?: Role[]
  debug: boolean
  is_active: boolean
  created_at: string
}

interface UserFormData {
  username: string
  realname: string
  email: string
  password: string
  debug: boolean
  is_active: boolean
}

export function UsersManager() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [formData, setFormData] = useState<UserFormData>({
    username: '',
    realname: '',
    email: '',
    password: '',
    debug: false,
    is_active: true,
  })
  const { apiCall } = useApi()
  const { toast } = useToast()

  const loadUsers = useCallback(async () => {
    try {
      setLoading(true)
      const response = await apiCall<{ users: User[] }>('rbac/users')
      setUsers(response.users || [])
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to load users',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [apiCall, toast])

  useEffect(() => {
    loadUsers()
  }, [loadUsers])

  const openCreateDialog = () => {
    setEditingUser(null)
    setFormData({
      username: '',
      realname: '',
      email: '',
      password: '',
      debug: false,
      is_active: true,
    })
    setIsDialogOpen(true)
  }

  const openEditDialog = (user: User) => {
    setEditingUser(user)
    setFormData({
      username: user.username,
      realname: user.realname,
      email: user.email || '',
      password: '', // Don't populate password when editing
      debug: user.debug,
      is_active: user.is_active,
    })
    setIsDialogOpen(true)
  }

  const saveUser = async () => {
    // Validation
    if (!formData.username || !formData.realname) {
      toast({
        title: 'Validation Error',
        description: 'Username and real name are required',
        variant: 'destructive',
      })
      return
    }

    if (!editingUser && !formData.password) {
      toast({
        title: 'Validation Error',
        description: 'Password is required for new users',
        variant: 'destructive',
      })
      return
    }

    try {
      if (editingUser) {
        // Update existing user
        const payload: Record<string, string | boolean> = {}
        if (formData.realname) payload.realname = formData.realname
        if (formData.email) payload.email = formData.email
        if (formData.password) payload.password = formData.password
        payload.debug = formData.debug
        payload.is_active = formData.is_active

        await apiCall(`rbac/users/${editingUser.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        })
        toast({
          title: 'Success',
          description: `User "${formData.username}" updated successfully`,
        })
      } else {
        // Create new user
        const payload = {
          username: formData.username,
          realname: formData.realname,
          email: formData.email,
          password: formData.password,
          role_ids: [], // No roles assigned by default
          debug: formData.debug,
          is_active: formData.is_active,
        }
        
        await apiCall('rbac/users', {
          method: 'POST',
          body: JSON.stringify(payload),
        })
        toast({
          title: 'Success',
          description: `User "${formData.username}" created successfully`,
        })
      }

      setIsDialogOpen(false)
      loadUsers()
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save user',
        variant: 'destructive',
      })
    }
  }

  const deleteUser = async (user: User) => {
    if (!confirm(`Are you sure you want to delete user "${user.username}"?`)) {
      return
    }

    try {
      await apiCall(`rbac/users/${user.id}`, { method: 'DELETE' })
      toast({
        title: 'Success',
        description: `User "${user.username}" deleted successfully`,
      })
      loadUsers()
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete user',
        variant: 'destructive',
      })
    }
  }

  const toggleUserStatus = async (user: User) => {
    try {
      await apiCall(`rbac/users/${user.id}/activate`, {
        method: 'PATCH',
        body: JSON.stringify({
          is_active: !user.is_active,
        }),
      })
      toast({
        title: 'Success',
        description: `User ${user.is_active ? 'deactivated' : 'activated'} successfully`,
      })
      loadUsers()
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update user status',
        variant: 'destructive',
      })
    }
  }

  if (loading) {
    return <div className="text-center py-8">Loading users...</div>
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">User Accounts</h3>
          <p className="text-sm text-slate-600">
            Manage user accounts, credentials, and basic settings
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadUsers}
            className="flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
          <Button
            size="sm"
            onClick={openCreateDialog}
            className="flex items-center gap-2"
          >
            <UserPlus className="h-4 w-4" />
            Add User
          </Button>
        </div>
      </div>

      {/* Users Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Username</TableHead>
              <TableHead>Real Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Debug</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell className="font-medium">{user.username}</TableCell>
                <TableCell>{user.realname}</TableCell>
                <TableCell className="text-sm text-slate-600">{user.email || '-'}</TableCell>
                <TableCell>
                  <Badge variant={user.debug ? 'destructive' : 'secondary'} className="text-xs">
                    {user.debug ? 'On' : 'Off'}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={user.is_active ? 'default' : 'secondary'} className="text-xs">
                    {user.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleUserStatus(user)}
                      title={user.is_active ? 'Deactivate user' : 'Activate user'}
                    >
                      {user.is_active ? (
                        <ToggleRight className="h-4 w-4 text-green-600" />
                      ) : (
                        <ToggleLeft className="h-4 w-4 text-slate-400" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditDialog(user)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteUser(user)}
                    >
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingUser ? `Edit User: ${editingUser.username}` : 'Create New User'}
            </DialogTitle>
            <DialogDescription>
              {editingUser
                ? 'Update user account details'
                : 'Create a new user account. Assign roles in the User Roles tab.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="username">Username *</Label>
              <Input
                id="username"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                placeholder="Enter username"
                disabled={!!editingUser}
              />
            </div>

            <div>
              <Label htmlFor="realname">Real Name *</Label>
              <Input
                id="realname"
                value={formData.realname}
                onChange={(e) => setFormData({ ...formData, realname: e.target.value })}
                placeholder="Enter real name"
              />
            </div>

            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="user@example.com"
              />
            </div>

            <div>
              <Label htmlFor="password">
                Password {!editingUser && '*'}
                {editingUser && ' (leave blank to keep current)'}
              </Label>
              <Input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder={editingUser ? 'Leave blank to keep current' : 'Enter password'}
              />
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="debug"
                checked={formData.debug}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, debug: checked as boolean })
                }
              />
              <Label htmlFor="debug" className="text-sm font-normal">
                Enable debug mode for this user
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, is_active: checked as boolean })
                }
              />
              <Label htmlFor="is_active" className="text-sm font-normal">
                Account is active (user can login)
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveUser}>
              {editingUser ? 'Update User' : 'Create User'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
