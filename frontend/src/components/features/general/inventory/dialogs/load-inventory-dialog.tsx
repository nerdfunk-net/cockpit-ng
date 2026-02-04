/**
 * Dialog for loading saved inventory configurations from database
 */

import { useState, useMemo } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { FolderOpen, Search, Globe, Lock, Trash2 } from 'lucide-react'
import type { SavedInventory } from '@/hooks/queries/use-saved-inventories-queries'

interface LoadInventoryDialogProps {
  show: boolean
  onClose: () => void
  onLoad: (inventory: SavedInventory) => void
  onDelete: (inventoryId: number, inventoryName: string) => Promise<void>
  inventories: SavedInventory[]
  isLoading: boolean
}

export function LoadInventoryDialog({
  show,
  onClose,
  onLoad,
  onDelete,
  inventories,
  isLoading,
}: LoadInventoryDialogProps) {
  const [searchTerm, setSearchTerm] = useState('')
  
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

  const handleLoad = (inventory: SavedInventory) => {
    onLoad(inventory)
    setSearchTerm('')
    onClose()
  }

  const handleDelete = async (e: React.MouseEvent, inventoryId: number, inventoryName: string) => {
    e.stopPropagation()

    if (confirm(`Are you sure you want to delete inventory "${inventoryName}"?`)) {
      await onDelete(inventoryId, inventoryName)
    }
  }

  const handleClose = () => {
    setSearchTerm('')
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

  return (
    <Dialog open={show} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[700px] max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderOpen className="h-5 w-5 text-blue-600" />
            Load Saved Inventory
          </DialogTitle>
          <DialogDescription>
            Select a saved inventory configuration to load its device filter conditions.
          </DialogDescription>
        </DialogHeader>

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
          <div className="border rounded-md max-h-[400px] overflow-y-auto">
            {isLoading ? (
              <div className="p-8 text-center text-gray-500">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2" />
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
                    <FolderOpen className="h-12 w-12 mx-auto mb-2 text-gray-300" />
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
                    className="p-4 hover:bg-gray-50 cursor-pointer transition-colors group"
                    onClick={() => handleLoad(inventory)}
                    onDoubleClick={() => handleLoad(inventory)}
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
                          <span>{inventory.conditions.length} condition(s)</span>
                          <span>•</span>
                          <span>Created by {inventory.created_by}</span>
                          <span>•</span>
                          <span>Updated {inventory.updated_at ? formatDate(inventory.updated_at) : 'N/A'}</span>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="opacity-0 group-hover:opacity-100 transition-opacity ml-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={(e) => handleDelete(e, inventory.id, inventory.name)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
