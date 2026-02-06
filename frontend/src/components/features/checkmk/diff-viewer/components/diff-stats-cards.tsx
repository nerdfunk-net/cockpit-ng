import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'

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
            <div className="text-sm font-medium text-muted-foreground">In Both Systems</div>
            <Badge variant="secondary" className="bg-green-100 text-green-800 text-xs">
              both
            </Badge>
          </div>
          <div className="text-2xl font-bold mt-1">{totalBoth}</div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2">
            <div className="text-sm font-medium text-muted-foreground">Nautobot Only</div>
            <Badge variant="secondary" className="bg-blue-100 text-blue-800 text-xs">
              nb
            </Badge>
          </div>
          <div className="text-2xl font-bold mt-1">{totalNautobotOnly}</div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2">
            <div className="text-sm font-medium text-muted-foreground">CheckMK Only</div>
            <Badge variant="secondary" className="bg-orange-100 text-orange-800 text-xs">
              cmk
            </Badge>
          </div>
          <div className="text-2xl font-bold mt-1">{totalCheckmkOnly}</div>
        </CardContent>
      </Card>
    </div>
  )
}
