import { GitCompare, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { SystemBadge } from './system-badge'
import type { DiffDevice } from '@/types/features/checkmk/diff-viewer'

interface DiffTableRowProps {
  device: DiffDevice
  index: number
  onGetDiff: (device: DiffDevice) => void
  onSync: (device: DiffDevice) => void
}

export function DiffTableRow({ device, index, onGetDiff, onSync }: DiffTableRowProps) {
  const alternatingRowClass = index % 2 === 0 ? 'bg-white' : 'bg-gray-50'
  const displayIp = device.ip_address || device.checkmk_ip || 'N/A'
  const canViewDiff = device.source === 'both' && !!device.nautobot_id
  
  // Enable sync when: 1) Nautobot Only OR 2) Both Systems with Differ status
  const canSync = device.nautobot_id && (
    device.source === 'nautobot' ||
    (device.source === 'both' && device.checkmk_diff_status && device.checkmk_diff_status !== 'equal' && device.checkmk_diff_status !== 'host_not_found')
  )

  return (
    <tr className={alternatingRowClass}>
      <td className="pl-4 pr-2 py-3 w-56 text-sm font-medium text-gray-900">
        {device.name}
      </td>
      <td className="px-4 py-3 w-36 text-sm text-gray-600">
        {displayIp}
      </td>
      <td className="px-4 py-3 w-40 text-sm text-gray-600">
        {device.role || 'Unknown'}
      </td>
      <td className="px-4 py-3 w-48 text-sm text-gray-600">
        {device.location || 'Unknown'}
      </td>
      <td className="px-4 py-3 w-36">
        {device.status ? (
          <Badge variant="secondary">{device.status}</Badge>
        ) : (
          <span className="text-sm text-gray-400">N/A</span>
        )}
      </td>
      <td className="px-4 py-3 w-44">
        <SystemBadge source={device.source} />
      </td>
      <td className="px-4 py-3 w-36">
        {device.checkmk_diff_status ? (
          <Badge
            variant="secondary"
            className={
              device.checkmk_diff_status === 'equal'
                ? 'bg-green-100 text-green-800'
                : device.checkmk_diff_status === 'host_not_found'
                  ? 'bg-red-100 text-red-800'
                  : 'bg-orange-100 text-orange-800'
            }
          >
            {device.checkmk_diff_status === 'equal'
              ? 'Match'
              : device.checkmk_diff_status === 'host_not_found'
                ? 'Not Found'
                : 'Diff'}
          </Badge>
        ) : (
          <span className="text-sm text-gray-400">&mdash;</span>
        )}
      </td>
      <td className="px-4 py-3 w-28">
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onGetDiff(device)}
            disabled={!canViewDiff}
            title={canViewDiff ? 'View Diff' : 'Only available for devices in both systems'}
            className="h-8 w-8 p-0"
          >
            <GitCompare className="h-4 w-4" />
          </Button>

          <Button
            size="sm"
            variant="ghost"
            onClick={() => onSync(device)}
            disabled={!canSync}
            title={canSync ? 'Sync Device' : 'Sync not available for this device'}
            className="h-8 w-8 p-0 text-blue-600 hover:text-blue-700 disabled:text-gray-400"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </td>
    </tr>
  )
}
