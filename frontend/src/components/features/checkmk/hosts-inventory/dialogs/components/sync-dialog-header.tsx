'use client'

import { Badge } from '@/components/ui/badge'

interface SyncDialogHeaderProps {
  deviceName: string
  isUpdate: boolean
}

export function SyncDialogHeader({ deviceName, isUpdate }: SyncDialogHeaderProps) {
  return (
    <div className="panel-header py-3 px-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div>
            <h2 className="text-lg font-semibold">Sync Device to Nautobot</h2>
            <p className="text-panel-header-muted text-sm">
              {deviceName || 'CheckMK Device'}
            </p>
          </div>
          {isUpdate && (
            <Badge
              variant="destructive"
              className="font-semibold px-3 py-1 shadow-lg"
            >
              Update Existing Device
            </Badge>
          )}
        </div>
      </div>
    </div>
  )
}
