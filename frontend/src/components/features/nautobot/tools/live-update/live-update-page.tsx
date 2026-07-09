'use client'

import { Zap } from 'lucide-react'
import { IconChip } from '@/components/shared/icon-chip'
import { LiveUpdateWizard } from './components/live-update-wizard'

export function LiveUpdatePage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <IconChip variant="info">
            <Zap className="h-6 w-6" />
          </IconChip>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Live Update</h1>
            <p className="text-muted-foreground mt-2">
              Bring in device data from a CSV file or a Get Data agent, map it to
              Nautobot fields, and choose primary IP addresses.
            </p>
          </div>
        </div>
      </div>

      <LiveUpdateWizard />
    </div>
  )
}
