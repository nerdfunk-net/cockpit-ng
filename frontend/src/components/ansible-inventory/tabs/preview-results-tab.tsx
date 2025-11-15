/**
 * Preview Results Tab Component
 * Displays filtered device results with pagination
 */

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight, Database } from 'lucide-react'
import { getStatusColor, formatDeviceValue } from '../utils'

type PreviewResultsType = ReturnType<typeof import('../hooks').usePreviewResults>

interface PreviewResultsTabProps {
  previewResults: PreviewResultsType
}

export function PreviewResultsTab({ previewResults }: PreviewResultsTabProps) {
  const {
    totalDevices,
    operationsExecuted,
    currentPage,
    totalPages,
    startIndex,
    endIndex,
    currentPageDevices,
    setCurrentPage,
  } = previewResults

  return (
    <div className="shadow-lg border-0 p-0 bg-white rounded-lg">
      <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4 flex items-center justify-between rounded-t-lg">
        <div className="flex items-center space-x-2">
          <Database className="h-4 w-4" />
          <span className="text-sm font-medium">Preview Results</span>
        </div>
        <Badge className="bg-white text-blue-700">
          {totalDevices} device{totalDevices !== 1 ? 's' : ''} found
        </Badge>
      </div>

      <div className="p-6 bg-gradient-to-b from-white to-gray-50">
        <div className="mb-4 text-sm text-gray-600">
          Operations executed: {operationsExecuted} | Showing {startIndex + 1}-{endIndex} of {totalDevices}
        </div>

        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead className="font-semibold">Device Name</TableHead>
                <TableHead className="font-semibold">Location</TableHead>
                <TableHead className="font-semibold">Role</TableHead>
                <TableHead className="font-semibold">Platform</TableHead>
                <TableHead className="font-semibold">Primary IP</TableHead>
                <TableHead className="font-semibold">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {currentPageDevices.map((device) => (
                <TableRow key={device.id}>
                  <TableCell className="font-medium">{device.name}</TableCell>
                  <TableCell>{formatDeviceValue(device.location)}</TableCell>
                  <TableCell>{formatDeviceValue(device.role)}</TableCell>
                  <TableCell>{formatDeviceValue(device.platform)}</TableCell>
                  <TableCell>{formatDeviceValue(device.primary_ip4)}</TableCell>
                  <TableCell>
                    <Badge className={getStatusColor(device.status || '')}>
                      {device.status || 'N/A'}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <div className="text-sm text-gray-600">
              Page {currentPage} of {totalPages}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(currentPage - 1)}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(currentPage + 1)}
                disabled={currentPage === totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
