'use client'

import { useState, useMemo, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { UserPlus, Edit, Trash2, RefreshCw } from 'lucide-react'
import { useRbacUsers } from '../hooks/use-rbac-queries'
import { useRbacMutations } from '../hooks/use-rbac-mutations'
import { UserDialog } from '../components/dialogs/user-dialog'
import { RBACDataTable } from '../components/rbac-data-table'
import { RBACLoading } from '../components/rbac-loading'
import type { User, CreateUserData, UpdateUserData } from '../types'
import { EMPTY_USERS } from '../utils/constants'

export function UsersManager() {
  // TanStack Query hooks - no manual state management needed
  const { data: users = EMPTY_USERS, isLoading, refetch } = useRbacUsers()
  const { createUser, updateUser, deleteUser } = useRbacMutations()

  // Client-side UI state only
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [searchTerm, setSearchTerm] = useState('')

  // Derived state with useMemo
  const filteredUsers = useMemo(() => {
    if (!searchTerm) return users
    const lower = searchTerm.toLowerCase()
    return users.filter(u =>
      u.username.toLowerCase().includes(lower) ||
      u.realname.toLowerCase().includes(lower) ||
      (u.email && u.email.toLowerCase().includes(lower))
    )
  }, [users, searchTerm])

  // Callbacks with useCallback
  const handleCreate = useCallback(() => {
    setSelectedUser(null)
    setIsDialogOpen(true)
  }, [])

  const handleEdit = useCallback((user: User) => {
    setSelectedUser(user)
    setIsDialogOpen(true)
  }, [])

  const handleDelete = useCallback(async (userId: number) => {
    if (confirm('Are you sure you want to delete this user?')) {
      deleteUser.mutate(userId)
    }
  }, [deleteUser])

  const handleSubmit = useCallback((data: CreateUserData | UpdateUserData) => {
    if (selectedUser) {
      updateUser.mutate({ userId: selectedUser.id, data: data as UpdateUserData })
    } else {
      createUser.mutate(data as CreateUserData)
    }
  }, [selectedUser, createUser, updateUser])

  if (isLoading) {
    return <RBACLoading message="Loading users..." />
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center gap-4">
        <div className="flex-1 max-w-sm">
          <Input
            type="search"
            placeholder="Search users..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={handleCreate}>
            <UserPlus className="h-4 w-4 mr-2" />
            Add User
          </Button>
        </div>
      </div>

      <RBACDataTable
        data={filteredUsers}
        columns={[
          { header: 'Username', accessor: 'username' },
          { header: 'Real Name', accessor: 'realname' },
          {
            header: 'Email',
            accessor: (user) => user.email || '-'
          },
          {
            header: 'Roles',
            accessor: (user) => (
              <div className="flex gap-1 flex-wrap">
                {user.roles && user.roles.length > 0 ? (
                  user.roles.map(role => (
                    <Badge key={role.id} variant="secondary" className="text-xs">
                      {role.name}
                    </Badge>
                  ))
                ) : (
                  <span className="text-muted-foreground text-sm">No roles</span>
                )}
              </div>
            )
          },
          {
            header: 'Status',
            accessor: (user) => (
              <Badge variant={user.is_active ? 'default' : 'secondary'} className="text-xs">
                {user.is_active ? 'Active' : 'Inactive'}
              </Badge>
            )
          },
        ]}
        actions={(user) => (
          <div className="flex gap-1 justify-end">
            <Button size="sm" variant="ghost" onClick={() => handleEdit(user)}>
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleDelete(user.id)}
              disabled={user.username === 'admin'}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )}
        emptyMessage="No users found"
      />

      <UserDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        onSubmit={handleSubmit}
        user={selectedUser}
        isEdit={!!selectedUser}
      />
    </div>
  )
}
