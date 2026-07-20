'use client'

import { useState, useEffect, useMemo } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { AlertCircle, FileText, ChevronDown, ChevronRight } from 'lucide-react'
import { GroupTreePanel } from '@/components/shared/device-selector-components/group-tree-panel'
import { generateSearchGroupAscii } from '../utils/search-group-ascii'
import type { SearchGroup } from '../types'

interface SavedSearchSummary {
  id: number
  name: string
  scope: string
  group_path?: string | null
}

interface SaveSearchDialogProps {
  isOpen: boolean
  onClose: () => void
  onSave: (
    name: string,
    description: string,
    scope: string,
    isUpdate: boolean,
    existingId?: number,
    group_path?: string | null
  ) => Promise<boolean>
  isSaving: boolean
  savedSearches: SavedSearchSummary[]
  currentQuery: SearchGroup
  initialName?: string
  initialDescription?: string
  initialGroupPath?: string | null
}

export function SaveSearchDialog({
  isOpen,
  onClose,
  onSave,
  isSaving,
  savedSearches,
  currentQuery,
  initialName,
  initialDescription,
  initialGroupPath,
}: SaveSearchDialogProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [scope, setScope] = useState<string>('global')
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null)
  const [localGroupPaths, setLocalGroupPaths] = useState<string[]>([])
  const [showTree, setShowTree] = useState(false)
  const [showOverwriteConfirm, setShowOverwriteConfirm] = useState(false)
  const [searchToOverwrite, setSearchToOverwrite] = useState<SavedSearchSummary | null>(
    null
  )

  useEffect(() => {
    if (isOpen) {
      setName(initialName ?? '')
      setDescription(initialDescription ?? '')
      setScope('global')
      setSelectedGroup(initialGroupPath ?? null)
      setLocalGroupPaths([])
      setShowTree(false)
      setShowOverwriteConfirm(false)
      setSearchToOverwrite(null)
    }
  }, [isOpen, initialName, initialDescription, initialGroupPath])

  const searchesInGroup = useMemo(
    () =>
      savedSearches.filter(s => (s.group_path ?? '') === (selectedGroup ?? '')),
    [savedSearches, selectedGroup]
  )

  const treeAscii = useMemo(
    () => generateSearchGroupAscii(currentQuery),
    [currentQuery]
  )

  const handleCreateGroup = (parentPath: string | null, groupName: string) => {
    const newPath = parentPath ? `${parentPath}/${groupName}` : groupName
    setLocalGroupPaths(prev => [...prev, newPath])
    setSelectedGroup(newPath)
  }

  const handleSaveClick = async () => {
    if (!name.trim()) {
      return
    }

    const existingSearch = savedSearches.find(s => s.name === name.trim())
    if (existingSearch && !showOverwriteConfirm) {
      setSearchToOverwrite(existingSearch)
      setShowOverwriteConfirm(true)
      return
    }

    const success = await onSave(
      name.trim(),
      description,
      scope,
      !!existingSearch,
      existingSearch?.id,
      selectedGroup
    )

    if (success) {
      onClose()
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-5xl sm:max-w-5xl max-h-[88vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <DialogTitle>Save Search</DialogTitle>
        </DialogHeader>

        {showOverwriteConfirm ? (
          <div className="flex-1 flex flex-col p-6 gap-4">
            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded">
              <div className="flex gap-3">
                <AlertCircle className="h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-yellow-800">
                  A search named <strong>&quot;{searchToOverwrite?.name}&quot;</strong>{' '}
                  already exists. Do you want to overwrite it?
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setShowOverwriteConfirm(false)
                  setSearchToOverwrite(null)
                }}
              >
                Cancel
              </Button>
              <Button onClick={handleSaveClick} disabled={isSaving}>
                {isSaving ? 'Overwriting...' : 'Yes, Overwrite'}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <>
            {/* Main area: group tree (left) + files (right) */}
            <div
              className="flex gap-0 flex-1 min-h-0"
              style={{ minHeight: '280px', maxHeight: '340px' }}
            >
              {/* Left: Group tree */}
              <div className="w-56 flex-shrink-0 border-r p-3 overflow-y-auto">
                <GroupTreePanel
                  inventories={savedSearches}
                  selectedGroup={selectedGroup}
                  onSelectGroup={setSelectedGroup}
                  allowCreate
                  onCreateGroup={handleCreateGroup}
                  extraPaths={localGroupPaths}
                />
              </div>

              {/* Right: searches in selected group */}
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
                    {searchesInGroup.map(s => (
                      <div
                        key={s.id}
                        className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-gray-50 text-sm"
                      >
                        <FileText className="h-4 w-4 text-gray-400 flex-shrink-0" />
                        <span className="flex-1 truncate text-gray-800">{s.name}</span>
                        <Badge variant="secondary" className="text-xs flex-shrink-0">
                          {s.scope}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* General panel */}
            <div className="border-t p-4 space-y-3">
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                General
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="search-name" className="text-sm">
                    Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="search-name"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="e.g., High-RAM Debian servers"
                    className={!name.trim() && name !== '' ? 'border-red-300' : ''}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="search-scope" className="text-sm">
                    Scope
                  </Label>
                  <Select value={scope} onValueChange={setScope} disabled={isSaving}>
                    <SelectTrigger id="search-scope">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="global">Global (all users)</SelectItem>
                      <SelectItem value="private">Private (only you)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="search-desc" className="text-sm">
                  Description
                </Label>
                <Textarea
                  id="search-desc"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Describe what this search finds..."
                  rows={2}
                  className="resize-none"
                />
              </div>
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
            </div>

            <DialogFooter className="px-6 py-4 border-t">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button onClick={handleSaveClick} disabled={isSaving || !name.trim()}>
                {isSaving ? 'Saving...' : 'Save'}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
