'use client'

import { useState, useMemo } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Loader2, FileText, ChevronDown, ChevronRight } from 'lucide-react'
import { GroupTreePanel } from '@/components/shared/device-selector-components/group-tree-panel'
import { generateSearchGroupAscii } from '../utils/search-group-ascii'
import { fromApiSearchGroup, type ApiSearchGroup } from '../types'

interface SavedSearchItem {
  id: number
  name: string
  description?: string
  query: Record<string, unknown>
  scope: string
  group_path?: string | null
  created_by: string
}

interface LoadSearchDialogProps {
  isOpen: boolean
  onClose: () => void
  savedSearches: SavedSearchItem[]
  isLoading: boolean
  onLoad: (id: number) => void
}

export function LoadSearchDialog({
  isOpen,
  onClose,
  savedSearches,
  isLoading,
  onLoad,
}: LoadSearchDialogProps) {
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null)
  const [selectedSearchId, setSelectedSearchId] = useState<number | null>(null)
  const [showTree, setShowTree] = useState(false)

  const searchesInGroup = useMemo(
    () =>
      savedSearches.filter(s => (s.group_path ?? '') === (selectedGroup ?? '')),
    [savedSearches, selectedGroup]
  )

  const selectedSearch = useMemo(
    () => savedSearches.find(s => s.id === selectedSearchId) ?? null,
    [savedSearches, selectedSearchId]
  )

  const treeAscii = useMemo(() => {
    if (!selectedSearch) return ''
    try {
      return generateSearchGroupAscii(
        fromApiSearchGroup(selectedSearch.query as unknown as ApiSearchGroup)
      )
    } catch {
      return ''
    }
  }, [selectedSearch])

  const handleLoad = () => {
    if (selectedSearchId !== null) {
      onLoad(selectedSearchId)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-5xl sm:max-w-5xl max-h-[88vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <DialogTitle>Load Saved Search</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            <span className="ml-2 text-sm text-muted-foreground">
              Loading searches...
            </span>
          </div>
        ) : savedSearches.length === 0 ? (
          <div className="flex-1 flex items-center justify-center py-16">
            <p className="text-muted-foreground text-sm">No saved searches found.</p>
          </div>
        ) : (
          <>
            {/* Main area: group tree (left) + files (right) */}
            <div
              className="flex flex-1 min-h-0"
              style={{ minHeight: '280px', maxHeight: '360px' }}
            >
              {/* Left: Group tree */}
              <div className="w-56 flex-shrink-0 border-r p-3 overflow-y-auto">
                <GroupTreePanel
                  inventories={savedSearches}
                  selectedGroup={selectedGroup}
                  onSelectGroup={group => {
                    setSelectedGroup(group)
                    setSelectedSearchId(null)
                    setShowTree(false)
                  }}
                />
              </div>

              {/* Right: saved searches */}
              <div className="flex-1 overflow-y-auto p-3">
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  Searches in{' '}
                  <span className="text-blue-600">{selectedGroup ?? 'Root'}</span>
                </div>
                {searchesInGroup.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    No searches in this group
                  </p>
                ) : (
                  <div className="space-y-1">
                    {searchesInGroup.map(s => {
                      const isSelected = selectedSearchId === s.id
                      return (
                        <div
                          key={s.id}
                          className={`flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer text-sm transition-colors ${
                            isSelected
                              ? 'bg-blue-100 text-blue-800 border border-blue-200'
                              : 'hover:bg-gray-50 border border-transparent'
                          }`}
                          onClick={() => {
                            setSelectedSearchId(s.id)
                            setShowTree(false)
                          }}
                          onDoubleClick={() => {
                            setSelectedSearchId(s.id)
                            onLoad(s.id)
                          }}
                        >
                          <FileText
                            className={`h-4 w-4 flex-shrink-0 ${isSelected ? 'text-blue-500' : 'text-gray-400'}`}
                          />
                          <span className="flex-1 truncate font-medium">{s.name}</span>
                          <Badge variant="secondary" className="text-xs flex-shrink-0">
                            {s.scope}
                          </Badge>
                          <span className="text-xs text-gray-400 flex-shrink-0">
                            {s.created_by}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* General panel — fixed height per state so clicking a search never shifts the layout */}
            <div
              className="border-t p-4 space-y-2 overflow-y-auto flex-shrink-0"
              style={{ height: showTree ? '260px' : '110px' }}
            >
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                General
              </div>
              {selectedSearch ? (
                <>
                  {selectedSearch.description ? (
                    <p className="text-sm text-gray-700">{selectedSearch.description}</p>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">
                      No description
                    </p>
                  )}
                  <button
                    type="button"
                    className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium"
                    onClick={() => setShowTree(v => !v)}
                  >
                    {showTree ? (
                      <ChevronDown className="h-3.5 w-3.5" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5" />
                    )}
                    {showTree ? 'Hide' : 'Show'} query tree
                  </button>
                  {showTree && (
                    <div className="bg-slate-900 text-slate-50 p-3 rounded-md overflow-x-auto font-mono text-xs whitespace-pre max-h-40 overflow-y-auto">
                      {treeAscii}
                    </div>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground italic">
                  Select a search to see its details
                </p>
              )}
            </div>
          </>
        )}

        <DialogFooter className="px-6 py-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleLoad} disabled={selectedSearchId === null || isLoading}>
            Load
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
