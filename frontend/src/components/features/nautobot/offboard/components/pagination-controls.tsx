import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'
import type { PaginationState } from '@/types/features/nautobot/offboard'
import { PAGE_SIZE_OPTIONS } from '@/utils/features/nautobot/offboard/ui-helpers'

interface PaginationControlsProps {
  pagination: PaginationState
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
}

export function PaginationControls({ pagination, onPageChange, onPageSizeChange }: PaginationControlsProps) {
  return (
    <div className="bg-gray-50 px-4 py-3 border-t flex items-center justify-between">
      <div className="flex items-center space-x-2">
        <span className="text-sm text-gray-600">
          Showing {pagination.currentPage * pagination.pageSize + 1} to{' '}
          {Math.min((pagination.currentPage + 1) * pagination.pageSize, pagination.totalItems)} of{' '}
          {pagination.totalItems} devices
        </span>
        <Select
          value={pagination.pageSize.toString()}
          onValueChange={(value) => onPageSizeChange(parseInt(value))}
        >
          <SelectTrigger className="w-20 h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PAGE_SIZE_OPTIONS.map(size => (
              <SelectItem key={size} value={size.toString()}>{size}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-sm text-gray-600">per page</span>
      </div>

      <div className="flex items-center space-x-1">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(0)}
          disabled={pagination.currentPage === 0}
        >
          <ChevronsLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(pagination.currentPage - 1)}
          disabled={pagination.currentPage === 0}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        {/* Page numbers */}
        {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
          const startPage = Math.max(0, pagination.currentPage - 2)
          const pageNum = startPage + i
          if (pageNum >= pagination.totalPages) return null

          return (
            <Button
              key={pageNum}
              variant={pagination.currentPage === pageNum ? "default" : "outline"}
              size="sm"
              onClick={() => onPageChange(pageNum)}
              className="w-8"
            >
              {pageNum + 1}
            </Button>
          )
        })}

        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(pagination.currentPage + 1)}
          disabled={pagination.currentPage >= pagination.totalPages - 1}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(pagination.totalPages - 1)}
          disabled={pagination.currentPage >= pagination.totalPages - 1}
        >
          <ChevronsRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
