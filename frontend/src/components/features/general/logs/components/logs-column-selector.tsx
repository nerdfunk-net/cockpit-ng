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

export interface ColumnDef {
  id: string
  label: string
  defaultVisible: boolean
}

interface LogsColumnSelectorProps {
  columns: ColumnDef[]
  visibleColumnIds: string[]
  onToggle: (columnId: string, visible: boolean) => void
}

export function LogsColumnSelector({
  columns,
  visibleColumnIds,
  onToggle,
}: LogsColumnSelectorProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="text-white hover:bg-white/20 text-xs h-6">
          <Settings className="h-3 w-3 mr-1" />
          Columns
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel>Toggle Columns</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {columns.map((col) => (
          <DropdownMenuCheckboxItem
            key={col.id}
            checked={visibleColumnIds.includes(col.id)}
            onCheckedChange={(checked) => onToggle(col.id, checked)}
          >
            {col.label}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
