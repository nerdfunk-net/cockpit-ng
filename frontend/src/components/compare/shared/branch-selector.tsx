/**
 * Shared Branch Selector Component
 * Used across git-compare and file-history-compare pages
 */

import { useCallback } from 'react'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { Branch } from '@/types/git'

interface BranchSelectorProps {
  branches: Branch[]
  selectedBranch: string
  onSelectBranch: (branch: string) => void
  disabled?: boolean
  className?: string
}

export function BranchSelector({
  branches,
  selectedBranch,
  onSelectBranch,
  disabled = false,
  className = ''
}: BranchSelectorProps) {
  // Memoize the callback to prevent creating new function on every render
  const handleValueChange = useCallback((value: string) => {
    const newValue = value === '__none__' ? '' : value
    onSelectBranch(newValue)
  }, [onSelectBranch])

  return (
    <div className={`space-y-2 ${className}`}>
      <Label>Branch</Label>
      <Select
        value={selectedBranch || '__none__'}
        onValueChange={handleValueChange}
        disabled={disabled}
      >
        <SelectTrigger className="w-full border-2 bg-white border-gray-300 hover:border-gray-400 focus:border-blue-500">
          <SelectValue placeholder="Select branch" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">Select branch...</SelectItem>
          {branches.map((branch) => (
            <SelectItem key={branch.name} value={branch.name}>
              {branch.name}{branch.current ? ' (current)' : ''}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
