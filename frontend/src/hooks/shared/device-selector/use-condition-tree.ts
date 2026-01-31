import { useState, useCallback } from 'react'
import {
    ConditionTree,
    ConditionItem,
    ConditionGroup,
    LogicalCondition
} from '@/types/shared/device-selector'

// Helper function to generate unique IDs
export const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

// Initial empty tree
export const createEmptyTree = (): ConditionTree => ({
    type: 'root',
    internalLogic: 'AND',
    items: []
})

const EMPTY_TREE = createEmptyTree()

export function useConditionTree() {
    // Tree-based condition state
    const [conditionTree, setConditionTree] = useState<ConditionTree>(EMPTY_TREE)

    // Track current editing context (which group we're adding to)
    const [currentGroupPath, setCurrentGroupPath] = useState<string[]>([]) // Array of group IDs representing path

    // Helper to convert flat conditions to tree (for backward compatibility)
    const flatConditionsToTree = useCallback((flatConditions: LogicalCondition[]): ConditionTree => {
        if (!flatConditions || flatConditions.length === 0) {
            return createEmptyTree()
        }

        const tree = createEmptyTree()

        // Simple conversion: Create a flat list of items in the root group
        // This is a simplification - a real parser would be more complex
        // but this maintains the behavior of the previous version
        tree.items = flatConditions.map(c => ({
            id: generateId(),
            field: c.field,
            operator: c.operator,
            value: c.value
        }))

        // Try to infer root logic from the first item if possible (mostly AND for simple lists)
        if (flatConditions.length > 0 && flatConditions[0] && flatConditions[0].logic) {
            tree.internalLogic = flatConditions[0].logic as 'AND' | 'OR'
        }

        return tree
    }, [])

    const addConditionToTree = useCallback((
        field: string,
        operator: string,
        value: string
    ) => {
        const newCondition: ConditionItem = {
            id: generateId(),
            field,
            operator,
            value
        }

        setConditionTree(prevTree => {
            const newTree = { ...prevTree }

            if (currentGroupPath.length === 0) {
                // Adding to root level
                newTree.items = [...newTree.items, newCondition]
            } else {
                // Adding to a specific group
                const findAndAddToGroup = (items: (ConditionItem | ConditionGroup)[], pathIndex: number): (ConditionItem | ConditionGroup)[] => {
                    return items.map(item => {
                        if ('type' in item && item.type === 'group' && item.id === currentGroupPath[pathIndex]) {
                            if (pathIndex === currentGroupPath.length - 1) {
                                // Found target group
                                return {
                                    ...item,
                                    items: [...item.items, newCondition]
                                }
                            } else {
                                // Keep searching deeper
                                return {
                                    ...item,
                                    items: findAndAddToGroup(item.items, pathIndex + 1)
                                }
                            }
                        }
                        return item
                    })
                }

                newTree.items = findAndAddToGroup(newTree.items, 0)
            }

            return newTree
        })
    }, [currentGroupPath])

    const addGroup = useCallback((
        logic: 'AND' | 'OR',
        negate: boolean
    ) => {
        // Determine group logic based on currentLogic and currentNegate
        let groupLogic: 'AND' | 'OR' | 'NOT' = logic
        if (negate) {
            groupLogic = 'NOT'
        }

        const newGroup: ConditionGroup = {
            id: generateId(),
            type: 'group',
            logic: groupLogic,
            internalLogic: 'AND',  // Default to AND within group
            items: []
        }

        setConditionTree(prevTree => {
            const newTree = { ...prevTree }

            if (currentGroupPath.length === 0) {
                // Adding to root level
                newTree.items = [...newTree.items, newGroup]
            } else {
                // Adding to a specific group (nested)
                const findAndAddToGroup = (items: (ConditionItem | ConditionGroup)[], pathIndex: number): (ConditionItem | ConditionGroup)[] => {
                    return items.map(item => {
                        if ('type' in item && item.type === 'group' && item.id === currentGroupPath[pathIndex]) {
                            if (pathIndex === currentGroupPath.length - 1) {
                                // Found target group
                                return {
                                    ...item,
                                    items: [...item.items, newGroup]
                                }
                            } else {
                                // Keep searching deeper
                                return {
                                    ...item,
                                    items: findAndAddToGroup(item.items, pathIndex + 1)
                                }
                            }
                        }
                        return item
                    })
                }

                newTree.items = findAndAddToGroup(newTree.items, 0)
            }

            return newTree
        })
    }, [currentGroupPath])

    const removeItemFromTree = useCallback((itemId: string) => {
        setConditionTree(prevTree => {
            const removeFromItems = (items: (ConditionItem | ConditionGroup)[]): (ConditionItem | ConditionGroup)[] => {
                return items.filter(item => {
                    if (item.id === itemId) return false
                    if ('type' in item && item.type === 'group') {
                        // Recursively remove from group items
                        return true // Keep the group, but clean its items
                    }
                    return true
                }).map(item => {
                    if ('type' in item && item.type === 'group') {
                        return {
                            ...item,
                            items: removeFromItems(item.items)
                        }
                    }
                    return item
                })
            }

            return {
                ...prevTree,
                items: removeFromItems(prevTree.items)
            }
        })
    }, [])

    const updateGroupLogic = useCallback((groupId: string, newLogic: 'AND' | 'OR') => {
        setConditionTree(prevTree => {
            const updateLogic = (items: (ConditionItem | ConditionGroup)[]): (ConditionItem | ConditionGroup)[] => {
                return items.map(item => {
                    if ('type' in item && item.type === 'group') {
                        if (item.id === groupId) {
                            return {
                                ...item,
                                internalLogic: newLogic
                            }
                        }
                        return {
                            ...item,
                            items: updateLogic(item.items)
                        }
                    }
                    return item
                })
            }

            return {
                ...prevTree,
                items: updateLogic(prevTree.items)
            }
        })
    }, [])

    const findGroupPath = useCallback((groupId: string): string[] | null => {
        const findRecursive = (items: (ConditionItem | ConditionGroup)[], currentPath: string[]): string[] | null => {
            for (const item of items) {
                if ('type' in item && item.type === 'group') {
                    if (item.id === groupId) {
                        return [...currentPath, item.id]
                    }

                    const pathInGroup = findRecursive(item.items, [...currentPath, item.id])
                    if (pathInGroup) {
                        return pathInGroup
                    }
                }
            }
            return null
        }

        return findRecursive(conditionTree.items, [])
    }, [conditionTree])

    return {
        conditionTree,
        setConditionTree,
        currentGroupPath,
        setCurrentGroupPath,
        addConditionToTree,
        addGroup,
        removeItemFromTree,
        updateGroupLogic,
        findGroupPath,
        flatConditionsToTree
    }
}
