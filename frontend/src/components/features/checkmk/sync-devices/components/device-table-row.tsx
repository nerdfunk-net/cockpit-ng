import { GitCompare, RefreshCw, ChevronDown, Radar } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuItem
} from '@/components/ui/dropdown-menu'
import type { Device } from '@/types/features/checkmk/sync-devices'
import { getStatusBadgeVariant } from '@/utils/features/checkmk/sync-devices/ui-helpers'
import { getRowColorClass } from '@/utils/features/checkmk/sync-devices/diff-helpers'
import { getCheckMKStatusBadge } from '@/utils/features/checkmk/sync-devices/badge-helpers'

interface DeviceTableRowProps {
  device: Device
  index: number
  isSelected: boolean
  diffResult?: 'equal' | 'diff' | 'host_not_found'
  diffResults: Record<string, 'equal' | 'diff' | 'host_not_found'>
  onSelect: (deviceId: string, checked: boolean) => void
  onGetDiff: (device: Device) => void
  onSync: (device: Device) => void
  onStartDiscovery: (device: Device, mode: string) => void
}

export function DeviceTableRow({
  device,
  index,
  isSelected,
  diffResults,
  onSelect,
  onGetDiff,
  onSync,
  onStartDiscovery
}: DeviceTableRowProps) {
  const baseRowClass = getRowColorClass(device.id, diffResults)
  const alternatingRowClass = index % 2 === 0 ? 'bg-white' : 'bg-gray-50'

  return (
    <tr
      className={baseRowClass || alternatingRowClass}
    >
      <td className="pl-4 pr-2 py-3 w-8 text-left">
        <Checkbox
          checked={isSelected}
          onCheckedChange={(checked) => onSelect(device.id, !!checked)}
          aria-label={`Select ${device.name}`}
        />
      </td>
      <td className="pl-4 pr-2 py-3 text-sm font-medium text-gray-900">{device.name}</td>
      <td className="px-4 py-3 text-sm text-gray-600">{device.primary_ip4?.address || 'N/A'}</td>
      <td className="px-4 py-3 text-sm text-gray-600">{device.role?.name || 'Unknown'}</td>
      <td className="pl-12 pr-4 py-3 text-sm text-gray-600">{device.location?.name || 'Unknown'}</td>
      <td className="px-4 py-3">
        <Badge variant={getStatusBadgeVariant(device.status?.name || '')}>
          {device.status?.name || 'Unknown'}
        </Badge>
      </td>
      <td className="pl-12 pr-4 py-3">
        <div className="flex items-center gap-1">
          {getCheckMKStatusBadge(device.checkmk_status)}
        </div>
      </td>
      <td className="pl-16 pr-4 py-3">
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onGetDiff(device)}
            title="Get Diff"
            className="h-8 w-8 p-0"
          >
            <GitCompare className="h-4 w-4" />
          </Button>

          <Button
            size="sm"
            variant="ghost"
            onClick={() => onSync(device)}
            title="Sync Device"
            className="h-8 w-8 p-0 text-blue-600 hover:text-blue-700"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="sm"
                variant="ghost"
                title="Start Discovery"
                className="h-8 w-8 p-0"
              >
                <Radar className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Discovery Mode</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onStartDiscovery(device, 'fix_all')}>
                Accept all
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onStartDiscovery(device, 'new')}>
                Monitor undecided services
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onStartDiscovery(device, 'remove')}>
                Remove vanished services
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onStartDiscovery(device, 'refresh')}>
                Rescan (background)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onStartDiscovery(device, 'tabula_rasa')}>
                Remove all and find new (background)
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onStartDiscovery(device, 'only_host_labels')}>
                Update host labels
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onStartDiscovery(device, 'only_service_labels')}>
                Update service labels
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </td>
    </tr>
  )
}
