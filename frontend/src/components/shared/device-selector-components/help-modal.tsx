import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface HelpModalProps {
    isOpen: boolean
    onClose: () => void
}

export function HelpModal({ isOpen, onClose }: HelpModalProps) {
    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>How to use Device Filter</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                    <section>
                        <h3 className="font-medium text-lg mb-2">Basic Filtering</h3>
                        <p className="text-gray-600 mb-2">
                            Select a field, an operator, and a value, then click the <strong>+</strong> button to add a condition.
                        </p>
                        <ul className="list-disc pl-5 space-y-1 text-sm text-gray-600">
                            <li><strong>AND</strong> logic requires ALL conditions to be met.</li>
                            <li><strong>OR</strong> logic requires ANY of the conditions to be met.</li>
                            <li>Toggle between AND/OR by clicking the connector button or the Toggle button on groups.</li>
                        </ul>
                    </section>

                    <section>
                        <h3 className="font-medium text-lg mb-2">Grouping Conditions</h3>
                        <p className="text-gray-600 mb-2">
                            Use groups to create complex nested logic like <code>(A AND B) OR (C AND D)</code>.
                        </p>
                        <ol className="list-decimal pl-5 space-y-1 text-sm text-gray-600">
                            <li>Click <strong>Group</strong> button to add a new group.</li>
                            <li>Click on a group (it will highlight blue) to select it as the target.</li>
                            <li>New conditions will be added to the selected target group.</li>
                            <li>Click &quot;Back to Root&quot; or select another group to change where conditions are added.</li>
                        </ol>
                    </section>

                    <section>
                        <h3 className="font-medium text-lg mb-2">Advanced Logic</h3>
                        <ul className="list-disc pl-5 space-y-1 text-sm text-gray-600">
                            <li><strong>Negate (NOT)</strong>: Check the &quot;Negate&quot; box before adding a group to exclude results matching that group.</li>
                            <li><strong>Toggle Logic</strong>: You can switch a group between AND/OR at any time.</li>
                        </ul>
                    </section>

                    <section>
                        <h3 className="font-medium text-lg mb-2">Custom Fields</h3>
                        <p className="text-gray-600 text-sm">
                            Select &quot;custom_fields&quot; from the field dropdown to access dynamic custom fields defined in Nautobot.
                        </p>
                    </section>
                </div>
                <div className="flex justify-end">
                    <Button onClick={onClose}>Close</Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}
