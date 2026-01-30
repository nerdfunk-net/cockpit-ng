'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Filter, RotateCcw } from 'lucide-react'
import type { DeviceFilters } from '../types'

interface BackupFiltersProps {
  filters: DeviceFilters
  onFiltersChange: (filters: DeviceFilters) => void
  onReset: () => void
  activeFiltersCount: number
}

export function BackupFilters({
  filters,
  onFiltersChange,
  onReset,
  activeFiltersCount
}: BackupFiltersProps) {
  return (
    <div className="rounded-xl border shadow-sm overflow-hidden">
      <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4">
        <div className="flex items-center space-x-2">
          <Filter className="h-4 w-4" />
          <div>
            <h3 className="text-sm font-semibold">Filter & Controls</h3>
            <p className="text-blue-100 text-xs">Filter devices by backup date and manage display options</p>
          </div>
        </div>
      </div>
      <div className="p-4 bg-white">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <Label htmlFor="backup-date-filter">Last Backup Date</Label>
            <Input
              id="backup-date-filter"
              type="date"
              value={filters.lastBackupDate || ''}
              onChange={(e) => onFiltersChange({ ...filters, lastBackupDate: e.target.value })}
              className="min-w-[150px] border-2 bg-white border-gray-300 hover:border-gray-400 focus:border-blue-500"
            />
          </div>

          <div>
            <Label htmlFor="date-comparison">Date Comparison</Label>
            <Select
              value={filters.dateComparison || "none"}
              onValueChange={(value) => onFiltersChange({
                ...filters,
                dateComparison: value === "none" ? "" : value as 'lte' | 'lt'
              })}
            >
              <SelectTrigger className="min-w-[150px] border-2 bg-white border-gray-300 hover:border-gray-400 focus:border-blue-500">
                <SelectValue placeholder="No Date Filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No Date Filter</SelectItem>
                <SelectItem value="lte">≤ (Less/Equal)</SelectItem>
                <SelectItem value="lt">&lt; (Less Than)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-end gap-2">
            <Button variant="outline" onClick={onReset}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Clear All Filters
            </Button>
            {activeFiltersCount > 0 && (
              <Badge variant="secondary">
                {activeFiltersCount} active
              </Badge>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
