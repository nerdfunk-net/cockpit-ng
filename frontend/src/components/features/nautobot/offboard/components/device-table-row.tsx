import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { StatusBadge } from '@/components/shared/status-badge'
import type { Device } from '@/types/features/nautobot/offboard'
import { getStatusBadgeVariant } from '@/utils/features/nautobot/offboard/ui-helpers'

interface DeviceTableRowProps {
  device: Device
  isSelected: boolean
  index: number
  onSelect: (deviceId: string, checked: boolean) => void
}

export function DeviceTableRow({
  device,
  isSelected,
  index,
  onSelect,
}: DeviceTableRowProps) {
  const variant = getStatusBadgeVariant(device.status?.name || 'unknown')

  return (
    <tr className={index % 2 === 0 ? 'bg-card' : 'bg-muted/50'}>
      <td className="pl-4 pr-2 py-3 w-8 text-left">
        <Checkbox
          checked={isSelected}
          onCheckedChange={checked => onSelect(device.id, checked as boolean)}
        />
      </td>
      <td className="pl-4 pr-2 py-3 w-48 text-sm font-medium text-foreground">
        {device.name || 'Unnamed Device'}
      </td>
      <td className="px-4 py-3 w-32 text-sm text-muted-foreground">
        {device.primary_ip4?.address || 'N/A'}
      </td>
      <td className="pl-8 pr-4 py-3 text-sm text-muted-foreground">
        {device.role?.name || 'Unknown'}
      </td>
      <td className="pl-4 pr-2 py-3 w-40 text-sm text-muted-foreground">
        {device.location?.name || 'Unknown'}
      </td>
      <td className="px-4 py-3">
        {variant === 'neutral' ? (
          <Badge variant="secondary">{device.status?.name || 'Unknown'}</Badge>
        ) : (
          <StatusBadge variant={variant}>
            {device.status?.name || 'Unknown'}
          </StatusBadge>
        )}
      </td>
    </tr>
  )
}
