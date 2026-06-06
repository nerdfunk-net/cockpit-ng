'use client'

import { Eye, ExternalLink, FileText } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { GitRepository } from '@/hooks/queries/use-git-repositories-query'
import { buildGitFileWebUrl } from '../utils/build-git-file-web-url'
import type { ConfigContentSearchData, ConfigContentSearchMatch } from '../types'

interface SearchResultsTableProps {
  data: ConfigContentSearchData | null
  isSearching: boolean
  hasSearched: boolean
  repository: Pick<GitRepository, 'url' | 'branch' | 'path'> | null
  diffCommit1?: string | null
  diffCommit2?: string | null
  onPreview: (match: ConfigContentSearchMatch) => void
}

function sourceBadgeClass(source: ConfigContentSearchMatch['match_source']): string {
  switch (source) {
    case 'history':
      return 'bg-purple-100 text-purple-800 border-purple-300'
    case 'diff':
      return 'bg-amber-100 text-amber-800 border-amber-300'
    default:
      return 'bg-blue-100 text-blue-800 border-blue-300'
  }
}

export function SearchResultsTable({
  data,
  isSearching,
  hasSearched,
  repository,
  diffCommit1 = null,
  diffCommit2 = null,
  onPreview,
}: SearchResultsTableProps) {
  return (
    <div className="shadow-lg border-0 p-0 bg-white rounded-lg">
      <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4 flex items-center justify-between rounded-t-lg">
        <div className="flex items-center space-x-2">
          <FileText className="h-4 w-4" />
          <span className="text-sm font-medium">Search Results</span>
        </div>
        {data && (
          <div className="text-xs text-blue-100">
            {data.total_matches} match{data.total_matches !== 1 ? 'es' : ''} in{' '}
            {data.files_scanned} file{data.files_scanned !== 1 ? 's' : ''}
            {data.truncated ? ' (truncated)' : ''}
          </div>
        )}
      </div>

      <div className="p-6 bg-gradient-to-b from-white to-gray-50">
        {isSearching && (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500" />
            <span className="ml-2 text-sm text-gray-600">Searching config files...</span>
          </div>
        )}

        {!isSearching && !hasSearched && (
          <div className="text-center py-12 text-gray-500">
            <p className="text-lg font-medium">No search performed yet</p>
            <p className="text-sm mt-1">
              Select a repository, enter a search string, and click Search
            </p>
          </div>
        )}

        {!isSearching && hasSearched && data && data.matches.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <p className="text-lg font-medium">No matches found</p>
            <p className="text-sm mt-1">Try a different search string or adjust your filters</p>
          </div>
        )}

        {!isSearching && data && data.matches.length > 0 && (
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>File</TableHead>
                  <TableHead className="w-16">Line</TableHead>
                  <TableHead>Match</TableHead>
                  <TableHead>Commit</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead className="w-28">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.matches.map(match => {
                  const gitWebUrl = repository
                    ? buildGitFileWebUrl({ repository, match, diffCommit1, diffCommit2 })
                    : null
                  const rowKey = [
                    match.file_path,
                    match.line_number,
                    match.commit ?? 'head',
                    match.match_source,
                    match.change_type ?? '',
                    match.line_content,
                  ].join('|')

                  return (
                  <TableRow key={rowKey}>
                    <TableCell className="font-mono text-xs max-w-[200px] truncate">
                      {match.file_path}
                    </TableCell>
                    <TableCell>{match.line_number}</TableCell>
                    <TableCell className="font-mono text-xs max-w-[320px] truncate">
                      {match.line_content}
                    </TableCell>
                    <TableCell className="text-xs">
                      {match.commit ?? 'HEAD'}
                      {match.change_type && (
                        <Badge variant="outline" className="ml-2 text-xs">
                          {match.change_type}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge className={sourceBadgeClass(match.match_source)}>
                        {match.match_source}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onPreview(match)}
                          aria-label={`Preview match in ${match.file_path}`}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {gitWebUrl && (
                          <Button
                            variant="ghost"
                            size="sm"
                            asChild
                            aria-label={`Open ${match.file_path} on git website`}
                          >
                            <a
                              href={gitWebUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  )
}
