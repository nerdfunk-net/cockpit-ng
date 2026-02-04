import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Pencil, Trash2, X, Check, Loader2, Download, Upload } from 'lucide-react'
import { LogicalCondition, ConditionTree } from '@/types/shared/device-selector'

interface ManageInventoryModalProps {
    isOpen: boolean
    onClose: () => void
    savedInventories: Array<{
        id: number
        name: string
        description?: string
        conditions: LogicalCondition[] | Array<{ version: number; tree: ConditionTree }>
        scope: string
        created_by: string
        created_at?: string
    }>
    isLoading: boolean
    onUpdate: (id: number, name: string, description: string, scope: string) => Promise<void>
    onDelete: (id: number, name: string) => Promise<void>
    onExport: (id: number) => Promise<void>
    onImport: (file: File) => Promise<void>
}

export function ManageInventoryModal({
    isOpen,
    onClose,
    savedInventories,
    isLoading,
    onUpdate,
    onDelete,
    onExport,
    onImport
}: ManageInventoryModalProps) {
    const [editingId, setEditingId] = useState<number | null>(null)
    const [editName, setEditName] = useState('')
    const [editDescription, setEditDescription] = useState('')
    const [editScope, setEditScope] = useState<string>('global')
    const [isDeleting, setIsDeleting] = useState<number | null>(null)
    const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null)
    const [isExporting, setIsExporting] = useState<number | null>(null)
    const [isImporting, setIsImporting] = useState(false)

    const handleEditClick = (inventory: { id: number; name: string; description?: string; scope: string }) => {
        setEditingId(inventory.id)
        setEditName(inventory.name)
        setEditDescription(inventory.description || '')
        setEditScope(inventory.scope)
        setDeleteConfirmId(null)
    }

    const handleCancelEdit = () => {
        setEditingId(null)
        setEditName('')
        setEditDescription('')
        setEditScope('global')
    }

    const handleSaveEdit = async (id: number) => {
        if (!editName.trim()) return

        await onUpdate(id, editName, editDescription, editScope)
        setEditingId(null)
    }

    const handleDeleteClick = (id: number) => {
        if (deleteConfirmId === id) {
            // Confirmed delete
            handleConfirmDelete(id)
        } else {
            setDeleteConfirmId(id)
        }
    }

    const handleConfirmDelete = async (id: number) => {
        const inventory = savedInventories.find(inv => inv.id === id)
        if (!inventory) return

        setIsDeleting(id)
        try {
            await onDelete(id, inventory.name)
        } finally {
            setIsDeleting(null)
            setDeleteConfirmId(null)
        }
    }

    const handleExport = async (id: number) => {
        setIsExporting(id)
        try {
            await onExport(id)
        } finally {
            setIsExporting(null)
        }
    }

    const handleImportClick = () => {
        const input = document.createElement('input')
        input.type = 'file'
        input.accept = '.json'
        input.onchange = async (e) => {
            const file = (e.target as HTMLInputElement).files?.[0]
            if (file) {
                setIsImporting(true)
                try {
                    await onImport(file)
                } finally {
                    setIsImporting(false)
                }
            }
        }
        input.click()
    }

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>Manage Inventories</DialogTitle>
                </DialogHeader>

                {isLoading ? (
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                        <span className="ml-2">Loading inventories...</span>
                    </div>
                ) : savedInventories.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                        No saved inventories found.
                    </div>
                ) : (
                    <div className="flex-1 pr-4 max-h-[60vh] overflow-y-auto">
                        <div className="space-y-4">
                            {savedInventories.map((inventory) => (
                                <div
                                    key={inventory.id}
                                    className="border rounded-lg p-4 transition-colors bg-white hover:bg-gray-50"
                                >
                                    {editingId === inventory.id ? (
                                        <div className="space-y-4">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <Label htmlFor={`edit-name-${inventory.id}`}>Name</Label>
                                                    <Input
                                                        id={`edit-name-${inventory.id}`}
                                                        value={editName}
                                                        onChange={(e) => setEditName(e.target.value)}
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label htmlFor={`edit-desc-${inventory.id}`}>Description</Label>
                                                    <Textarea
                                                        id={`edit-desc-${inventory.id}`}
                                                        value={editDescription}
                                                        onChange={(e) => setEditDescription(e.target.value)}
                                                        rows={1}
                                                        className="min-h-[40px]"
                                                    />
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor={`edit-scope-${inventory.id}`}>Scope</Label>
                                                <Select value={editScope} onValueChange={setEditScope}>
                                                    <SelectTrigger id={`edit-scope-${inventory.id}`}>
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
                                                <p className="text-xs text-gray-500">
                                                    {editScope === 'global'
                                                        ? 'All users can use this inventory'
                                                        : 'Only you can see and use this inventory'
                                                    }
                                                </p>
                                            </div>
                                            <div className="flex justify-end gap-2">
                                                <Button size="sm" variant="ghost" onClick={handleCancelEdit}>
                                                    <X className="h-4 w-4 mr-1" /> Cancel
                                                </Button>
                                                <Button size="sm" onClick={() => handleSaveEdit(inventory.id)}>
                                                    <Check className="h-4 w-4 mr-1" /> Save Changes
                                                </Button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <h4 className="font-medium text-sm">{inventory.name}</h4>
                                                    <Badge variant="secondary" className="text-xs">
                                                        {inventory.scope}
                                                    </Badge>
                                                </div>
                                                {inventory.description && (
                                                    <p className="text-sm text-gray-500 line-clamp-2 mb-2">
                                                        {inventory.description}
                                                    </p>
                                                )}
                                                <div className="text-xs text-gray-400">
                                                    Created by {inventory.created_by} • {new Date(inventory.created_at || '').toLocaleDateString()}
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2">
                                                {deleteConfirmId === inventory.id ? (
                                                    <div className="flex items-center gap-2 bg-red-50 p-1 rounded-md border border-red-200">
                                                        <span className="text-xs text-red-600 font-medium ml-1">Sure?</span>
                                                        <Button
                                                            size="sm"
                                                            variant="destructive"
                                                            className="h-7 px-2 text-xs"
                                                            onClick={() => handleConfirmDelete(inventory.id)}
                                                            disabled={isDeleting === inventory.id}
                                                        >
                                                            {isDeleting === inventory.id ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Yes'}
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            className="h-7 w-7 p-0"
                                                            onClick={() => setDeleteConfirmId(null)}
                                                        >
                                                            <X className="h-3 w-3" />
                                                        </Button>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            className="h-8 w-8 p-0"
                                                            onClick={() => handleEditClick(inventory)}
                                                            title="Edit"
                                                        >
                                                            <Pencil className="h-3.5 w-3.5" />
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            className="h-8 w-8 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50 border-blue-200"
                                                            onClick={() => handleExport(inventory.id)}
                                                            title="Export"
                                                            disabled={isExporting === inventory.id}
                                                        >
                                                            {isExporting === inventory.id ? (
                                                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                            ) : (
                                                                <Download className="h-3.5 w-3.5" />
                                                            )}
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                                                            onClick={() => handleDeleteClick(inventory.id)}
                                                            title="Delete"
                                                        >
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </Button>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                <DialogFooter>
                    <div className="flex items-center justify-between w-full">
                        <Button
                            variant="outline"
                            onClick={handleImportClick}
                            disabled={isImporting}
                            className="flex items-center gap-2"
                        >
                            {isImporting ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <Upload className="h-4 w-4" />
                            )}
                            Import Inventory
                        </Button>
                        <Button variant="outline" onClick={onClose}>Close</Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
