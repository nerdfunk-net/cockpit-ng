import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Shield } from 'lucide-react'
import type { RoleWithPermissions, Permission } from '../../types'
import { groupPermissionsByResource, getActionColor } from '../../utils/rbac-utils'
import { useMemo } from 'react'

interface RolePermissionsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  role: RoleWithPermissions | null
  allPermissions: Permission[]
  onTogglePermission: (permissionId: number, granted: boolean) => void
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

  if (!role) return null

  const isPermissionGranted = (permissionId: number) => {
    return role.permissions?.some(p => p.id === permissionId) || false
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Manage Permissions for {role.name}
          </DialogTitle>
          <DialogDescription>
            Select which permissions this role should have. Changes are applied immediately.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {Object.entries(groupedPermissions).map(([resource, permissions]) => (
            <div key={resource} className="space-y-3">
              <h4 className="font-semibold text-sm uppercase text-muted-foreground">
                {resource}
              </h4>
              <div className="grid grid-cols-1 gap-3 pl-4">
                {permissions.map((permission) => {
                  const granted = isPermissionGranted(permission.id)
                  return (
                    <div key={permission.id} className="flex items-start space-x-3">
                      <Checkbox
                        id={`perm-${permission.id}`}
                        checked={granted}
                        onCheckedChange={() => onTogglePermission(permission.id, granted)}
                      />
                      <div className="flex-1 space-y-1">
                        <label
                          htmlFor={`perm-${permission.id}`}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex items-center gap-2"
                        >
                          <span>{permission.description}</span>
                          <Badge className={getActionColor(permission.action)} variant="secondary">
                            {permission.action}
                          </Badge>
                        </label>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
