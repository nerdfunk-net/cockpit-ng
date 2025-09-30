'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { Badge } from '../ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog'
import { Checkbox } from '../ui/checkbox'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table'
import {
  Users,
  Plus,
  RefreshCw,
  Edit,
  Trash2,
  CheckCircle,
  XCircle,
  AlertTriangle,
  UserCheck,
  ToggleLeft,
  ToggleRight
} from 'lucide-react'
import { useApi } from '../../hooks/use-api'

interface User {
  id: number
  username: string
  realname: string
  email?: string
  role: 'admin' | 'user' | 'viewer' | 'custom'
  permissions: number
  debug: boolean
  is_active: boolean
  created_at: string
  updated_at: string
}

interface UserFormData {
  username: string
  realname: string
  email?: string
  password: string
  role: 'admin' | 'user' | 'viewer' | 'custom'
  debug: boolean
  is_active: boolean
}

interface StatusMessage {
  type: 'success' | 'error' | 'info'
  text: string
}

// Permission bit flags matching backend
const PERMISSION_READ = 1
const PERMISSION_WRITE = 2
const PERMISSION_ADMIN = 4
const PERMISSION_DELETE = 8
const PERMISSION_USER_MANAGE = 16

const PERMISSIONS_VIEWER = PERMISSION_READ
const PERMISSIONS_USER = PERMISSION_READ | PERMISSION_WRITE
const PERMISSIONS_ADMIN = PERMISSION_READ | PERMISSION_WRITE | PERMISSION_ADMIN | PERMISSION_DELETE | PERMISSION_USER_MANAGE

const ROLE_PERMISSIONS: Record<string, number> = {
  viewer: PERMISSIONS_VIEWER,
  user: PERMISSIONS_USER,
  admin: PERMISSIONS_ADMIN
}

