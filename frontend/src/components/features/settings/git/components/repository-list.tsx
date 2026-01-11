// Repository List Component with Cards

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { RefreshCw, GitBranch, Github } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { RepositoryCard } from './repository-card'
import type { GitRepository } from '../types'

interface RepositoryListProps {
  repositories: GitRepository[]
  isLoading: boolean
  onRefresh: () => void
  onEdit: (repo: GitRepository) => void
  onSync: (repo: GitRepository) => void
  onRemoveAndSync: (repo: GitRepository) => void
  onViewStatus: (repo: GitRepository) => void
  onDebug: (repo: GitRepository) => void
  onDelete: (repo: GitRepository) => void
}

export function RepositoryList({
  repositories,
  isLoading,
  onRefresh,
  onEdit,
  onSync,
  onRemoveAndSync,
  onViewStatus,
  onDebug,
  onDelete,
}: RepositoryListProps) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 pl-8 pr-8 -mx-6 -mt-6 mb-1">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-white text-sm font-semibold">
            <GitBranch className="h-4 w-4" />
            Managed Repositories ({repositories.length})
          </CardTitle>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={onRefresh}
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs text-white hover:bg-white/20 shrink-0"
                >
                  <RefreshCw className="h-3 w-3 mr-1" />
                  Refresh
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Reload repository list</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-8">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto text-gray-400" />
            <p className="text-gray-500 mt-2">Loading repositories...</p>
          </div>
        ) : repositories.length === 0 ? (
          <div className="text-center py-8">
            <Github className="h-12 w-12 mx-auto text-gray-400" />
            <p className="text-gray-500 mt-2">No repositories found</p>
            <p className="text-sm text-gray-400">Add a repository to get started</p>
          </div>
        ) : (
          <div className="space-y-4">
            {repositories.map((repo) => (
              <RepositoryCard
                key={repo.id}
                repository={repo}
                onEdit={onEdit}
                onSync={onSync}
                onRemoveAndSync={onRemoveAndSync}
                onViewStatus={onViewStatus}
                onDebug={onDebug}
                onDelete={onDelete}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
