'use client'

import { Filter, FolderOpen, HelpCircle, Save, Search, Server, Settings } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { IconChip } from '@/components/shared/icon-chip'
import { StatusAlert } from '@/components/shared/status-alert'
import {
  useServerSearchFacetsQuery,
  useServerSearchMutation,
} from '@/hooks/queries/use-server-search-query'
import {
  useSavedSearchesQuery,
  useSaveSearchMutation,
  useUpdateSearchMutation,
  useDeleteSearchMutation,
} from '@/hooks/queries/use-saved-searches-queries'
import { useToast } from '@/hooks/use-toast'
import { QueryBuilder } from './components/query-builder'
import { SearchResultsTable } from './components/search-results-table'
import { SearchHelpDialog } from './dialogs/search-help-dialog'
import { SaveSearchDialog } from './dialogs/save-search-dialog'
import { LoadSearchDialog } from './dialogs/load-search-dialog'
import { ManageSearchesDialog } from './dialogs/manage-searches-dialog'
import {
  createEmptyGroup,
  fromApiSearchGroup,
  toApiSearchGroup,
  type ApiSearchGroup,
  type SearchGroup,
  type ServerSearchHit,
} from './types'

interface LoadedSearch {
  id: number
  name: string
  description?: string
  scope: string
  group_path?: string | null
}

