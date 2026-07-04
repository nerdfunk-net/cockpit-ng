'use client'

import { Button } from '@/components/ui/button'
import { IconChip } from '@/components/shared/icon-chip'
import { FileUp, Plus, HelpCircle, Search } from 'lucide-react'

interface PageHeaderProps {
  isLoadingData: boolean
  onScanNetwork: () => void
  onOpenCSVModal: () => void
  onOpenHelp: () => void
}

export function PageHeader({
  isLoadingData,
  onScanNetwork,
  onOpenCSVModal,
  onOpenHelp,
}: PageHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-4">
        <IconChip variant="success">
          <Plus className="h-6 w-6" />
        </IconChip>
        <div>
          <h1 className="text-3xl font-bold text-foreground">Onboard Network Device</h1>
          <p className="text-muted-foreground mt-2">
            Add new network devices to Nautobot and configure them for management
          </p>
        </div>
      </div>
      <div className="flex space-x-2">
        <Button variant="outline" onClick={onScanNetwork} disabled={isLoadingData}>
          <Search className="h-4 w-4 mr-2" />
          Scan Network
        </Button>
        <Button variant="outline" onClick={onOpenCSVModal} disabled={isLoadingData}>
          <FileUp className="h-4 w-4 mr-2" />
          Bulk Upload CSV
        </Button>
        <Button variant="outline" size="icon" onClick={onOpenHelp}>
          <HelpCircle className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
