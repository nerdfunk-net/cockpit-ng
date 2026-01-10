import { ConditionGroup as ConditionGroupType, ConditionItem as ConditionItemType } from '@/types/shared/device-selector'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { X } from 'lucide-react'
import { ConditionItem } from './condition-item'

interface ConditionGroupProps {
    group: ConditionGroupType
    currentGroupPath: string[]
    onSetTargetGroup: (id: string | null) => void
    onUpdateLogic: (id: string, logic: 'AND' | 'OR') => void
    onRemove: (id: string) => void
    getFieldLabel: (field: string) => string
    isFirst: boolean
    isAtRoot: boolean
    isItemAtRootLevel: (id: string) => boolean
}

export function ConditionGroup({
    group,
    currentGroupPath,
    onSetTargetGroup,
    onUpdateLogic,
    onRemove,
    getFieldLabel,
    isFirst,
    isAtRoot,
    isItemAtRootLevel
}: ConditionGroupProps) {
    const isActiveTarget = currentGroupPath.length > 0 && currentGroupPath[currentGroupPath.length - 1] === group.id

    const getLogicBadgeColor = (logic: string) => {
        switch (logic) {
            case 'AND': return 'bg-green-100 text-green-800'
            case 'OR': return 'bg-yellow-100 text-yellow-800'
            case 'AND NOT': return 'bg-red-100 text-red-800'
            default: return 'bg-blue-100 text-blue-800'
        }
    }

    return (
        <div
            className={`border-l-4 pl-4 py-2 rounded-r cursor-pointer transition-colors ${isActiveTarget
                    ? 'border-blue-500 bg-blue-50/70'
                    : 'border-purple-300 bg-purple-50/50 hover:bg-purple-100/50'
                }`}
            onClick={(e) => {
                e.stopPropagation()
                onSetTargetGroup(group.id)
            }}
            title="Click to add conditions to this group"
        >
            {/* Group header with logic operators */}
            <div className="flex items-center gap-2 mb-2">
                {/* Only show group logic badge if NOT at root level and NOT first item */}
                {!isFirst && !isAtRoot && (
                    <Badge className={getLogicBadgeColor(group.logic)}>
                        {group.logic}
                    </Badge>
                )}
                <Badge variant="outline" className={isActiveTarget ? "bg-blue-100 text-blue-800 border-blue-300" : "bg-purple-100 text-purple-800 border-purple-300"}>
                    GROUP ({group.internalLogic})
                </Badge>
                {isActiveTarget && (
                    <Badge className="bg-blue-500 text-white text-xs">
                        Active Target
                    </Badge>
                )}
                <Button
                    size="sm"
                    variant="ghost"
                    className="h-5 text-xs px-2"
                    onClick={(e) => {
                        e.stopPropagation()
                        onUpdateLogic(group.id, group.internalLogic === 'AND' ? 'OR' : 'AND')
                    }}
                    title="Toggle group logic"
                >
                    Toggle
                </Button>
                <Button
                    size="sm"
                    variant="ghost"
                    onClick={(e) => {
                        e.stopPropagation()
                        onRemove(group.id)
                    }}
                    className="h-5 w-5 p-0 hover:bg-red-100 ml-auto"
                    title="Delete group"
                >
                    <X className="h-3 w-3 text-red-600" />
                </Button>
            </div>
            {/* Group contents */}
            <div className="space-y-1">
                {group.items.length === 0 ? (
                    <p className="text-xs text-gray-400 italic">Empty group - add conditions here</p>
                ) : (
                    group.items.map((subItem, subIndex) => (
                        <div key={subItem.id}>
                            {'type' in subItem && subItem.type === 'group' ? (
                                <ConditionGroup
                                    group={subItem as ConditionGroupType}
                                    currentGroupPath={currentGroupPath}
                                    onSetTargetGroup={onSetTargetGroup}
                                    onUpdateLogic={onUpdateLogic}
                                    onRemove={onRemove}
                                    getFieldLabel={getFieldLabel}
                                    isFirst={subIndex === 0}
                                    isAtRoot={isItemAtRootLevel(subItem.id)}
                                    isItemAtRootLevel={isItemAtRootLevel}
                                />
                            ) : (
                                <ConditionItem
                                    item={subItem as ConditionItemType}
                                    onRemove={onRemove}
                                    getFieldLabel={getFieldLabel}
                                />
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    )
}
