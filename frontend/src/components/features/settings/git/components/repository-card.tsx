// Individual Repository Card Component

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  Edit,
  Download,
  RotateCcw,
  Eye,
  Bug,
  Trash2,
  ExternalLink,
  GitBranch,
  Clock,
} from 'lucide-react'
import { getCategoryBadgeColor, getStatusBadgeColor, formatDate, truncateUrl } from '../utils'
import type { GitRepository } from '../types'

interface RepositoryCardProps {
  repository: GitRepository
  onEdit: (repo: GitRepository) => void
  onSync: (repo: GitRepository) => void
  onRemoveAndSync: (repo: GitRepository) => void
  onViewStatus: (repo: GitRepository) => void
  onDebug: (repo: GitRepository) => void
  onDelete: (repo: GitRepository) => void
}

export function RepositoryCard({
  repository,
  onEdit,
  onSync,
  onRemoveAndSync,
  onViewStatus,
  onDebug,
  onDelete,
}: RepositoryCardProps) {
  return (
    <div className="border rounded-lg p-4 hover:bg-gray-50">
      <div className="flex items-start justify-between">
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-3">
            <h3 className="font-medium text-gray-900">{repository.name}</h3>
            <Badge className={getCategoryBadgeColor(repository.category)}>
              {repository.category}
            </Badge>
            <Badge className={getStatusBadgeColor(repository.is_active)}>
              {repository.is_active ? 'Active' : 'Inactive'}
            </Badge>
          </div>
          <div className="flex items-center gap-4 text-sm text-gray-600">
            <div className="flex items-center gap-1">
              <ExternalLink className="h-4 w-4" />
              <a
                href={repository.url}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-blue-600 underline"
              >
                {truncateUrl(repository.url)}
              </a>
            </div>
            <div className="flex items-center gap-1">
              <GitBranch className="h-4 w-4" />
              {repository.branch}
            </div>
            <div className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              Last sync: {formatDate(repository.last_sync)}
            </div>
          </div>
          {repository.description && (
            <p className="text-sm text-gray-600">{repository.description}</p>
          )}
        </div>
        <TooltipProvider>
          <div className="flex items-center gap-2 ml-4">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button onClick={() => onEdit(repository)} variant="outline" size="sm">
                  <Edit className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Edit repository settings</p>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button onClick={() => onSync(repository)} variant="outline" size="sm">
                  <Download className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Sync repository (pull latest changes)</p>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={() => onRemoveAndSync(repository)}
                  variant="outline"
                  size="sm"
                  className="text-orange-600 hover:text-orange-700"
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Remove and re-clone repository</p>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button onClick={() => onViewStatus(repository)} variant="outline" size="sm">
                  <Eye className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>View repository status and details</p>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={() => onDebug(repository)}
                  variant="outline"
                  size="sm"
                  className="text-purple-600 hover:text-purple-700"
                >
                  <Bug className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Debug repository (read/write/delete tests)</p>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={() => onDelete(repository)}
                  variant="outline"
                  size="sm"
                  className="text-red-600 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Delete repository</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </TooltipProvider>
      </div>
    </div>
  )
}
