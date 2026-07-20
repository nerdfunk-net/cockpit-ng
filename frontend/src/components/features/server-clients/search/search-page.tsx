'use client'

import { Filter, HelpCircle, Search, Server } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { IconChip } from '@/components/shared/icon-chip'
import { StatusAlert } from '@/components/shared/status-alert'
import {
  useServerSearchFacetsQuery,
  useServerSearchMutation,
} from '@/hooks/queries/use-server-search-query'
import { useToast } from '@/hooks/use-toast'
import { QueryBuilder } from './components/query-builder'
import { SearchResultsTable } from './components/search-results-table'
import { SearchHelpDialog } from './dialogs/search-help-dialog'
import {
  createEmptyGroup,
  toApiSearchGroup,
  type SearchGroup,
  type ServerSearchHit,
} from './types'

export function ServerSearchPage() {
  const { toast } = useToast()
  const [query, setQuery] = useState<SearchGroup>(() => createEmptyGroup())
  const [results, setResults] = useState<ServerSearchHit[] | null>(null)
  const [resultTotal, setResultTotal] = useState(0)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [helpOpen, setHelpOpen] = useState(false)

  const { data: facets, isLoading: facetsLoading } = useServerSearchFacetsQuery()
  const searchMutation = useServerSearchMutation()

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
    </div>
  )
}
