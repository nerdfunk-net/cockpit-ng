'use client'

import { useState, useMemo } from 'react'
import { Eye, ExternalLink, FileText, SlidersHorizontal } from 'lucide-react'
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
  type VisibilityState,
  type ColumnSizingState,
} from '@tanstack/react-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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

const COLUMN_LABELS: Record<string, string> = {
  file_path: 'File',
  line_content: 'Match',
  commit: 'Commit',
  match_source: 'Source',
}

const EMPTY_MATCHES: ConfigContentSearchMatch[] = []

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
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({})

  const columns = useMemo<ColumnDef<ConfigContentSearchMatch>[]>(
    () => [
      {
        id: 'file_path',
        accessorKey: 'file_path',
        header: 'File',
        size: 220,
        minSize: 80,
        cell: ({ row }) => (
          <span className="font-mono text-xs block truncate" title={row.original.file_path}>
            {row.original.file_path}
          </span>
        ),
      },
      {
        id: 'line_number',
        accessorKey: 'line_number',
        header: 'Line',
        size: 60,
        minSize: 50,
        enableHiding: false,
        cell: ({ row }) => row.original.line_number,
      },
      {
        id: 'line_content',
        accessorKey: 'line_content',
        header: 'Match',
        size: 340,
        minSize: 100,
        cell: ({ row }) => (
          <span className="font-mono text-xs block truncate" title={row.original.line_content}>
            {row.original.line_content}
          </span>
        ),
      },
      {
        id: 'commit',
        accessorKey: 'commit',
        header: 'Commit',
        size: 160,
        minSize: 80,
        cell: ({ row }) => (
          <span className="text-xs">
            {row.original.commit ?? 'HEAD'}
            {row.original.change_type && (
              <Badge variant="outline" className="ml-2 text-xs">
                {row.original.change_type}
              </Badge>
            )}
          </span>
        ),
      },
      {
        id: 'match_source',
        accessorKey: 'match_source',
        header: 'Source',
        size: 100,
        minSize: 80,
        cell: ({ row }) => (
          <Badge className={sourceBadgeClass(row.original.match_source)}>
            {row.original.match_source}
          </Badge>
        ),
      },
      {
        id: 'actions',
        header: 'Actions',
        size: 112,
        minSize: 80,
        enableHiding: false,
        enableResizing: false,
        cell: ({ row }) => {
          const match = row.original
          const gitWebUrl = repository
            ? buildGitFileWebUrl({ repository, match, diffCommit1, diffCommit2 })
            : null
          return (
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
                  <a href={gitWebUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
              )}
            </div>
          )
        },
      },
    ],
    [repository, diffCommit1, diffCommit2, onPreview],
  )

  const matches = data?.matches ?? EMPTY_MATCHES

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: matches,
    columns,
    getCoreRowModel: getCoreRowModel(),
    columnResizeMode: 'onChange',
    state: { columnVisibility, columnSizing },
    onColumnVisibilityChange: setColumnVisibility,
    onColumnSizingChange: setColumnSizing,
  })

  return (
    <div className="shadow-lg border-0 p-0 bg-white rounded-lg">
      <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4 flex items-center justify-between rounded-t-lg">
        <div className="flex items-center space-x-2">
          <FileText className="h-4 w-4" />
          <span className="text-sm font-medium">Search Results</span>
        </div>
        <div className="flex items-center gap-2">
          {data && (
            <div className="text-xs text-blue-100">
              {data.total_matches} match{data.total_matches !== 1 ? 'es' : ''} in{' '}
              {data.files_scanned} file{data.files_scanned !== 1 ? 's' : ''}
              {data.truncated ? ' (truncated)' : ''}
            </div>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-white hover:bg-white/20 hover:text-white"
                aria-label="Toggle columns"
              >
                <SlidersHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Columns</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {table
                .getAllColumns()
                .filter(col => col.getCanHide())
                .map(col => (
                  <DropdownMenuCheckboxItem
                    key={col.id}
                    checked={col.getIsVisible()}
                    onCheckedChange={value => col.toggleVisibility(!!value)}
                  >
                    {COLUMN_LABELS[col.id] ?? col.id}
                  </DropdownMenuCheckboxItem>
                ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
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
            <table
              style={{ width: table.getCenterTotalSize(), tableLayout: 'fixed' }}
              className="caption-bottom text-sm"
            >
              <thead className="[&_tr]:border-b">
                {table.getHeaderGroups().map(headerGroup => (
                  <tr key={headerGroup.id} className="border-b transition-colors hover:bg-muted/50">
                    {headerGroup.headers.map(header => (
                      <th
                        key={header.id}
                        style={{ width: header.getSize() }}
                        className="relative select-none h-10 px-2 text-left align-middle font-medium text-muted-foreground overflow-hidden"
                      >
                        {header.isPlaceholder
                          ? null
                          : flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getCanResize() && (
                          <div
                            onMouseDown={header.getResizeHandler()}
                            onTouchStart={header.getResizeHandler()}
                            className={`absolute right-0 top-0 h-full w-1 cursor-col-resize transition-colors ${
                              header.column.getIsResizing()
                                ? 'bg-blue-500'
                                : 'bg-transparent hover:bg-blue-400'
                            }`}
                          />
                        )}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody className="[&_tr:last-child]:border-0">
                {table.getRowModel().rows.map(row => (
                  <tr key={row.id} className="border-b transition-colors hover:bg-muted/50">
                    {row.getVisibleCells().map(cell => (
                      <td
                        key={cell.id}
                        style={{ width: cell.column.getSize() }}
                        className="p-2 align-middle overflow-hidden"
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
