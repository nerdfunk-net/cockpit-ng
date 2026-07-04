import { StatusBadge } from '@/components/shared/status-badge'
import type { DeviceSource } from '../types'

interface SystemBadgeProps {
  source: DeviceSource
}

export function SystemBadge({ source }: SystemBadgeProps) {
  switch (source) {
    case 'both':
      return <StatusBadge variant="success">Both Systems</StatusBadge>
    case 'nautobot':
      return <StatusBadge variant="info">Nautobot Only</StatusBadge>
    case 'checkmk':
      return <StatusBadge variant="warning">CheckMK Only</StatusBadge>
  }
}
