import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { RefreshCw, Eye, Plus, AlertCircle } from 'lucide-react'
import type { Device } from '../types/sync-devices.types'
import { getStatusBadge, getCheckMKStatusBadge } from '../utils/sync-devices.utils'

interface DeviceTableProps {
  devices: Device[]
  filteredDevices: Device[]
  currentItems: Device[]
  selectedDevices: Set<string>
  addingDevices: Set<string>
  onSelectAll: (checked: boolean, devices: Device[]) => void
  onSelectDevice: (deviceId: string, checked: boolean) => void
  onViewDevice: (device: Device) => void
  onShowDiff: (device: Device) => void
  onSyncDevice: (device: Device) => void
  onAddDevice: (device: Device) => void
}

export function DeviceTable({
  devices,
  filteredDevices,
  currentItems,
  selectedDevices,
  addingDevices,
  onSelectAll,
  onSelectDevice,
  onViewDevice,
  onShowDiff,
  onSyncDevice,
  onAddDevice
}: DeviceTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-gray-100 border-b">
          <tr>
            <th className="pl-4 pr-2 py-3 w-8 text-left">
              <Checkbox
                checked={currentItems.length > 0 && currentItems.every((device: Device) => selectedDevices.has(device.id))}
                onCheckedChange={(checked) => onSelectAll(!!checked, currentItems)}
              />
            </th>
            <th className="pl-4 pr-2 py-3 w-48 text-left text-xs font-medium text-gray-600 uppercase">Device Name</th>
            <th className="px-4 py-3 w-32 text-left text-xs font-medium text-gray-600 uppercase">Role</th>
            <th className="px-4 py-3 w-28 text-left text-xs font-medium text-gray-600 uppercase">Status</th>
            <th className="pl-12 pr-4 py-3 w-40 text-left text-xs font-medium text-gray-600 uppercase">Location</th>
            <th className="pl-12 pr-4 py-3 w-32 text-left text-xs font-medium text-gray-600 uppercase">CheckMK</th>
            <th className="pl-16 pr-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {devices.length === 0 ? (
            <tr>
              <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                No devices found. Select a job from the dropdown above and click &ldquo;Load&rdquo; to view comparison results.
              </td>
            </tr>
          ) : filteredDevices.length === 0 ? (
            <tr>
              <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                No devices match the current filters.
              </td>
            </tr>
          ) : (
            currentItems.map((device: Device, index: number) => (
              <tr key={device.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                <td className="pl-4 pr-2 py-3 w-8 text-left">
                  <Checkbox
                    checked={selectedDevices.has(device.id)}
                    onCheckedChange={(checked) => onSelectDevice(device.id, checked as boolean)}
                  />
                </td>
                <td className="pl-4 pr-2 py-3 w-48 text-sm font-medium text-gray-900">
                  {device.name}
                </td>
                <td className="px-4 py-3 w-32 text-sm text-gray-600">
                  {device.role}
                </td>
                <td className="px-4 py-3 w-28 text-sm text-gray-600">
                  {getStatusBadge(device.status)}
                </td>
                <td className="pl-12 pr-4 py-3 w-40 text-sm text-gray-600">
                  {device.location}
                </td>
                <td className="pl-12 pr-4 py-3 w-32">
                  <div className="flex items-center gap-1">
                    {getCheckMKStatusBadge(device.checkmk_status)}
                    {device.checkmk_status === 'error' && device.diff && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onViewDevice(device)}
                        title="View error details"
                        className="h-6 w-6 p-0 text-red-600 hover:text-red-700"
                      >
                        <AlertCircle className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </td>
                <td className="pl-16 pr-4 py-3">
                  <div className="flex items-center gap-1">
                    {/* Eye Button - Always visible for diff comparison */}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onShowDiff(device)}
                      title="Show device comparison"
                      className="h-8 w-8 p-0"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>

                    {/* Sync Device Button - Always visible next to View button */}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onSyncDevice(device)}
                      title="Sync Device"
                      className="h-8 w-8 p-0 text-blue-600 hover:text-blue-700"
                    >
                      <RefreshCw className="h-4 w-4" />
                    </Button>

                    {/* Add Button - Only for missing devices */}
                    {device.checkmk_status === 'missing' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onAddDevice(device)}
                        disabled={addingDevices.has(device.id)}
                        title="Add device to CheckMK"
                        className="h-8 w-8 p-0 text-green-600 hover:text-green-700"
                      >
                        {addingDevices.has(device.id) ? (
                          <RefreshCw className="h-4 w-4 animate-spin" />
                        ) : (
                          <Plus className="h-4 w-4" />
                        )}
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
