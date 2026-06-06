'use client'

import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { GitRepository } from '@/hooks/queries/use-git-repositories-query'

interface RepositorySelectorProps {
  repositories: GitRepository[]
  selectedRepositoryId: number | null
  onRepositoryChange: (repoId: number | null) => void
  isLoading?: boolean
}

export function RepositorySelector({
  repositories,
  selectedRepositoryId,
  onRepositoryChange,
  isLoading = false,
}: RepositorySelectorProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor="config-search-repo">Git repository</Label>
      <Select
        value={selectedRepositoryId?.toString() ?? ''}
        onValueChange={value => {
          onRepositoryChange(value ? parseInt(value, 10) : null)
        }}
        disabled={isLoading || repositories.length === 0}
      >
        <SelectTrigger id="config-search-repo" aria-label="Select git repository">
          <SelectValue
            placeholder={
              isLoading
                ? 'Loading repositories...'
                : repositories.length === 0
                  ? 'No device config repositories found'
                  : 'Select a repository'
            }
          />
        </SelectTrigger>
        <SelectContent>
          {repositories.map(repo => (
            <SelectItem key={repo.id} value={repo.id.toString()}>
              {repo.name}
              {repo.description ? ` — ${repo.description}` : ''}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground">
        Device config backups are stored in git repositories with category device_configs.
      </p>
    </div>
  )
}
