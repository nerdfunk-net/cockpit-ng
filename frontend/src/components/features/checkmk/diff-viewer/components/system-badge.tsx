import { Badge } from '@/components/ui/badge'
import type { DeviceSource } from '@/types/features/checkmk/diff-viewer'

interface SystemBadgeProps {
  source: DeviceSource
}

export function SystemBadge({ source }: SystemBadgeProps) {
  switch (source) {
    case 'both':
      return (
        <Badge variant="secondary" className="bg-green-100 text-green-800">
          Both Systems
        </Badge>
      )
    case 'nautobot':
      return (
        <Badge variant="secondary" className="bg-blue-100 text-blue-800">
          Nautobot Only
        </Badge>
      )
    case 'checkmk':
      return (
        <Badge variant="secondary" className="bg-orange-100 text-orange-800">
          CheckMK Only
        </Badge>
      )
  }
}
