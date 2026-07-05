'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, Search } from 'lucide-react'
import { IconChip } from '@/components/shared/icon-chip'
import { useGitRepositoriesQuery } from '@/hooks/queries/use-git-repositories-query'
import { useConfigContentSearchMutation } from '@/hooks/queries/use-config-content-search-query'
import { SearchCriteriaForm } from './components/search-criteria-form'
import { SearchResultsTable } from './components/search-results-table'
import { MatchPreviewDialog } from './dialogs/match-preview-dialog'
import type {
  ConfigContentSearchMatch,
  PreviewMatch,
  SearchCriteria,
} from './types'

const DEVICE_CONFIGS_CATEGORY = 'device_configs'

const DEFAULT_CRITERIA: SearchCriteria = {
  query: '',
  pathFilter: '',
  includeHistory: false,
  diffMode: false,
  commit1: null,
  commit2: null,
  caseSensitive: false,
}

export default function ConfigsSearchPage() {
  const { data: reposData, isLoading: isLoadingRepos } = useGitRepositoriesQuery()
  const { search, data, isSearching, reset } = useConfigContentSearchMutation()

  const [selectedRepositoryId, setSelectedRepositoryId] = useState<number | null>(null)
  const [criteria, setCriteria] = useState<SearchCriteria>(DEFAULT_CRITERIA)
  const [hasSearched, setHasSearched] = useState(false)
  const [preview, setPreview] = useState<PreviewMatch | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)

  const repositories = useMemo(
    () =>
      (reposData?.repositories ?? []).filter(
        repo => repo.category === DEVICE_CONFIGS_CATEGORY
      ),
    [reposData?.repositories]
  )

  const selectedRepository = useMemo(
    () => repositories.find(repo => repo.id === selectedRepositoryId) ?? null,
    [repositories, selectedRepositoryId]
  )

  useEffect(() => {
    if (repositories.length > 0 && selectedRepositoryId === null && repositories[0]) {
      setSelectedRepositoryId(repositories[0].id)
    }
  }, [repositories, selectedRepositoryId])

  const handleRepositoryChange = useCallback(
    (repoId: number | null) => {
      setSelectedRepositoryId(repoId)
      reset()
      setHasSearched(false)
      setCriteria(DEFAULT_CRITERIA)
    },
    [reset]
  )

  const handleCriteriaChange = useCallback((updates: Partial<SearchCriteria>) => {
    setCriteria(prev => ({ ...prev, ...updates }))
  }, [])

  const handleSearch = useCallback(() => {
    if (!selectedRepositoryId || criteria.query.trim().length < 2) {
      return
    }

    setHasSearched(true)
    search({
      repoId: selectedRepositoryId,
      request: {
        query: criteria.query.trim(),
        path_filter: criteria.pathFilter.trim() || undefined,
        include_history: criteria.includeHistory,
        diff_mode: criteria.diffMode,
        commit1: criteria.diffMode ? criteria.commit1 : undefined,
        commit2: criteria.diffMode ? criteria.commit2 : undefined,
        case_sensitive: criteria.caseSensitive,
        limit: 100,
        offset: 0,
      },
    })
  }, [criteria, search, selectedRepositoryId])

  const handlePreview = useCallback(
    (match: ConfigContentSearchMatch) => {
      setPreview({ match, query: criteria.query.trim() })
      setPreviewOpen(true)
    },
    [criteria.query]
  )

  if (isLoadingRepos && repositories.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <IconChip variant="primary">
              <Search className="h-6 w-6" />
            </IconChip>
            <div>
              <h1 className="text-3xl font-bold text-foreground">Config Search</h1>
              <p className="text-muted-foreground mt-2">
                Search for strings inside device configuration backups
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <IconChip variant="primary">
            <Search className="h-6 w-6" />
          </IconChip>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Config Search</h1>
            <p className="text-muted-foreground mt-2">
              Search for strings inside device configuration backups
            </p>
          </div>
        </div>
      </div>

      <SearchCriteriaForm
        repositories={repositories}
        selectedRepositoryId={selectedRepositoryId}
        selectedBranch={selectedRepository?.branch ?? 'main'}
        criteria={criteria}
        isLoadingRepos={isLoadingRepos}
        isSearching={isSearching}
        onRepositoryChange={handleRepositoryChange}
        onCriteriaChange={handleCriteriaChange}
        onSearch={handleSearch}
      />

      <SearchResultsTable
        data={data?.data ?? null}
        isSearching={isSearching}
        hasSearched={hasSearched}
        repository={selectedRepository}
        diffCommit1={criteria.diffMode ? criteria.commit1 : null}
        diffCommit2={criteria.diffMode ? criteria.commit2 : null}
        onPreview={handlePreview}
      />

      <MatchPreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        repoId={selectedRepositoryId}
        preview={preview}
      />
    </div>
  )
}
