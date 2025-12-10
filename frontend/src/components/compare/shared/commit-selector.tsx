/**
 * Shared Commit Selector Component
 * Used in git-compare and file-history-compare pages
 */

import { useCallback } from 'react'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { Commit } from '@/types/git'

interface CommitSelectorProps {
  commits: Commit[]
  selectedCommit: string
  onSelectCommit: (commit: string) => void
  label?: string
  placeholder?: string
  disabled?: boolean
  className?: string
}

export function CommitSelector({
  commits,
  selectedCommit,
  onSelectCommit,
  label = 'Commit',
  placeholder = 'Select commit',
  disabled = false,
  className = ''
}: CommitSelectorProps) {
  // Memoize the callback to prevent creating new function on every render
  const handleValueChange = useCallback((value: string) => {
    onSelectCommit(value === '__none__' ? '' : value)
  }, [onSelectCommit])

  return (
    <div className={`space-y-2 ${className}`}>
      <Label>{label}</Label>
      <Select
        value={selectedCommit || '__none__'}
        onValueChange={handleValueChange}
        disabled={disabled}
      >
        <SelectTrigger className="w-full border-2 bg-white border-gray-300 hover:border-gray-400 focus:border-blue-500">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">{placeholder}...</SelectItem>
          {commits.map((commit) => (
            <SelectItem key={commit.hash} value={commit.hash}>
              {commit.short_hash} - {commit.message.substring(0, 50)}
              {commit.message.length > 50 ? '...' : ''}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
