'use client'

import { Search, Filter } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertTriangle } from 'lucide-react'
import { RepositorySelector } from './repository-selector'
import { CommitRangePicker } from './commit-range-picker'
import type { GitRepository } from '@/hooks/queries/use-git-repositories-query'
import type { SearchCriteria } from '../types'

const SEARCH_INPUT_CLASS =
  'border-2 border-slate-300 bg-white text-foreground shadow-sm placeholder:text-slate-500 focus-visible:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-200'

interface SearchCriteriaFormProps {
  repositories: GitRepository[]
  selectedRepositoryId: number | null
  selectedBranch: string
  criteria: SearchCriteria
  isLoadingRepos: boolean
  isSearching: boolean
  onRepositoryChange: (repoId: number | null) => void
  onCriteriaChange: (updates: Partial<SearchCriteria>) => void
  onSearch: () => void
}

export function SearchCriteriaForm({
  repositories,
  selectedRepositoryId,
  selectedBranch,
  criteria,
  isLoadingRepos,
  isSearching,
  onRepositoryChange,
  onCriteriaChange,
  onSearch,
}: SearchCriteriaFormProps) {
  const canSearch =
    !!selectedRepositoryId &&
    criteria.query.trim().length >= 2 &&
    (!criteria.diffMode || (!!criteria.commit1 && !!criteria.commit2))

  const showSlowSearchWarning = criteria.includeHistory || criteria.diffMode

  return (
    <div className="shadow-lg border-0 p-0 bg-white rounded-lg">
      <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4 flex items-center justify-between rounded-t-lg">
        <div className="flex items-center space-x-2">
          <Search className="h-4 w-4" />
          <span className="text-sm font-medium">Search Criteria</span>
        </div>
        <div className="text-xs text-blue-100">Search inside config file contents</div>
      </div>

      <div className="p-6 bg-gradient-to-b from-white to-gray-50 space-y-4">
        <RepositorySelector
          repositories={repositories}
          selectedRepositoryId={selectedRepositoryId}
          onRepositoryChange={onRepositoryChange}
          isLoading={isLoadingRepos}
        />

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="search-query">Search string</Label>
            <Input
              id="search-query"
              className={SEARCH_INPUT_CLASS}
              placeholder="e.g. snmp-server community"
              value={criteria.query}
              onChange={event => onCriteriaChange({ query: event.target.value })}
              onKeyDown={event => {
                if (event.key === 'Enter' && canSearch) {
                  onSearch()
                }
              }}
            />
            <p className="text-xs text-muted-foreground">Minimum 2 characters</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="path-filter">File path filter (optional)</Label>
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="path-filter"
                className={`pl-9 ${SEARCH_INPUT_CLASS}`}
                placeholder="e.g. site-a/* or *.cfg"
                value={criteria.pathFilter}
                onChange={event => onCriteriaChange({ pathFilter: event.target.value })}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Glob or path prefix to limit which files are searched
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center space-x-3 p-4 bg-gradient-to-r from-slate-50 to-slate-100 border border-slate-200 rounded-lg shadow-sm">
            <Switch
              id="include-history"
              checked={criteria.includeHistory}
              disabled={criteria.diffMode}
              onCheckedChange={checked =>
                onCriteriaChange({ includeHistory: checked, diffMode: false })
              }
            />
            <div className="flex-1">
              <Label htmlFor="include-history" className="text-sm font-medium cursor-pointer">
                Include historical versions
              </Label>
              <p className="text-xs text-gray-600 mt-0.5">
                Search older commits for each file (slower; off by default)
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3 p-4 bg-gradient-to-r from-slate-50 to-slate-100 border border-slate-200 rounded-lg shadow-sm">
            <Switch
              id="diff-mode"
              checked={criteria.diffMode}
              disabled={criteria.includeHistory}
              onCheckedChange={checked =>
                onCriteriaChange({
                  diffMode: checked,
                  includeHistory: false,
                  commit1: checked ? criteria.commit1 : null,
                  commit2: checked ? criteria.commit2 : null,
                })
              }
            />
            <div className="flex-1">
              <Label htmlFor="diff-mode" className="text-sm font-medium cursor-pointer">
                Search in diff only
              </Label>
              <p className="text-xs text-gray-600 mt-0.5">
                Find matches only in lines changed between two commits
              </p>
            </div>
          </div>
        </div>

        {criteria.diffMode && selectedRepositoryId && (
          <CommitRangePicker
            repoId={selectedRepositoryId}
            branch={selectedBranch}
            commit1={criteria.commit1}
            commit2={criteria.commit2}
            onCommit1Change={commit => onCriteriaChange({ commit1: commit })}
            onCommit2Change={commit => onCriteriaChange({ commit2: commit })}
          />
        )}

        {showSlowSearchWarning && (
          <Alert className="bg-amber-50 border-amber-200">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-800">
              Historical and diff searches scan more data and may return truncated results.
            </AlertDescription>
          </Alert>
        )}

        <div className="flex items-center gap-2 pt-2">
          <Button onClick={onSearch} disabled={!canSearch || isSearching}>
            {isSearching && (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
            )}
            {isSearching ? 'Searching...' : 'Search'}
          </Button>
        </div>
      </div>
    </div>
  )
}
