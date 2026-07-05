import { Minus } from 'lucide-react'
import { IconChip } from '@/components/shared/icon-chip'

export function OffboardHeader() {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-4">
        <IconChip variant="error">
          <Minus className="h-6 w-6" />
        </IconChip>
        <div>
          <h1 className="text-3xl font-bold text-foreground">Offboard Devices</h1>
          <p className="text-muted-foreground mt-1">
            Remove devices and corresponding IP addresses from Nautobot and Checkmk
          </p>
        </div>
      </div>
    </div>
  )
}
