'use client'

import { useState, useEffect, useCallback } from 'react'
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
import { useApi } from '@/hooks/use-api'
import { useToast } from '@/hooks/use-toast'

interface Permission {
  id: number
  resource: string
  action: string
  description: string
  created_at: string
}

export function PermissionsViewer() {
  const [permissions, setPermissions] = useState<Permission[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(true)
  const { apiCall } = useApi()
  const { toast } = useToast()

  const loadPermissions = useCallback(async () => {
    try {
      setLoading(true)
      const data = await apiCall<Permission[]>('rbac/permissions')
      setPermissions(data)
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to load permissions',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [apiCall, toast])

  useEffect(() => {
    loadPermissions()
  }, [loadPermissions])

  const filteredPermissions = permissions.filter(
    (perm) =>
      perm.resource.toLowerCase().includes(searchTerm.toLowerCase()) ||
      perm.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      perm.description.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // Group by resource
  const groupedPermissions = filteredPermissions.reduce((acc, perm) => {
    if (!acc[perm.resource]) {
      acc[perm.resource] = []
    }
    acc[perm.resource]!.push(perm)
    return acc
  }, {} as Record<string, Permission[]>)

  const getActionColor = (action: string) => {
    switch (action) {
      case 'read':
        return 'bg-green-100 text-green-800'
      case 'write':
        return 'bg-blue-100 text-blue-800'
      case 'delete':
        return 'bg-red-100 text-red-800'
      case 'execute':
        return 'bg-purple-100 text-purple-800'
      default:
        return 'bg-slate-100 text-slate-800'
    }
  }

  if (loading) {
    return <div className="text-center py-8">Loading permissions...</div>
  }

  return (
    <div className="space-y-4">
      {/* Header with Search */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">All Permissions</h3>
          <p className="text-sm text-slate-600">
            {permissions.length} permissions across {Object.keys(groupedPermissions).length}{' '}
            resources
          </p>
        </div>
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
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
            <div className="bg-slate-50 px-4 py-3 border-b">
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
                    <TableCell className="text-slate-600">{perm.description}</TableCell>
                    <TableCell>
                      <code className="text-xs bg-slate-100 px-2 py-1 rounded">
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
        <div className="text-center py-8 text-slate-500">
          No permissions found matching &quot;{searchTerm}&quot;
        </div>
      )}
    </div>
  )
}
