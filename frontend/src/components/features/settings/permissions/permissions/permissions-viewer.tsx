'use client'

import { useState, useMemo } from 'react'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Search, Key } from 'lucide-react'
import { useRbacPermissions } from '../hooks/use-rbac-queries'
import { RBACLoading } from '../components/rbac-loading'
import { groupPermissionsByResource, getActionColor, filterBySearchTerm } from '../utils/rbac-utils'
import { EMPTY_PERMISSIONS } from '../utils/constants'

export function PermissionsViewer() {
  // TanStack Query - no manual state management
  const { data: permissions = EMPTY_PERMISSIONS, isLoading } = useRbacPermissions()

  // Client-side UI state only
  const [searchTerm, setSearchTerm] = useState('')

  // Derived state with useMemo
  const filteredPermissions = useMemo(() => {
    if (!searchTerm) return permissions
    return filterBySearchTerm(permissions, searchTerm, ['resource', 'action', 'description'])
  }, [permissions, searchTerm])

  const groupedPermissions = useMemo(
    () => groupPermissionsByResource(filteredPermissions),
    [filteredPermissions]
  )

  if (isLoading) {
    return <RBACLoading message="Loading permissions..." />
  }

  return (
    <div className="space-y-4">
      {/* Header with Search */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">All Permissions</h3>
          <p className="text-sm text-muted-foreground">
            {permissions.length} permissions across {Object.keys(groupedPermissions).length}{' '}
            resources
          </p>
        </div>
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search permissions..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Grouped Permissions */}
      <div className="space-y-4">
        {Object.entries(groupedPermissions).map(([resource, perms]) => (
          <div key={resource} className="border rounded-lg overflow-hidden">
            <div className="bg-muted px-4 py-3 border-b">
              <div className="flex items-center gap-2">
                <Key className="h-4 w-4 text-blue-500" />
                <h4 className="font-semibold text-blue-600">{resource}</h4>
                <Badge variant="secondary" className="ml-auto">
                  {perms.length} {perms.length === 1 ? 'permission' : 'permissions'}
                </Badge>
              </div>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Action</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Permission ID</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {perms.map((perm) => (
                  <TableRow key={perm.id}>
                    <TableCell>
                      <Badge className={getActionColor(perm.action)}>{perm.action}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{perm.description}</TableCell>
                    <TableCell>
                      <code className="text-xs bg-muted px-2 py-1 rounded">
                        {perm.id}
                      </code>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ))}
      </div>

      {filteredPermissions.length === 0 && searchTerm && (
        <div className="text-center py-8 text-muted-foreground">
          No permissions found matching &quot;{searchTerm}&quot;
        </div>
      )}
    </div>
  )
}
