'use client'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { RefreshCw, Trash2, ChevronDown } from 'lucide-react'
import { STATUS_OPTIONS, JOB_TYPE_OPTIONS, TRIGGER_OPTIONS } from '../utils/constants'
import type { JobTemplate } from '../types'

interface JobsFilterProps {
  statusFilter: string[]
  jobTypeFilter: string[]
  triggerFilter: string[]
  templateFilter: string[]
  availableTemplates: JobTemplate[]
  onStatusChange: (values: string[]) => void
  onJobTypeChange: (values: string[]) => void
  onTriggerChange: (values: string[]) => void
  onTemplateChange: (values: string[]) => void
  onRefresh: () => void
  onClearHistory: () => void
  isRefreshing: boolean
  isClearing: boolean
  hasJobs: boolean
  hasActiveFilters: boolean
  filterDescription: string
}

export function JobsFilter({
  statusFilter,
  jobTypeFilter,
  triggerFilter,
  templateFilter,
  availableTemplates,
  onStatusChange,
  onJobTypeChange,
  onTriggerChange,
  onTemplateChange,
  onRefresh,
  onClearHistory,
  isRefreshing,
  isClearing,
  hasJobs,
  hasActiveFilters,
  filterDescription,
}: JobsFilterProps) {
  const toggleFilter = (currentValues: string[], value: string) => {
    return currentValues.includes(value)
      ? currentValues.filter(v => v !== value)
      : [...currentValues, value]
  }

  return (
    <div className="flex items-center gap-3">
      {/* Status Filter */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="w-[130px] justify-between">
            {statusFilter.length === 0 ? "All Status" : `${statusFilter.length} selected`}
            <ChevronDown className="ml-2 h-4 w-4 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-[150px]">
          <DropdownMenuLabel>Status</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {STATUS_OPTIONS.map((option) => (
            <DropdownMenuCheckboxItem
              key={option.value}
              checked={statusFilter.includes(option.value)}
              onCheckedChange={() => onStatusChange(toggleFilter(statusFilter, option.value))}
            >
              {option.label}
            </DropdownMenuCheckboxItem>
          ))}
          {statusFilter.length > 0 && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuCheckboxItem
                checked={false}
                onCheckedChange={() => onStatusChange([])}
                className="text-red-600"
              >
                Clear all
              </DropdownMenuCheckboxItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Job Type Filter */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="w-[150px] justify-between">
            {jobTypeFilter.length === 0 ? "All Types" : `${jobTypeFilter.length} selected`}
            <ChevronDown className="ml-2 h-4 w-4 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-[180px]">
          <DropdownMenuLabel>Job Type</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {JOB_TYPE_OPTIONS.map((option) => (
            <DropdownMenuCheckboxItem
              key={option.value}
              checked={jobTypeFilter.includes(option.value)}
              onCheckedChange={() => onJobTypeChange(toggleFilter(jobTypeFilter, option.value))}
            >
              {option.label}
            </DropdownMenuCheckboxItem>
          ))}
          {jobTypeFilter.length > 0 && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuCheckboxItem
                checked={false}
                onCheckedChange={() => onJobTypeChange([])}
                className="text-red-600"
              >
                Clear all
              </DropdownMenuCheckboxItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Trigger Filter */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="w-[130px] justify-between">
            {triggerFilter.length === 0 ? "All Triggers" : `${triggerFilter.length} selected`}
            <ChevronDown className="ml-2 h-4 w-4 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-[150px]">
          <DropdownMenuLabel>Trigger</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {TRIGGER_OPTIONS.map((option) => (
            <DropdownMenuCheckboxItem
              key={option.value}
              checked={triggerFilter.includes(option.value)}
              onCheckedChange={() => onTriggerChange(toggleFilter(triggerFilter, option.value))}
            >
              {option.label}
            </DropdownMenuCheckboxItem>
          ))}
          {triggerFilter.length > 0 && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuCheckboxItem
                checked={false}
                onCheckedChange={() => onTriggerChange([])}
                className="text-red-600"
              >
                Clear all
              </DropdownMenuCheckboxItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Template Filter */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="w-[150px] justify-between">
            {templateFilter.length === 0 ? "All Templates" : `${templateFilter.length} selected`}
            <ChevronDown className="ml-2 h-4 w-4 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-[200px]">
          <DropdownMenuLabel>Template</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {availableTemplates.map((template) => (
            <DropdownMenuCheckboxItem
              key={template.id}
              checked={templateFilter.includes(template.id.toString())}
              onCheckedChange={() => onTemplateChange(toggleFilter(templateFilter, template.id.toString()))}
            >
              {template.name}
            </DropdownMenuCheckboxItem>
          ))}
          {templateFilter.length > 0 && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuCheckboxItem
                checked={false}
                onCheckedChange={() => onTemplateChange([])}
                className="text-red-600"
              >
                Clear all
              </DropdownMenuCheckboxItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Refresh Button */}
      <Button onClick={onRefresh} variant="outline" size="sm" disabled={isRefreshing}>
        <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
        Refresh
      </Button>

      {/* Clear History Button */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            onClick={onClearHistory}
            variant="outline"
            size="sm"
            disabled={isClearing || !hasJobs}
            className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
          >
            <Trash2 className={`mr-2 h-4 w-4 ${isClearing ? 'animate-spin' : ''}`} />
            {hasActiveFilters ? "Clear Filtered" : "Clear All"}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{hasActiveFilters ? `Clear jobs matching: ${filterDescription}` : "Clear all job history"}</p>
        </TooltipContent>
      </Tooltip>
    </div>
  )
}
