import { Checkbox } from '@/components/ui/checkbox'

interface DeviceTableHeaderProps {
  hasSelectedDevices: boolean
  allSelected: boolean
  onSelectAll: (checked: boolean) => void
}

export function DeviceTableHeader({ allSelected, onSelectAll }: DeviceTableHeaderProps) {
  return (
    <thead className="bg-gray-100 border-b">
      <tr>
        <th className="pl-4 pr-2 py-3 w-8 text-left">
          <Checkbox
            checked={allSelected}
            onCheckedChange={onSelectAll}
          />
        </th>
        <th className="pl-4 pr-2 py-3 w-48 text-left text-xs font-medium text-gray-600 uppercase">Device Name</th>
        <th className="px-4 py-3 w-32 text-left text-xs font-medium text-gray-600 uppercase">IP Address</th>
        <th className="pl-8 pr-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Role</th>
        <th className="pl-4 pr-2 py-3 w-40 text-left text-xs font-medium text-gray-600 uppercase">Location</th>
        <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Status</th>
      </tr>
    </thead>
  )
}
