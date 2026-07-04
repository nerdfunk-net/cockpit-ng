import { ArrowLeftRight } from 'lucide-react'
import { IconChip } from '@/components/shared/icon-chip'

export function DiffViewerHeader() {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-4">
        <IconChip variant="warning">
          <ArrowLeftRight className="h-6 w-6" />
        </IconChip>
        <div>
          <h1 className="text-3xl font-bold text-foreground">Diff Viewer</h1>
          <p className="text-muted-foreground mt-2">
            Compare device inventories between Nautobot and CheckMK
          </p>
        </div>
      </div>
    </div>
  )
}
