import { GitCompare, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { StatusBadge } from '@/components/shared/status-badge'
import { SystemBadge } from './system-badge'
import type { DiffDevice } from '../types'

interface DiffTableRowProps {
  device: DiffDevice
  index: number
  isSelected: boolean
  onSelectDevice: (nautobotId: string, checked: boolean) => void
  onGetDiff: (device: DiffDevice) => void
  onSync: (device: DiffDevice) => void
}

export function DiffTableRow({
  device,
  index,
  isSelected,
  onSelectDevice,
  onGetDiff,
  onSync,
}: DiffTableRowProps) {
  const alternatingRowClass = index % 2 === 0 ? 'bg-card' : 'bg-muted'
  const displayIp = device.ip_address || device.checkmk_ip || 'N/A'
  const canViewDiff = !!device.nautobot_id

  // Sync pushes from Nautobot to CheckMK; require a Nautobot device id (excludes CheckMK-only rows).
  const canSync = Boolean(device.nautobot_id)

  return (
    <tr className={alternatingRowClass}>
      <td className="pl-3 pr-1 py-3 w-10">
        <Checkbox
          checked={isSelected}
          onCheckedChange={checked => {
            if (device.nautobot_id) onSelectDevice(device.nautobot_id, !!checked)
          }}
          disabled={!device.nautobot_id}
          aria-label={`Select ${device.name}`}
        />
      </td>
      <td className="pl-4 pr-2 py-3 w-56 text-sm font-medium text-foreground">
        {device.name}
      </td>
      <td className="px-4 py-3 w-36 text-sm text-muted-foreground">{displayIp}</td>
      <td className="px-4 py-3 w-40 text-sm text-muted-foreground">
        {device.role || 'Unknown'}
      </td>
      <td className="px-4 py-3 w-48 text-sm text-muted-foreground">
        {device.location || 'Unknown'}
      </td>
      <td className="px-4 py-3 w-36">
        {device.status ? (
          <Badge variant="secondary">{device.status}</Badge>
        ) : (
          <span className="text-sm text-muted-foreground">N/A</span>
        )}
      </td>
      <td className="px-4 py-3 w-44">
        <SystemBadge source={device.source} />
      </td>
      <td className="px-4 py-3 w-36">
        {device.checkmk_diff_status ? (
          <StatusBadge
            variant={
              device.checkmk_diff_status === 'equal'
                ? 'success'
                : device.checkmk_diff_status === 'host_not_found'
                  ? 'error'
                  : 'warning'
            }
          >
            {device.checkmk_diff_status === 'equal'
              ? 'Match'
              : device.checkmk_diff_status === 'host_not_found'
                ? 'Not Found'
                : 'Diff'}
          </StatusBadge>
        ) : (
          <span className="text-sm text-muted-foreground">&mdash;</span>
        )}
      </td>
      <td className="px-4 py-3 w-28">
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onGetDiff(device)}
            disabled={!canViewDiff}
            title={canViewDiff ? 'View Diff' : 'Device has no Nautobot ID'}
            className="h-8 w-8 p-0"
          >
            <GitCompare className="h-4 w-4" />
          </Button>

          <Button
            size="sm"
            variant="ghost"
            onClick={() => onSync(device)}
            disabled={!canSync}
            title={
              canSync
                ? 'Sync Device'
                : device.source === 'checkmk'
                  ? 'Sync is not available for CheckMK-only hosts'
                  : 'Sync not available for this device'
            }
            className="h-8 w-8 p-0 text-primary hover:text-primary/80 disabled:text-muted-foreground"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </td>
    </tr>
  )
}
