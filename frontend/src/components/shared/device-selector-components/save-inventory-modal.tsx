import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AlertCircle } from 'lucide-react'

interface SaveInventoryModalProps {
    isOpen: boolean
    onClose: () => void
    onSave: (name: string, description: string, scope: string, isUpdate: boolean, existingId?: number) => Promise<boolean>
    isSaving: boolean
    savedInventories: Array<{ id: number; name: string }>
}

export function SaveInventoryModal({
    isOpen,
    onClose,
    onSave,
    isSaving,
    savedInventories
}: SaveInventoryModalProps) {
    const [name, setName] = useState('')
    const [description, setDescription] = useState('')
    const [scope, setScope] = useState<string>('global')
    const [showOverwriteConfirm, setShowOverwriteConfirm] = useState(false)
    const [inventoryToOverwrite, setInventoryToOverwrite] = useState<{ id: number; name: string } | null>(null)

    const handleSaveClick = async () => {
        if (!name.trim()) {
            alert('Please enter an inventory name.')
            return
        }

        const existingInventory = savedInventories.find(inv => inv.name === name)
        if (existingInventory && !showOverwriteConfirm) {
            setInventoryToOverwrite(existingInventory)
            setShowOverwriteConfirm(true)
            return
        }

        const success = await onSave(
            name,
            description,
            scope,
            !!existingInventory,
            existingInventory?.id
        )

        if (success) {
            setName('')
            setDescription('')
            setScope('global')
            setShowOverwriteConfirm(false)
            setInventoryToOverwrite(null)
            onClose()
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Save Inventory Filter</DialogTitle>
                </DialogHeader>

                {showOverwriteConfirm ? (
                    <div className="space-y-4">
                        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
                            <div className="flex">
                                <div className="flex-shrink-0">
                                    <AlertCircle className="h-5 w-5 text-yellow-400" aria-hidden="true" />
                                </div>
                                <div className="ml-3">
                                    <p className="text-sm text-yellow-700">
                                        An inventory with the name &quot;{inventoryToOverwrite?.name}&quot; already exists.
                                        Do you want to overwrite it?
                                    </p>
                                </div>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button
                                variant="outline"
                                onClick={() => {
                                    setShowOverwriteConfirm(false)
                                    setInventoryToOverwrite(null)
                                }}
                            >
                                Cancel
                            </Button>
                            <Button
                                variant="default"
                                onClick={handleSaveClick}
                                disabled={isSaving}
                            >
                                {isSaving ? 'Overwriting...' : 'Yes, Overwrite'}
                            </Button>
                        </DialogFooter>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">Name</Label>
                            <Input
                                id="name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="e.g., Windows Servers in Berlin"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="description">Description (Optional)</Label>
                            <Textarea
                                id="description"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Describe what this filter does..."
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="scope">Scope</Label>
                            <Select value={scope} onValueChange={setScope} disabled={isSaving}>
                                <SelectTrigger id="scope">
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
                        <DialogFooter>
                            <Button variant="outline" onClick={onClose}>Cancel</Button>
                            <Button onClick={handleSaveClick} disabled={isSaving}>
                                {isSaving ? 'Saving...' : 'Save'}
                            </Button>
                        </DialogFooter>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    )
}
