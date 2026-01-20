import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { Shield } from 'lucide-react'
import type { RoleWithPermissions, Permission } from '../../types'
import { groupPermissionsByResource } from '../../utils/rbac-utils'
import { useMemo } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

interface RolePermissionsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  role: RoleWithPermissions | null
  allPermissions: Permission[]
  onTogglePermission: (permissionId: number, granted: boolean) => void
}

interface ResourcePermissions {
  resource: string
  permissions: {
    read?: Permission
    write?: Permission
    delete?: Permission
    execute?: Permission
  }
}

export function RolePermissionsDialog({
  open,
  onOpenChange,
  role,
  allPermissions,
  onTogglePermission
}: RolePermissionsDialogProps) {
  const groupedPermissions = useMemo(
    () => groupPermissionsByResource(allPermissions),
    [allPermissions]
  )

  const resourcePermissions = useMemo(() => {
    const resources: ResourcePermissions[] = []
    
    Object.entries(groupedPermissions).forEach(([resource, permissions]) => {
      const permMap: ResourcePermissions['permissions'] = {}
      
      permissions.forEach(perm => {
        const action = perm.action.toLowerCase() as 'read' | 'write' | 'delete' | 'execute'
        permMap[action] = perm
      })
      
      resources.push({
        resource,
        permissions: permMap
      })
    })
    
    return resources
  }, [groupedPermissions])

  const isPermissionGranted = (permissionId: number) => {
    return role?.permissions?.some(p => p.id === permissionId) || false
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!max-w-[62rem] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            {role ? `Manage Permissions for ${role.name}` : 'Loading...'}
          </DialogTitle>
          <DialogDescription>
            Select which permissions this role should have. Changes are applied immediately.
          </DialogDescription>
        </DialogHeader>

        {!role ? (
          <div className="py-8 text-center text-muted-foreground">
            Loading role permissions...
          </div>
        ) : (
          <div className="py-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[180px] border-r bg-gray-100">Name of Permission</TableHead>
                  <TableHead className="text-center w-[100px] border-r bg-gray-100">Read</TableHead>
                  <TableHead className="text-center w-[100px] border-r bg-gray-100">Write</TableHead>
                  <TableHead className="text-center w-[100px] border-r bg-gray-100">Delete</TableHead>
                  <TableHead className="text-center w-[100px] bg-gray-100">Execute</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {resourcePermissions.map(({ resource, permissions }) => (
                  <TableRow key={resource}>
                    <TableCell className="font-medium border-r">{resource}</TableCell>
                    <TableCell className="text-center border-r">
                      {permissions.read ? (
                        <div className="flex justify-center">
                          <Checkbox
                            id={`perm-${permissions.read.id}`}
                            checked={isPermissionGranted(permissions.read.id)}
                            onCheckedChange={() => 
                              onTogglePermission(
                                permissions.read!.id, 
                                isPermissionGranted(permissions.read!.id)
                              )
                            }
                            title={permissions.read.description}
                          />
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center border-r">
                      {permissions.write ? (
                        <div className="flex justify-center">
                          <Checkbox
                            id={`perm-${permissions.write.id}`}
                            checked={isPermissionGranted(permissions.write.id)}
                            onCheckedChange={() => 
                              onTogglePermission(
                                permissions.write!.id, 
                                isPermissionGranted(permissions.write!.id)
                              )
                            }
                            title={permissions.write.description}
                          />
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center border-r">
                      {permissions.delete ? (
                        <div className="flex justify-center">
                          <Checkbox
                            id={`perm-${permissions.delete.id}`}
                            checked={isPermissionGranted(permissions.delete.id)}
                            onCheckedChange={() => 
                              onTogglePermission(
                                permissions.delete!.id, 
                                isPermissionGranted(permissions.delete!.id)
                              )
                            }
                            title={permissions.delete.description}
                          />
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {permissions.execute ? (
                        <div className="flex justify-center">
                          <Checkbox
                            id={`perm-${permissions.execute.id}`}
                            checked={isPermissionGranted(permissions.execute.id)}
                            onCheckedChange={() => 
                              onTogglePermission(
                                permissions.execute!.id, 
                                isPermissionGranted(permissions.execute!.id)
                              )
                            }
                            title={permissions.execute.description}
                          />
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <div className="flex justify-end pt-4 border-t">
          <Button onClick={() => onOpenChange(false)} variant="outline">
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
