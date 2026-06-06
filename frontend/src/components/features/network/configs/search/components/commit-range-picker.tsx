'use client'

import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useGitCommits } from '@/components/features/shared/git/hooks/use-git-commits'
import { Loader2 } from 'lucide-react'

interface CommitRangePickerProps {
  repoId: number | null
  branch: string
  commit1: string | null
  commit2: string | null
  onCommit1Change: (commit: string | null) => void
  onCommit2Change: (commit: string | null) => void
}

export function CommitRangePicker({
  repoId,
  branch,
  commit1,
  commit2,
  onCommit1Change,
  onCommit2Change,
}: CommitRangePickerProps) {
  const { commits, loading, error } = useGitCommits(repoId, branch)

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading commits...
      </div>
    )
  }

  if (error) {
    return (
      <p className="text-sm text-destructive" role="alert">
        {error}
      </p>
    )
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="space-y-2">
        <Label htmlFor="commit1">Base commit (older)</Label>
        <Select
          value={commit1 ?? ''}
          onValueChange={value => onCommit1Change(value || null)}
        >
          <SelectTrigger id="commit1" aria-label="Select base commit">
            <SelectValue placeholder="Select base commit" />
          </SelectTrigger>
          <SelectContent>
            {commits.map(commit => (
              <SelectItem key={commit.hash} value={commit.hash}>
                {commit.short_hash} — {commit.message.slice(0, 60)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="commit2">Target commit (newer)</Label>
        <Select
          value={commit2 ?? ''}
          onValueChange={value => onCommit2Change(value || null)}
        >
          <SelectTrigger id="commit2" aria-label="Select target commit">
            <SelectValue placeholder="Select target commit" />
          </SelectTrigger>
          <SelectContent>
            {commits.map(commit => (
              <SelectItem key={commit.hash} value={commit.hash}>
                {commit.short_hash} — {commit.message.slice(0, 60)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