export function ServerSearchPage() {
  const { toast } = useToast()
  const [query, setQuery] = useState<SearchGroup>(() => createEmptyGroup())
  const [results, setResults] = useState<ServerSearchHit[] | null>(null)
  const [resultTotal, setResultTotal] = useState(0)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [helpOpen, setHelpOpen] = useState(false)
  const [saveDialogOpen, setSaveDialogOpen] = useState(false)
  const [loadDialogOpen, setLoadDialogOpen] = useState(false)
  const [manageDialogOpen, setManageDialogOpen] = useState(false)
  const [loadedSearch, setLoadedSearch] = useState<LoadedSearch | null>(null)

  const { data: facets, isLoading: facetsLoading } = useServerSearchFacetsQuery()
  const searchMutation = useServerSearchMutation()

  const { data: savedSearchesData, isLoading: savedSearchesLoading } =
    useSavedSearchesQuery()
  const savedSearches = savedSearchesData?.searches ?? []
  const saveSearchMutation = useSaveSearchMutation()
  const updateSearchMutation = useUpdateSearchMutation()
  const deleteSearchMutation = useDeleteSearchMutation()

  const handleSearch = async () => {
    setSearchError(null)
    try {
      const apiQuery = toApiSearchGroup(query)
      const data = await searchMutation.mutateAsync(apiQuery)
      setResults(data.servers)
      setResultTotal(data.total)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      setSearchError(message)
      toast({
        title: 'Search failed',
        description: message,
        variant: 'destructive',
      })
    }
  }

  const handleReset = () => {
    setQuery(createEmptyGroup())
    setResults(null)
    setResultTotal(0)
    setSearchError(null)
  }

  const handleSaveSearch = async (
    name: string,
    description: string,
    scope: string,
    isUpdate: boolean,
    existingId?: number,
    group_path?: string | null
  ): Promise<boolean> => {
    try {
      const apiQuery = toApiSearchGroup(query)
      if (isUpdate && existingId) {
        await updateSearchMutation.mutateAsync({
          id: existingId,
          data: { name, description, query: apiQuery, scope, group_path },
        })
        setLoadedSearch({ id: existingId, name, description, scope, group_path })
      } else {
        const created = await saveSearchMutation.mutateAsync({
          name,
          description,
          query: apiQuery,
          scope,
          group_path,
        })
        setLoadedSearch({
          id: created.id,
          name: created.name,
          description: created.description,
          scope: created.scope,
          group_path: created.group_path,
        })
      }
      return true
    } catch {
      return false
    }
  }

  const handleDirectSave = async () => {
    if (!loadedSearch) return
    await handleSaveSearch(
      loadedSearch.name,
      loadedSearch.description ?? '',
      loadedSearch.scope,
      true,
      loadedSearch.id,
      loadedSearch.group_path
    )
  }

  const handleLoadSearch = (id: number) => {
    const found = savedSearches.find(s => s.id === id)
    if (!found) return
    try {
      const uiQuery = fromApiSearchGroup(found.query as unknown as ApiSearchGroup)
      setQuery(uiQuery)
      setLoadedSearch({
        id: found.id,
        name: found.name,
        description: found.description,
        scope: found.scope,
        group_path: found.group_path,
      })
      setResults(null)
      setResultTotal(0)
      setSearchError(null)
      setLoadDialogOpen(false)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      toast({
        title: 'Failed to load search',
        description: message,
        variant: 'destructive',
      })
    }
  }

  const handleUpdateSearchDetails = async (
    id: number,
    name: string,
    description: string,
    scope: string,
    group_path?: string | null
  ) => {
    await updateSearchMutation.mutateAsync({
      id,
      data: { name, description, scope, group_path },
    })
    if (loadedSearch?.id === id) {
      setLoadedSearch({ id, name, description, scope, group_path })
    }
  }

  const handleDeleteSearch = async (id: number) => {
    await deleteSearchMutation.mutateAsync(id)
    if (loadedSearch?.id === id) {
      setLoadedSearch(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <IconChip variant="primary">
            <Search className="h-6 w-6" />
          </IconChip>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Server Search</h1>
            <p className="text-muted-foreground mt-2">
              Find servers by RAM, CPU, disks, OS, and virtualization with nested
              AND / OR / NOT rules.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => setHelpOpen(true)}
            title="Help"
            aria-label="Open search help"
          >
            <HelpCircle className="h-4 w-4" />
          </Button>
          <Button variant="outline" onClick={handleReset}>
            Reset
          </Button>
          <Button onClick={handleSearch} disabled={searchMutation.isPending}>
            {searchMutation.isPending ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-foreground mr-2" />
            ) : (
              <Search className="h-4 w-4 mr-2" />
            )}
            {searchMutation.isPending ? 'Searching...' : 'Search'}
          </Button>
        </div>
      </div>

      {searchError && (
        <StatusAlert variant="error" onDismiss={() => setSearchError(null)}>
          {searchError}
        </StatusAlert>
      )}

      {/* Query Builder Section */}
      <div className="shadow-lg border-0 p-0 bg-card rounded-lg">
        <div className="panel-header py-2 px-4 flex items-center justify-between rounded-t-lg">
          <div className="flex items-center space-x-2">
            <Filter className="h-4 w-4" />
            <span className="text-sm font-medium">Search Criteria</span>
            {loadedSearch && (
              <Badge variant="outline" className="text-xs font-normal">
                Loaded: {loadedSearch.name}
              </Badge>
            )}
          </div>
          <div className="text-xs text-panel-header-muted">
            Combine rules with AND / OR and optional NOT
          </div>
        </div>
        <div className="p-6 panel-content">
          {facetsLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
              <span className="ml-2 text-sm text-muted-foreground">
                Loading filter options...
              </span>
            </div>
          ) : (
            <div className="space-y-4">
              <QueryBuilder group={query} onChange={setQuery} facets={facets} />
              <div className="flex items-center gap-2">
                <Button
                  onClick={handleSearch}
                  disabled={searchMutation.isPending}
                >
                  {searchMutation.isPending ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-foreground mr-2" />
                  ) : (
                    <Search className="h-4 w-4 mr-2" />
                  )}
                  {searchMutation.isPending ? 'Searching...' : 'Search'}
                </Button>
                <Button variant="outline" onClick={handleReset}>
                  Reset
                </Button>
                <div className="ml-auto flex items-center gap-2">
                  <Button
                    variant="outline"
                    onClick={handleDirectSave}
                    disabled={!loadedSearch || updateSearchMutation.isPending}
                    title={
                      loadedSearch
                        ? 'Save changes to the loaded search'
                        : 'Load a search first to use Save'
                    }
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {updateSearchMutation.isPending ? 'Saving...' : 'Save'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setSaveDialogOpen(true)}
                    title="Save as a new search"
                  >
                    <Save className="h-4 w-4 mr-2" />
                    Save as
                  </Button>
                  <Button variant="outline" onClick={() => setLoadDialogOpen(true)}>
                    <FolderOpen className="h-4 w-4 mr-2" />
                    Load
                  </Button>
                  <Button variant="outline" onClick={() => setManageDialogOpen(true)}>
                    <Settings className="h-4 w-4 mr-2" />
                    Manage Searches
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Results Section */}
      <div className="shadow-lg border-0 p-0 bg-card rounded-lg">
        <div className="panel-header py-2 px-4 flex items-center justify-between rounded-t-lg">
          <div className="flex items-center space-x-2">
            <Server className="h-4 w-4" />
            <span className="text-sm font-medium">Results</span>
          </div>
          {results !== null && (
            <div className="text-xs text-panel-header-muted">
              {resultTotal} server{resultTotal === 1 ? '' : 's'} matched
            </div>
          )}
        </div>
        <div className="p-6 panel-content">
          {searchMutation.isPending ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
              <span className="ml-2 text-sm text-muted-foreground">
                Searching servers...
              </span>
            </div>
          ) : results === null ? (
            <StatusAlert variant="info">
              Build a query above and click <strong>Search</strong> to list matching
              servers.
            </StatusAlert>
          ) : (
            <SearchResultsTable servers={results} />
          )}
        </div>
      </div>

      <SearchHelpDialog open={helpOpen} onOpenChange={setHelpOpen} />

      <SaveSearchDialog
        isOpen={saveDialogOpen}
        onClose={() => setSaveDialogOpen(false)}
        onSave={handleSaveSearch}
        isSaving={saveSearchMutation.isPending || updateSearchMutation.isPending}
        savedSearches={savedSearches}
        currentQuery={query}
        initialName={loadedSearch?.name}
        initialDescription={loadedSearch?.description}
        initialGroupPath={loadedSearch?.group_path}
      />

      <LoadSearchDialog
        isOpen={loadDialogOpen}
        onClose={() => setLoadDialogOpen(false)}
        savedSearches={savedSearches}
        isLoading={savedSearchesLoading}
        onLoad={handleLoadSearch}
      />

      <ManageSearchesDialog
        isOpen={manageDialogOpen}
        onClose={() => setManageDialogOpen(false)}
        savedSearches={savedSearches}
        isLoading={savedSearchesLoading}
        onUpdate={handleUpdateSearchDetails}
        onDelete={handleDeleteSearch}
      />
    </div>
  )
}