export default function UserManagement() {
  const { apiCall } = useApi()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(false)
  const [showDialog, setShowDialog] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [message, setMessage] = useState<StatusMessage | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<number | null>(null)
  const [selectedUsers, setSelectedUsers] = useState<Set<number>>(new Set())
  
  const [formData, setFormData] = useState<UserFormData>({
    username: '',
    realname: '',
    email: '',
    password: '',
    role: 'user',
    debug: false,
    is_active: true
  })

  const showMessage = (text: string, type: StatusMessage['type'] = 'success') => {
    setMessage({ text, type })
    setTimeout(() => setMessage(null), 4000)
  }

  const loadUsers = async () => {
    setLoading(true)
    try {
      const response = await apiCall<{users: User[], total: number}>('user-management')
      setUsers(response?.users || [])
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      // Show the actual error message (which will be "Admin access required" for 403)
      showMessage(errorMessage, 'error')
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setFormData({
      username: '',
      realname: '',
      email: '',
      password: '',
      role: 'user',
      debug: false,
      is_active: true
    })
    setEditingUser(null)
  }

  const openCreateDialog = () => {
    resetForm()
    setShowDialog(true)
  }

  const openEditDialog = (user: User) => {
    setFormData({
      username: user.username,
      realname: user.realname,
      email: user.email || '',
      password: '',
      role: user.role,
      debug: user.debug,
      is_active: user.is_active
    })
    setEditingUser(user)
    setShowDialog(true)
  }

  const handleRoleChange = (role: string) => {
    setFormData(prev => ({
      ...prev,
      role: role as 'admin' | 'user' | 'viewer' | 'custom'
    }))
  }

  const saveUser = async () => {
    if (!formData.username || !formData.realname || (!editingUser && !formData.password)) {
      showMessage('Please fill in all required fields', 'error')
      return
    }

    setSaving(true)
    try {
      const payload = {
        username: formData.username,
        realname: formData.realname,
        email: formData.email || undefined,
        password: formData.password || undefined,
        role: formData.role,
        debug: formData.debug,
        is_active: formData.is_active
      }

      if (editingUser) {
        await apiCall(`user-management/${editingUser.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        })
        showMessage('User updated successfully')
      } else {
        await apiCall('user-management', {
          method: 'POST',
          body: JSON.stringify(payload)
        })
        showMessage('User created successfully')
      }

      setShowDialog(false)
      resetForm()
      await loadUsers()
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      if (errorMessage.includes('Username already exists')) {
        showMessage('Username already exists', 'error')
      } else {
        showMessage(editingUser ? 'Failed to update user' : 'Failed to create user', 'error')
      }
    } finally {
      setSaving(false)
    }
  }

  const deleteUser = async (userId: number) => {
    if (!window.confirm('Are you sure you want to delete this user?')) return

    setDeleting(userId)
    try {
      await apiCall(`user-management/${userId}`, { method: 'DELETE' })
      showMessage('User deleted successfully')
      await loadUsers()
      setSelectedUsers(prev => {
        const newSet = new Set(prev)
        newSet.delete(userId)
        return newSet
      })
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      showMessage(`Failed to delete user: ${errorMessage}`, 'error')
    } finally {
      setDeleting(null)
    }
  }

  const handleSelectUser = (userId: number, checked: boolean) => {
    setSelectedUsers(prev => {
      const newSet = new Set(prev)
      if (checked) {
        newSet.add(userId)
      } else {
        newSet.delete(userId)
      }
      return newSet
    })
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedUsers(new Set(users.map(u => u.id)))
    } else {
      setSelectedUsers(new Set())
    }
  }

  const deleteSelectedUsers = async () => {
    if (selectedUsers.size === 0) {
      showMessage('No users selected', 'error')
      return
    }

    if (!window.confirm(`Are you sure you want to delete ${selectedUsers.size} selected user(s)?`)) return

    try {
      await apiCall('user-management/bulk-action', {
        method: 'POST',
        body: JSON.stringify({
          user_ids: Array.from(selectedUsers),
          action: 'delete'
        })
      })
      showMessage(`Successfully deleted ${selectedUsers.size} users`)
      setSelectedUsers(new Set())
      await loadUsers()
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      showMessage(`Failed to delete selected users: ${errorMessage}`, 'error')
    }
  }

  const editSelectedUsers = async () => {
    if (selectedUsers.size === 0) {
      showMessage('No users selected', 'error')
      return
    }

    // For bulk edit, we'll just update permissions to user level
    const userPermissions = ROLE_PERMISSIONS.user
    
    try {
      await apiCall('user-management/bulk-action', {
        method: 'POST',
        body: JSON.stringify({
          user_ids: Array.from(selectedUsers),
          action: 'update_permissions',
          permissions: userPermissions
        })
      })
      showMessage(`Successfully updated permissions for ${selectedUsers.size} users`)
      setSelectedUsers(new Set())
      await loadUsers()
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      showMessage(`Failed to update selected users: ${errorMessage}`, 'error')
    }
  }

  const toggleUserStatus = async (userId: number, currentStatus: boolean) => {
    if (deleting === userId) return // Prevent multiple clicks
    
    setDeleting(userId)
    try {
      await apiCall(`user-management/${userId}/toggle-status`, {
        method: 'PATCH'
      })
      showMessage(`User ${currentStatus ? 'disabled' : 'enabled'} successfully`)
      await loadUsers()
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      showMessage(`Failed to toggle user status: ${errorMessage}`, 'error')
    } finally {
      setDeleting(null)
    }
  }

  useEffect(() => {
    loadUsers()
  }, [])

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-red-100 text-red-800'
      case 'user': return 'bg-blue-100 text-blue-800'
      case 'viewer': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getPermissionSummary = (permissions: number) => {
    const perms = []
    if (permissions & PERMISSION_READ) perms.push('Read')
    if (permissions & PERMISSION_WRITE) perms.push('Write')
    if (permissions & PERMISSION_ADMIN) perms.push('Admin')
    if (permissions & PERMISSION_DELETE) perms.push('Delete')
    if (permissions & PERMISSION_USER_MANAGE) perms.push('User Mgmt')
    return perms.join(', ') || 'None'
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="border-b border-gray-200 pb-4">
        <div className="flex items-center space-x-3">
          <div className="bg-blue-100 p-2 rounded-lg">
            <Users className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">User Management</h1>
            <p className="text-gray-600">Manage system users, roles, and permissions</p>
          </div>
        </div>
      </div>

      {/* Status Message */}
      {message && (
        <div className={`p-4 rounded-lg flex items-center space-x-2 ${
          message.type === 'success' ? 'bg-green-50 text-green-800' :
          message.type === 'error' ? 'bg-red-50 text-red-800' :
          'bg-blue-50 text-blue-800'
        }`}>
          {message.type === 'success' ? <CheckCircle className="h-5 w-5" /> :
           message.type === 'error' ? <XCircle className="h-5 w-5" /> :
           <AlertTriangle className="h-5 w-5" />}
          <span>{message.text}</span>
        </div>
      )}

      {/* Main Content */}
      <Card className="overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-3 pl-8 pr-6 -mx-6 -mt-6 mb-6">
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="flex items-center space-x-2 text-white text-base">
                <UserCheck className="h-5 w-5" />
                <span>Users ({users.length})</span>
              </CardTitle>
              <CardDescription className="text-blue-100">
                Manage user accounts, roles, and access permissions
              </CardDescription>
            </div>
            <div className="flex items-center space-x-2 mr-4">
              <Button
                onClick={loadUsers}
                variant="secondary"
                size="sm"
                disabled={loading}
                className="bg-white/20 text-white border-white/30 hover:bg-white/30"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Dialog open={showDialog} onOpenChange={setShowDialog}>
                <DialogTrigger asChild>
                  <Button onClick={openCreateDialog} className="bg-white text-blue-600 hover:bg-blue-50">
                    <Plus className="h-4 w-4 mr-2" />
                    Add User
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>
                      {editingUser ? 'Edit User' : 'Create New User'}
                    </DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="username">Username *</Label>
                      <Input
                        id="username"
                        value={formData.username}
                        onChange={(e) => setFormData(prev => ({...prev, username: e.target.value}))}
                        placeholder="Enter username"
                        disabled={!!editingUser}
                      />
                    </div>
                    <div>
                      <Label htmlFor="realname">Real Name *</Label>
                      <Input
                        id="realname"
                        value={formData.realname}
                        onChange={(e) => setFormData(prev => ({...prev, realname: e.target.value}))}
                        placeholder="Enter full name"
                      />
                    </div>
                    <div>
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData(prev => ({...prev, email: e.target.value}))}
                        placeholder="Enter email address"
                      />
                    </div>
                    <div>
                      <Label htmlFor="password">
                        Password {editingUser ? '(leave blank to keep current)' : '*'}
                      </Label>
                      <Input
                        id="password"
                        type="password"
                        value={formData.password}
                        onChange={(e) => setFormData(prev => ({...prev, password: e.target.value}))}
                        placeholder="Enter password"
                      />
                    </div>
                    <div>
                      <Label htmlFor="role">Role</Label>
                      <Select value={formData.role} onValueChange={handleRoleChange}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select role" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="viewer">Viewer</SelectItem>
                          <SelectItem value="user">User</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="debug">Debug Mode</Label>
                      <div className="flex items-center space-x-2 mt-2">
                        <Checkbox
                          id="debug"
                          checked={formData.debug}
                          onCheckedChange={(checked) => setFormData(prev => ({...prev, debug: checked as boolean}))}
                        />
                        <Label htmlFor="debug" className="text-sm">
                          Enable debug mode for this user
                        </Label>
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="is_active">Account Status</Label>
                      <div className="flex items-center space-x-2 mt-2">
                        <Checkbox
                          id="is_active"
                          checked={formData.is_active}
                          onCheckedChange={(checked) => setFormData(prev => ({...prev, is_active: checked as boolean}))}
                        />
                        <Label htmlFor="is_active" className="text-sm">
                          Account is active (user can login)
                        </Label>
                      </div>
                    </div>
                    <div className="flex justify-end space-x-2 pt-4">
                      <Button
                        variant="outline"
                        onClick={() => setShowDialog(false)}
                        disabled={saving}
                      >
                        Cancel
                      </Button>
                      <Button onClick={saveUser} disabled={saving} className="bg-green-600 hover:bg-green-700 text-white">
                        {saving ? 'Saving...' : (editingUser ? 'Update' : 'Create')}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin mr-2" />
              <span>Loading users...</span>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selectedUsers.size === users.length && users.length > 0}
                        onCheckedChange={handleSelectAll}
                      />
                    </TableHead>
                    <TableHead>Username</TableHead>
                    <TableHead>Real Name</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Permissions</TableHead>
                    <TableHead>Debug</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedUsers.has(user.id)}
                          onCheckedChange={(checked) => handleSelectUser(user.id, checked as boolean)}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{user.username}</TableCell>
                      <TableCell>{user.realname}</TableCell>
                      <TableCell>
                        <Badge className={getRoleBadgeColor(user.role)}>
                          {user.role.toUpperCase()}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-gray-600">
                        {getPermissionSummary(user.permissions)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={user.debug ? "destructive" : "secondary"}>
                          {user.debug ? 'On' : 'Off'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Badge variant={user.is_active ? "default" : "secondary"}>
                            {user.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleUserStatus(user.id, user.is_active)}
                            disabled={deleting === user.id}
                            title={user.is_active ? 'Disable user login' : 'Enable user login'}
                          >
                            {deleting === user.id ? (
                              <RefreshCw className="h-4 w-4 animate-spin" />
                            ) : user.is_active ? (
                              <ToggleRight className="h-4 w-4 text-green-600" />
                            ) : (
                              <ToggleLeft className="h-4 w-4 text-gray-400" />
                            )}
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end space-x-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditDialog(user)}
                            disabled={deleting === user.id}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteUser(user.id)}
                            disabled={deleting === user.id}
                          >
                            {deleting === user.id ? (
                              <RefreshCw className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {users.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                        No users found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              
              {/* Bulk Actions */}
              {selectedUsers.size > 0 && (
                <div className="flex items-center justify-between pt-4 border-t">
                  <span className="text-sm text-gray-600">
                    {selectedUsers.size} user(s) selected
                  </span>
                  <div className="flex space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={editSelectedUsers}
                    >
                      Edit Selected
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={deleteSelectedUsers}
                    >
                      Remove Selected
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}