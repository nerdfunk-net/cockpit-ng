import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { InventoryHelpContent } from '@/components/features/general/inventory/components/inventory-help'

interface HelpModalProps {
    isOpen: boolean
    onClose: () => void
}

export function HelpModal({ isOpen, onClose }: HelpModalProps) {
    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="!max-w-[95vw] !w-[95vw] !max-h-[95vh] !h-[95vh] overflow-hidden flex flex-col p-0">
                <DialogHeader className="px-6 py-4 border-b">
                    <DialogTitle className="text-xl">Device Filter - Help & Examples</DialogTitle>
                </DialogHeader>
                <div className="flex-1 overflow-y-auto px-6 py-6">
                    <InventoryHelpContent />
                </div>
                <div className="flex justify-end px-6 py-4 border-t bg-gray-50">
                    <Button onClick={onClose}>Close</Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}
