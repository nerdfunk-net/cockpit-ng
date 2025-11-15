/**
 * Save Inventory Dialog Component
 */

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { LogicalCondition, ApiCallType } from '../types'

type SavedInventoriesType = ReturnType<typeof import('../hooks').useSavedInventories>

interface SaveInventoryDialogProps {
  show: boolean
  onClose: () => void
  conditions: LogicalCondition[]
  savedInventories: SavedInventoriesType
  apiCall: ApiCallType
}

export function SaveInventoryDialog({
  show,
  onClose,
  conditions,
  savedInventories,
  apiCall,
}: SaveInventoryDialogProps) {
  const {
    inventoryRepositories,
    selectedInventoryRepo,
    savedInventories: inventoryList,
    saveInventoryName,
    saveInventoryDescription,
    isSavingInventory,
    showOverwriteConfirm,
    inventoryToOverwrite,
    setSelectedInventoryRepo,
    setSaveInventoryName,
    setSaveInventoryDescription,
    setShowOverwriteConfirm,
    setInventoryToOverwrite,
  } = savedInventories

  const handleSave = async () => {
    if (!saveInventoryName.trim() || !selectedInventoryRepo) {
      alert('Please enter a name and select a repository')
      return
    }

    // Check for existing
    const existing = inventoryList.find(inv => inv.name === saveInventoryName)
    if (existing && !showOverwriteConfirm) {
      setInventoryToOverwrite(saveInventoryName)
      setShowOverwriteConfirm(true)
      return
    }

    try {
      await apiCall('ansible-inventory/save-inventory', {
        method: 'POST',
        body: {
          name: saveInventoryName,
          description: saveInventoryDescription || undefined,
          conditions: conditions,
          repository_id: selectedInventoryRepo
        }
      })
      alert('Inventory saved successfully!')
      onClose()
    } catch (error) {
      alert('Error saving inventory: ' + (error as Error).message)
    }
  }

  return (
    <Dialog open={show} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Save Inventory Configuration</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label>Repository</Label>
            <Select 
              value={selectedInventoryRepo?.toString() || ''} 
              onValueChange={(value) => setSelectedInventoryRepo(parseInt(value))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a repository..." />
              </SelectTrigger>
              <SelectContent>
                {inventoryRepositories.map(repo => (
                  <SelectItem key={repo.id} value={repo.id.toString()}>
                    {repo.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Inventory Name *</Label>
            <Input
              placeholder="Enter inventory name..."
              value={saveInventoryName}
              onChange={(e) => setSaveInventoryName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              placeholder="Enter a description..."
              value={saveInventoryDescription}
              onChange={(e) => setSaveInventoryDescription(e.target.value)}
              rows={3}
            />
          </div>

          {showOverwriteConfirm && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
              <p className="text-sm text-yellow-800">
                An inventory named &quot;{inventoryToOverwrite}&quot; already exists. Do you want to overwrite it?
              </p>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSavingInventory || !saveInventoryName.trim() || !selectedInventoryRepo}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {isSavingInventory ? 'Saving...' : (showOverwriteConfirm ? 'Yes, Overwrite' : 'Save')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
