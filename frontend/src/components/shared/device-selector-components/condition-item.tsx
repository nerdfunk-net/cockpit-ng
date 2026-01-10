import { ConditionItem as ConditionItemType } from '@/types/shared/device-selector'
import { Button } from '@/components/ui/button'
import { X } from 'lucide-react'

interface ConditionItemProps {
    item: ConditionItemType
    onRemove: (id: string) => void
    getFieldLabel: (field: string) => string
}

export function ConditionItem({ item, onRemove, getFieldLabel }: ConditionItemProps) {
    return (
        <div className="flex items-center gap-2">
            <div className="inline-flex items-center space-x-2 px-3 py-1.5 bg-blue-100 text-blue-800 rounded text-sm">
                <span className="font-medium">{getFieldLabel(item.field)}</span>
                <span className="text-gray-600">{item.operator}</span>
                <span className="font-medium">&quot;{item.value}&quot;</span>
                <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onRemove(item.id)}
                    className="h-4 w-4 p-0 hover:bg-blue-200"
                    title="Delete condition"
                >
                    <X className="h-3 w-3" />
                </Button>
            </div>
        </div>
    )
}
