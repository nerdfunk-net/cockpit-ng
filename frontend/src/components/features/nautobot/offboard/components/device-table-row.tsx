import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import type { Device } from '@/types/features/nautobot/offboard'
import { getStatusBadgeClass } from '@/utils/features/nautobot/offboard/ui-helpers'

interface DeviceTableRowProps {
  device: Device
  isSelected: boolean
  index: number
  onSelect: (deviceId: string, checked: boolean) => void
}

export function DeviceTableRow({ device, isSelected, index, onSelect }: DeviceTableRowProps) {
  return (
    <tr className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
      <td className="pl-4 pr-2 py-3 w-8 text-left">
        <Checkbox
          checked={isSelected}
          onCheckedChange={(checked) => onSelect(device.id, checked as boolean)}
        />
      </td>
      <td className="pl-4 pr-2 py-3 w-48 text-sm font-medium text-gray-900">
        {device.name || 'Unnamed Device'}
      </td>
      <td className="px-4 py-3 w-32 text-sm text-gray-600">
        {device.primary_ip4?.address || 'N/A'}
      </td>
      <td className="pl-8 pr-4 py-3 text-sm text-gray-600">
        {device.role?.name || 'Unknown'}
      </td>
      <td className="pl-4 pr-2 py-3 w-40 text-sm text-gray-600">
        {device.location?.name || 'Unknown'}
      </td>
      <td className="px-4 py-3">
        <Badge className={`text-white ${getStatusBadgeClass(device.status?.name || 'unknown')}`}>
          {device.status?.name || 'Unknown'}
        </Badge>
      </td>
    </tr>
  )
}
