'use client'

import { Badge } from '@/components/ui/badge'

interface SyncDialogHeaderProps {
  deviceName: string
  isUpdate: boolean
}

export function SyncDialogHeader({ deviceName, isUpdate }: SyncDialogHeaderProps) {
  return (
    <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-3 px-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div>
            <h2 className="text-lg font-semibold">Sync Device to Nautobot</h2>
            <p className="text-blue-100 text-sm">{deviceName || 'CheckMK Device'}</p>
          </div>
          {isUpdate && (
            <Badge className="bg-red-600 text-white border-red-700 font-semibold px-3 py-1 shadow-lg">
              Update Existing Device
            </Badge>
          )}
        </div>
      </div>
    </div>
  )
}
