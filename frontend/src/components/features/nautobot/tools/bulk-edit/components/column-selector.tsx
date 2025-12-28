'use client'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Settings } from 'lucide-react'
import type { ColumnDefinition } from '../tabs/bulk-edit-tab'

interface ColumnSelectorProps {
  availableColumns: ColumnDefinition[]
  visibleColumns: ColumnDefinition[]
  onAddColumn: (columnId: string) => void
  onRemoveColumn: (columnId: string) => void
  isLoading: boolean
}

export function ColumnSelector({
  availableColumns,
  visibleColumns,
  onAddColumn,
  onRemoveColumn,
  isLoading,
}: ColumnSelectorProps) {
  const isColumnVisible = (columnId: string) => {
    return visibleColumns.some(c => c.id === columnId)
  }

  const handleToggleColumn = (columnId: string, checked: boolean) => {
    if (checked) {
      onAddColumn(columnId)
    } else {
      onRemoveColumn(columnId)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" disabled={isLoading} className="text-white hover:bg-white/20 text-xs h-6">
          <Settings className="h-3 w-3 mr-1" />
          Columns
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Toggle Columns</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {availableColumns.map((column) => (
          <DropdownMenuCheckboxItem
            key={column.id}
            checked={isColumnVisible(column.id)}
            onCheckedChange={(checked) => handleToggleColumn(column.id, checked)}
          >
            {column.label}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
