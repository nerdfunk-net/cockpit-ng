import { Button } from '@/components/ui/button'
import { RefreshCw } from 'lucide-react'

interface DeviceActionsBarProps {
  selectedCount: number
  filteredCount: number
  selectedJobId: string
  devicesCount: number
  isAllFilteredSelected: boolean
  onSelectAllFiltered: () => void
  onSyncDevices: () => void
}

export function DeviceActionsBar({
  selectedCount,
  filteredCount,
  selectedJobId,
  devicesCount,
  isAllFilteredSelected,
  onSelectAllFiltered,
  onSyncDevices
}: DeviceActionsBarProps) {
  return (
    <div className="bg-white p-4 border-t">
      <div className="flex justify-between items-center">
        <div className="text-sm text-gray-600 flex items-center gap-2">
          {selectedCount > 0 && (
            <span>{selectedCount} of {filteredCount} device(s) selected</span>
          )}
          {/* Show "Select All Filtered" button when there are more filtered devices than selected */}
          {selectedCount > 0 && selectedCount < filteredCount && (
            <Button
              onClick={onSelectAllFiltered}
              variant="link"
              size="sm"
              className="text-blue-600 hover:text-blue-800 p-0 h-auto"
            >
              Select all {filteredCount} filtered devices
            </Button>
          )}
          {selectedCount > 0 && isAllFilteredSelected && (
            <span className="text-green-600">(all filtered devices selected)</span>
          )}
          {selectedJobId && devicesCount > 0 && (
            <span className="ml-4 text-blue-600">
              Showing results from job: {selectedJobId.slice(0, 8)}...
            </span>
          )}
        </div>
        <div className="flex space-x-2">
          <Button 
            onClick={onSyncDevices}
            disabled={selectedCount === 0}
            variant="outline"
            className="flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Sync Devices ({selectedCount})
          </Button>
        </div>
      </div>
    </div>
  )
}
