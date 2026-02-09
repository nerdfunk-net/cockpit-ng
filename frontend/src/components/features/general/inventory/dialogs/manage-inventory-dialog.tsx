/**
 * Dialog for managing saved inventory configurations
 * Allows users to view, rename, and delete saved inventories
 */

import { useState, useMemo } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Settings, Search, Globe, Lock, Eye, Edit2, Trash2, X, Check } from 'lucide-react'
import { conditionTreeToExpression } from '@/hooks/shared/device-selector/condition-tree-utils'
import type { ConditionTree, ConditionGroup } from '@/types/shared/device-selector'

// Legacy flat condition format
interface LegacyCondition {
  field: string
  operator: string
  value: string
  logic: string
}

// Version 2 wrapper format
interface ConditionTreeWrapper {
  version: 2
  tree: ConditionTree
}

interface SavedInventory {
  id: number
  name: string
  description?: string
  scope: string
  created_by: string
  created_at?: string
  updated_at?: string
  conditions: (LegacyCondition | ConditionTreeWrapper)[] // Can be tree structure or legacy flat format
}

interface ManageInventoryDialogProps {
  show: boolean
  onClose: () => void
  onUpdate: (inventoryId: number, name: string, description: string) => Promise<void>
  onDelete: (inventoryId: number, inventoryName: string) => Promise<void>
  inventories: SavedInventory[]
  isLoading: boolean
}

