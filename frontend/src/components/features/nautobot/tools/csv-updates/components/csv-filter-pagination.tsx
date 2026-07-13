'use client'

import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'
import { FILTER_PAGE_SIZE_OPTIONS } from '../constants'
import type { PaginationState } from '../types'

interface CsvFilterPaginationProps {
  pagination: PaginationState
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
}

export function CsvFilterPagination({
  pagination,
  onPageChange,
  onPageSizeChange,
}: CsvFilterPaginationProps) {
  const { currentPage, pageSize, totalItems, totalPages } = pagination

  const startItem = totalItems === 0 ? 0 : currentPage * pageSize + 1
  const endItem = Math.min((currentPage + 1) * pageSize, totalItems)

  return (
    <div className="bg-muted px-4 py-3 border-t flex flex-wrap items-center justify-between gap-2 rounded-b-lg">
      <div className="flex items-center space-x-2">
        <span className="text-sm text-muted-foreground">
          Showing {startItem} to {endItem} of {totalItems} rows
        </span>
        <Select
          value={pageSize.toString()}
          onValueChange={value => onPageSizeChange(parseInt(value))}
        >
          <SelectTrigger className="w-20 h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FILTER_PAGE_SIZE_OPTIONS.map(size => (
              <SelectItem key={size} value={size.toString()}>
                {size}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">per page</span>
      </div>

      <div className="flex items-center space-x-1">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(0)}
          disabled={currentPage === 0}
        >
          <ChevronsLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 0}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        {/* Page numbers */}
        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
          const startPage = Math.max(0, currentPage - 2)
          const pageNum = startPage + i
          if (pageNum >= totalPages) return null

          return (
            <Button
              key={pageNum}
              variant={currentPage === pageNum ? 'default' : 'outline'}
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
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages - 1}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(totalPages - 1)}
          disabled={currentPage >= totalPages - 1}
        >
          <ChevronsRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
