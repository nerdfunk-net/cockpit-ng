import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { LogicalCondition } from '@/types/shared/device-selector'
import { Loader2 } from 'lucide-react'

interface LoadInventoryModalProps {
    isOpen: boolean
    onClose: () => void
    savedInventories: Array<{
        id: number
        name: string
        description?: string
        conditions: LogicalCondition[]
        scope: string
        created_by: string
    }>
    isLoading: boolean
    onLoad: (id: number) => void
}

export function LoadInventoryModal({
    isOpen,
    onClose,
    savedInventories,
    isLoading,
    onLoad
}: LoadInventoryModalProps) {
    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>Load Saved Inventory</DialogTitle>
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
                        <div className="space-y-2">
                            {savedInventories.map((inventory) => (
                                <div
                                    key={inventory.id}
                                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
                                    onDoubleClick={() => onLoad(inventory.id)}
                                >
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                            <h4 className="font-medium text-sm">{inventory.name}</h4>
                                            <Badge variant="secondary" className="text-xs">
                                                {inventory.scope}
                                            </Badge>
                                        </div>
                                        {inventory.description && (
                                            <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                                                {inventory.description}
                                            </p>
                                        )}
                                        <div className="text-xs text-gray-400 mt-2">
                                            Created by {inventory.created_by}
                                        </div>
                                    </div>
                                    <Button
                                        onClick={() => onLoad(inventory.id)}
                                        size="sm"
                                        className="ml-4"
                                    >
                                        Load
                                    </Button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    )
}