export function ManageInventoryDialog({
  show,
  onClose,
  onUpdate,
  onDelete,
  inventories,
  isLoading,
}: ManageInventoryDialogProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedInventory, setSelectedInventory] = useState<SavedInventory | null>(null)
  const [viewMode, setViewMode] = useState<'list' | 'view' | 'edit'>('list')
  const [editName, setEditName] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const filteredInventories = useMemo(() => {
    if (searchTerm.trim() === '') {
      return inventories
    }
    const term = searchTerm.toLowerCase()
    return inventories.filter(
      (inv) =>
        inv.name.toLowerCase().includes(term) ||
        (inv.description?.toLowerCase().includes(term) ?? false)
    )
  }, [searchTerm, inventories])

  const handleView = (inventory: SavedInventory) => {
    setSelectedInventory(inventory)
    setViewMode('view')
  }

  const handleEdit = (inventory: SavedInventory) => {
    setSelectedInventory(inventory)
    setEditName(inventory.name)
    setEditDescription(inventory.description || '')
    setViewMode('edit')
  }

  const handleSaveEdit = async () => {
    if (!selectedInventory || !editName.trim()) {
      alert('Please enter an inventory name')
      return
    }

    setIsSaving(true)
    try {
      await onUpdate(selectedInventory.id, editName.trim(), editDescription.trim())
      setViewMode('list')
      setSelectedInventory(null)
    } catch (error) {
      console.error('Error updating inventory:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (inventory: SavedInventory) => {
    if (confirm(`Are you sure you want to delete inventory "${inventory.name}"?`)) {
      await onDelete(inventory.id, inventory.name)
      if (selectedInventory?.id === inventory.id) {
        setViewMode('list')
        setSelectedInventory(null)
      }
    }
  }

  const handleClose = () => {
    setSearchTerm('')
    setViewMode('list')
    setSelectedInventory(null)
    onClose()
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getLogicalExpression = (inventory: SavedInventory): string => {
    // Check if conditions array exists and has items
    if (!inventory.conditions || inventory.conditions.length === 0) {
      return 'No conditions'
    }

    const firstItem = inventory.conditions[0]

    // Check if this is version 2 (tree structure)
    if (firstItem && typeof firstItem === 'object' && 'version' in firstItem && firstItem.version === 2) {
      // New tree structure format
      const tree = firstItem.tree as ConditionTree
      return conditionTreeToExpression(tree)
    }

    // Legacy flat format - convert to readable expression
    const flatConditions = inventory.conditions as Array<{
      field: string
      operator: string
      value: string
      logic: string
    }>

    if (flatConditions.length === 1) {
      const c = flatConditions[0]
      if (!c) return 'No conditions'
      return `${c.field} ${c.operator} "${c.value}"`
    }

    return flatConditions.map((c, index) => {
      const expr = `${c.field} ${c.operator} "${c.value}"`
      return index === 0 ? expr : `${c.logic} ${expr}`
    }).join(' ')
  }

  const getConditionCount = (inventory: SavedInventory): number => {
    if (!inventory.conditions || inventory.conditions.length === 0) {
      return 0
    }

    const firstItem = inventory.conditions[0]

    // Version 2: count items in tree
    if (firstItem && typeof firstItem === 'object' && 'version' in firstItem && firstItem.version === 2) {
      const tree = firstItem.tree as ConditionTree
      return countTreeItems(tree)
    }

    // Legacy: just return array length
    return inventory.conditions.length
  }

  const countTreeItems = (tree: ConditionTree | ConditionGroup): number => {
    if (!tree || !tree.items) return 0

    let count = 0
    tree.items.forEach((item) => {
      if ('type' in item && item.type === 'group') {
        count += countTreeItems(item)
      } else {
        count += 1
      }
    })
    return count
  }

  return (
    <Dialog open={show} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[800px] max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-purple-600" />
            Manage Inventories
          </DialogTitle>
          <DialogDescription>
            View, rename, and delete your saved inventory configurations.
          </DialogDescription>
        </DialogHeader>

        {viewMode === 'list' && (
          <div className="grid gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search inventories..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Inventory List */}
            <div className="border rounded-md max-h-[500px] overflow-y-auto">
              {isLoading ? (
                <div className="p-8 text-center text-gray-500">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500 mx-auto mb-2" />
                  Loading inventories...
                </div>
              ) : filteredInventories.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  {searchTerm ? (
                    <>
                      <Search className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                      <p>No inventories found matching &ldquo;{searchTerm}&rdquo;</p>
                    </>
                  ) : (
                    <>
                      <Settings className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                      <p>No saved inventories yet</p>
                      <p className="text-sm mt-1">Create device filters and save them to get started</p>
                    </>
                  )}
                </div>
              ) : (
                <div className="divide-y">
                  {filteredInventories.map((inventory) => (
                    <div
                      key={inventory.id}
                      className="p-4 hover:bg-purple-50/50 transition-colors group"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-medium text-gray-900 truncate">
                              {inventory.name}
                            </h4>
                            <Badge
                              variant={inventory.scope === 'global' ? 'default' : 'secondary'}
                              className="shrink-0"
                            >
                              {inventory.scope === 'global' ? (
                                <>
                                  <Globe className="h-3 w-3 mr-1" />
                                  Global
                                </>
                              ) : (
                                <>
                                  <Lock className="h-3 w-3 mr-1" />
                                  Private
                                </>
                              )}
                            </Badge>
                          </div>
                          {inventory.description && (
                            <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                              {inventory.description}
                            </p>
                          )}
                          <div className="flex items-center gap-4 text-xs text-gray-500">
                            <span>{getConditionCount(inventory)} condition(s)</span>
                            <span>•</span>
                            <span>Created by {inventory.created_by}</span>
                            {inventory.updated_at && (
                              <>
                                <span>•</span>
                                <span>Updated {formatDate(inventory.updated_at)}</span>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-1 ml-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                            onClick={() => handleView(inventory)}
                            title="View conditions"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-purple-600 hover:text-purple-700 hover:bg-purple-50"
                            onClick={() => handleEdit(inventory)}
                            title="Edit inventory"
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => handleDelete(inventory)}
                            title="Delete inventory"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {viewMode === 'view' && selectedInventory && (
          <div className="grid gap-4">
            <div className="flex items-center justify-between">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setViewMode('list')}
                className="text-gray-600 hover:text-gray-800"
              >
                <X className="h-4 w-4 mr-1" />
                Back to List
              </Button>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleEdit(selectedInventory)}
                  className="text-purple-600 hover:text-purple-700 border-purple-300"
                >
                  <Edit2 className="h-4 w-4 mr-1" />
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDelete(selectedInventory)}
                  className="text-red-600 hover:text-red-700 border-red-300"
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Delete
                </Button>
              </div>
            </div>

            <div className="border rounded-lg p-4 bg-gradient-to-br from-blue-50 to-purple-50">
              <div className="flex items-center gap-2 mb-3">
                <h3 className="text-lg font-semibold text-gray-900">{selectedInventory.name}</h3>
                <Badge variant={selectedInventory.scope === 'global' ? 'default' : 'secondary'}>
                  {selectedInventory.scope === 'global' ? (
                    <>
                      <Globe className="h-3 w-3 mr-1" />
                      Global
                    </>
                  ) : (
                    <>
                      <Lock className="h-3 w-3 mr-1" />
                      Private
                    </>
                  )}
                </Badge>
              </div>

              {selectedInventory.description && (
                <p className="text-sm text-gray-700 mb-3">{selectedInventory.description}</p>
              )}

              <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 mb-4">
                <div>
                  <span className="font-medium">Created by:</span> {selectedInventory.created_by}
                </div>
                {selectedInventory.updated_at && (
                  <div>
                    <span className="font-medium">Updated:</span> {formatDate(selectedInventory.updated_at)}
                  </div>
                )}
              </div>

              <div className="border-t pt-3">
                <Label className="text-sm font-semibold text-gray-700 mb-2 block">
                  Logical Expression ({getConditionCount(selectedInventory)} condition{getConditionCount(selectedInventory) !== 1 ? 's' : ''})
                </Label>
                <div className="bg-white rounded-md p-3 border border-gray-200 font-mono text-sm text-gray-800 break-words">
                  {getLogicalExpression(selectedInventory)}
                </div>
              </div>
            </div>
          </div>
        )}

        {viewMode === 'edit' && selectedInventory && (
          <div className="grid gap-4">
            <div className="flex items-center justify-between">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setViewMode('list')}
                className="text-gray-600 hover:text-gray-800"
                disabled={isSaving}
              >
                <X className="h-4 w-4 mr-1" />
                Cancel
              </Button>
            </div>

            <div className="border rounded-lg p-4 bg-gradient-to-br from-purple-50 to-pink-50">
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="edit-name">
                    Inventory Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="edit-name"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Enter inventory name"
                    disabled={isSaving}
                    className="bg-white"
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="edit-description">Description</Label>
                  <Textarea
                    id="edit-description"
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    placeholder="Optional description"
                    rows={3}
                    disabled={isSaving}
                    className="bg-white"
                  />
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                  <p className="text-xs text-blue-800 mb-2">
                    <strong>Note:</strong> You cannot edit the logical conditions or scope.
                    To change conditions, create a new inventory.
                  </p>
                  <div className="text-xs text-blue-700">
                    <span className="font-medium">Current Scope:</span>{' '}
                    <Badge variant={selectedInventory.scope === 'global' ? 'default' : 'secondary'} className="text-xs">
                      {selectedInventory.scope === 'global' ? 'Global' : 'Private'}
                    </Badge>
                  </div>
                </div>

                <div className="border-t pt-3">
                  <Label className="text-sm font-semibold text-gray-700 mb-2 block">
                    Logical Expression ({getConditionCount(selectedInventory)} condition{getConditionCount(selectedInventory) !== 1 ? 's' : ''})
                  </Label>
                  <div className="bg-gray-50 rounded-md p-3 border border-gray-300 font-mono text-sm text-gray-700 break-words">
                    {getLogicalExpression(selectedInventory)}
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setViewMode('view')}
                    disabled={isSaving}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSaveEdit}
                    disabled={isSaving || !editName.trim()}
                    className="bg-purple-600 hover:bg-purple-700"
                  >
                    {isSaving ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Check className="h-4 w-4 mr-1" />
                        Save Changes
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {viewMode === 'list' && (
          <DialogFooter>
            <Button variant="outline" onClick={handleClose}>
              Close
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
