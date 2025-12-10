/**
 * Dialog for saving inventory configuration to database
 */

import { useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Save } from 'lucide-react'

interface SaveInventoryDialogProps {
  show: boolean
  onClose: () => void
  onSave: (name: string, description: string, scope: string) => Promise<void>
  isSaving: boolean
}

export function SaveInventoryDialog({
  show,
  onClose,
  onSave,
  isSaving,
}: SaveInventoryDialogProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [scope, setScope] = useState<string>('global')

  const handleSave = async () => {
    if (!name.trim()) {
      alert('Please enter an inventory name')
      return
    }

    await onSave(name, description, scope)

    // Reset form
    setName('')
    setDescription('')
    setScope('global')
  }

  const handleClose = () => {
    setName('')
    setDescription('')
    setScope('global')
    onClose()
  }

  return (
    <Dialog open={show} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Save className="h-5 w-5 text-blue-600" />
            Save Inventory Configuration
          </DialogTitle>
          <DialogDescription>
            Save the current device filter conditions to the database for later use.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="inventory-name">
              Inventory Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="inventory-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., dc1-switches"
              disabled={isSaving}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="inventory-description">Description</Label>
            <Textarea
              id="inventory-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description of this inventory"
              rows={3}
              disabled={isSaving}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="inventory-scope">Scope</Label>
            <Select value={scope} onValueChange={setScope} disabled={isSaving}>
              <SelectTrigger id="inventory-scope">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="global">
                  Global (accessible to all users)
                </SelectItem>
                <SelectItem value="private">
                  Private (only accessible to you)
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-gray-500">
              {scope === 'global'
                ? 'All users can use this inventory configuration'
                : 'Only you can see and use this inventory configuration'
              }
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving || !name.trim()}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {isSaving ? 'Saving...' : 'Save Inventory'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
