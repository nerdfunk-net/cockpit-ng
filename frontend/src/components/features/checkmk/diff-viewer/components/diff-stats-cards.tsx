import { Card, CardContent } from '@/components/ui/card'
import { StatusBadge } from '@/components/shared/status-badge'

interface DiffStatsCardsProps {
  totalDevices: number
  totalBoth: number
  totalNautobotOnly: number
  totalCheckmkOnly: number
}

export function DiffStatsCards({
  totalDevices,
  totalBoth,
  totalNautobotOnly,
  totalCheckmkOnly,
}: DiffStatsCardsProps) {
  if (totalDevices === 0) return null

  return (
    <div className="grid grid-cols-4 gap-4">
      <Card>
        <CardContent className="p-4">
          <div className="text-sm font-medium text-muted-foreground">Total Devices</div>
          <div className="text-2xl font-bold mt-1">{totalDevices}</div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2">
            <div className="text-sm font-medium text-muted-foreground">
              In Both Systems
            </div>
            <StatusBadge variant="success" className="text-xs">
              both
            </StatusBadge>
          </div>
          <div className="text-2xl font-bold mt-1">{totalBoth}</div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2">
            <div className="text-sm font-medium text-muted-foreground">
              Nautobot Only
            </div>
            <StatusBadge variant="info" className="text-xs">
              nb
            </StatusBadge>
          </div>
          <div className="text-2xl font-bold mt-1">{totalNautobotOnly}</div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2">
            <div className="text-sm font-medium text-muted-foreground">
              CheckMK Only
            </div>
            <StatusBadge variant="warning" className="text-xs">
              cmk
            </StatusBadge>
          </div>
          <div className="text-2xl font-bold mt-1">{totalCheckmkOnly}</div>
        </CardContent>
      </Card>
    </div>
  )
}
