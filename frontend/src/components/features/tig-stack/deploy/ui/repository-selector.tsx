import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import type { GitRepository } from '../types'

interface RepositorySelectorProps {
  repositories: GitRepository[]
  selectedRepoId: number | null
  onChange: (repoId: number) => void
  loading?: boolean
}

export function RepositorySelector({
  repositories,
  selectedRepoId,
  onChange,
  loading = false
}: RepositorySelectorProps) {
  if (loading) {
    return <Skeleton className="h-10 w-full" />
  }

  return (
    <div className="space-y-2">
      <Label htmlFor="repository">Repository</Label>
      <Select
        value={selectedRepoId?.toString() || ''}
        onValueChange={(value) => onChange(Number(value))}
      >
        <SelectTrigger id="repository">
          <SelectValue placeholder="Select a repository" />
        </SelectTrigger>
        <SelectContent>
          {repositories.map((repo) => (
            <SelectItem key={repo.id} value={repo.id.toString()}>
              {repo.name} ({repo.branch})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
