import {
    DeviceInfo
} from '@/types/shared/device-selector'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Database, ChevronLeft, ChevronRight } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'


interface DeviceTableProps {
    devices: DeviceInfo[]
    totalDevices: number
    operationsExecuted: number
    showPreviewResults: boolean
    enableSelection?: boolean
    selectedIds: Set<string>
    onSelectAll: (checked: boolean) => void
    onSelectDevice: (id: string, checked: boolean) => void
    onClearSelection: () => void
    currentPage: number
    totalPages: number
    onPageChange: (page: number) => void
    pageSize: number
    setPageSize: (size: number) => void
    currentPageDevices: DeviceInfo[]
}

export function DeviceTable({
    devices,
    totalDevices,
    operationsExecuted,
    showPreviewResults,
    enableSelection,
    selectedIds,
    onSelectAll,
    onSelectDevice,
    onClearSelection,
    currentPage,
    totalPages,
    onPageChange,
    pageSize,
    setPageSize,
    currentPageDevices
}: DeviceTableProps) {
    if (!showPreviewResults && devices.length === 0) return null

    const formatDeviceValue = (value: string | { name?: string; address?: string } | null | undefined) => {
        if (!value) return 'N/A'
        if (typeof value === 'object') {
            return value.name || value.address?.split('/')[0] || 'N/A'
        }
        return value
    }

    const getStatusColor = (status: string) => {
        switch (status?.toLowerCase()) {
            case 'active': return 'bg-green-100 text-green-800'
            case 'planned': return 'bg-blue-100 text-blue-800'
            case 'staged': return 'bg-yellow-100 text-yellow-800'
            case 'failed': return 'bg-red-100 text-red-800'
            case 'offline': return 'bg-gray-100 text-gray-800'
            default: return 'bg-blue-100 text-blue-800'
        }
    }

    return (
        <div className="shadow-lg border-0 p-0 bg-white rounded-lg">
            <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4 flex items-center justify-between rounded-t-lg">
                <div className="flex items-center space-x-2">
                    <Database className="h-4 w-4" />
                    <span className="text-sm font-medium">Preview Results</span>
                </div>
                <div className="text-xs text-blue-100">
                    {totalDevices} devices found ({operationsExecuted} queries executed)
                </div>
            </div>
            <div className="p-6 bg-gradient-to-b from-white to-gray-50">
                {enableSelection && selectedIds.size > 0 && (
                    <div className="mb-4 p-3 bg-purple-50 border border-purple-200 rounded-md flex items-center justify-between">
                        <p className="text-sm text-purple-800">
                            <strong>{selectedIds.size}</strong> device{selectedIds.size !== 1 ? 's' : ''} selected for command execution
                        </p>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={onClearSelection}
                            className="text-purple-600 hover:text-purple-800"
                        >
                            Clear Selection
                        </Button>
                    </div>
                )}
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                {enableSelection && (
                                    <TableHead className="w-12">
                                        <Checkbox
                                            checked={currentPageDevices.length > 0 && currentPageDevices.every(d => selectedIds.has(d.id))}
                                            onCheckedChange={(checked) => onSelectAll(!!checked)}
                                            aria-label="Select all on page"
                                        />
                                    </TableHead>
                                )}
                                <TableHead>Host Name</TableHead>
                                <TableHead>IP Address</TableHead>
                                <TableHead>Location</TableHead>
                                <TableHead>Role</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead>Tags</TableHead>
                                <TableHead>Status</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {currentPageDevices.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={enableSelection ? 8 : 7} className="text-center py-8 text-gray-500">
                                        No devices found matching the criteria.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                currentPageDevices.map((device) => (
                                    <TableRow key={device.id}>
                                        {enableSelection && (
                                            <TableCell>
                                                <Checkbox
                                                    checked={selectedIds.has(device.id)}
                                                    onCheckedChange={(checked) => onSelectDevice(device.id, !!checked)}
                                                    aria-label={`Select device ${device.name}`}
                                                />
                                            </TableCell>
                                        )}
                                        <TableCell className="font-medium">{device.name || 'Unnamed Device'}</TableCell>
                                        <TableCell>{formatDeviceValue(device.primary_ip4)}</TableCell>
                                        <TableCell>{device.location || 'N/A'}</TableCell>
                                        <TableCell>{device.role || 'N/A'}</TableCell>
                                        <TableCell>{formatDeviceValue(device.device_type)}</TableCell>
                                        <TableCell>
                                            <div className="flex flex-wrap gap-1">
                                                {device.tags && device.tags.length > 0 ? (
                                                    device.tags.slice(0, 3).map(tag => (
                                                        <Badge key={tag} variant="secondary" className="text-xs px-1 py-0 h-5">
                                                            {tag.split(':')[1] || tag}
                                                        </Badge>
                                                    ))
                                                ) : (
                                                    <span className="text-xs text-gray-400">-</span>
                                                )}
                                                {device.tags && device.tags.length > 3 && (
                                                    <Badge variant="outline" className="text-xs px-1 py-0 h-5">
                                                        +{device.tags.length - 3}
                                                    </Badge>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge className={getStatusColor(device.status || '')}>
                                                {device.status || 'Unknown'}
                                            </Badge>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>

                {/* Pagination */}
                {totalDevices > 0 && (
                    <div className="flex items-center justify-between mt-4 border-t pt-4">
                        <div className="text-sm text-gray-500">
                            Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, totalDevices)} of {totalDevices} entries
                        </div>
                        <div className="flex items-center space-x-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => onPageChange(currentPage - 1)}
                                disabled={currentPage === 1}
                            >
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <div className="flex items-center space-x-1">
                                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                    let pageNum = currentPage;
                                    if (totalPages <= 5) {
                                        pageNum = i + 1;
                                    } else if (currentPage <= 3) {
                                        pageNum = i + 1;
                                    } else if (currentPage >= totalPages - 2) {
                                        pageNum = totalPages - 4 + i;
                                    } else {
                                        pageNum = currentPage - 2 + i;
                                    }

                                    return (
                                        <Button
                                            key={pageNum}
                                            variant={currentPage === pageNum ? "default" : "outline"}
                                            size="sm"
                                            onClick={() => onPageChange(pageNum)}
                                            className="w-8 h-8 p-0"
                                        >
                                            {pageNum}
                                        </Button>
                                    );
                                })}
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => onPageChange(currentPage + 1)}
                                disabled={currentPage === totalPages}
                            >
                                <ChevronRight className="h-4 w-4" />
                            </Button>

                            <div className="flex items-center gap-2 ml-4">
                                <span className="text-sm text-gray-500">Rows per page:</span>
                                <Select value={pageSize.toString()} onValueChange={(val) => setPageSize(parseInt(val))}>
                                    <SelectTrigger className="w-16 h-8">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="10">10</SelectItem>
                                        <SelectItem value="20">20</SelectItem>
                                        <SelectItem value="50">50</SelectItem>
                                        <SelectItem value="100">100</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
