/**
 * Inventory Page - Main Component
 * Uses shared DeviceSelector component for building and managing device inventories
 */

'use client'

import { List } from 'lucide-react'

// Import shared DeviceSelector
import { DeviceSelector } from '@/components/shared/device-selector'

export default function AnsibleInventoryPage() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="bg-blue-100 p-2 rounded-lg">
            <List className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Inventory Builder</h1>
            <p className="text-muted-foreground mt-2">
              Build dynamic device inventories using logical operations
            </p>
          </div>
        </div>
      </div>

      {/* Device Selector */}
      <DeviceSelector showActions={true} showSaveLoad={true} enableSelection={false} />
    </div>
  )
}
