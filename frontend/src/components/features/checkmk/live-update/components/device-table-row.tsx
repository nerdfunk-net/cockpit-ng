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
import type { Device } from '@/types/features/checkmk/live-update'
import { getStatusBadgeVariant } from '@/utils/features/checkmk/live-update/ui-helpers'
import { getRowColorClass } from '@/utils/features/checkmk/live-update/diff-helpers'

interface DeviceTableRowProps {
  device: Device
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
  isSelected,
  diffResults,
  onSelect,
  onGetDiff,
  onSync,
  onStartDiscovery
}: DeviceTableRowProps) {
  return (
    <tr
      className={`border-b transition-colors ${getRowColorClass(device.id, diffResults) || 'hover:bg-muted/50'}`}
    >
      <td className="p-2 w-12">
        <Checkbox
          checked={isSelected}
          onCheckedChange={(checked) => onSelect(device.id, !!checked)}
          aria-label={`Select ${device.name}`}
        />
      </td>
      <td className="p-2 font-medium">{device.name}</td>
      <td className="p-2">{device.primary_ip4?.address || 'N/A'}</td>
      <td className="p-2">{device.role?.name || 'Unknown'}</td>
      <td className="p-2">{device.location?.name || 'Unknown'}</td>
      <td className="p-2">
        <Badge variant={getStatusBadgeVariant(device.status?.name || '')}>
          {device.status?.name || 'Unknown'}
        </Badge>
      </td>
      <td className="p-2">
        <div className="flex gap-1">
          <Button
            size="sm"
            variant="outline"
            onClick={() => onGetDiff(device)}
            title="Get Diff"
          >
            <GitCompare className="h-3 w-3" />
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => onSync(device)}
            title="Sync Device"
          >
            <RefreshCw className="h-3 w-3" />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                title="Start Discovery"
              >
                <Radar className="h-3 w-3" />
                <ChevronDown className="h-2 w-2 ml-1" />
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
