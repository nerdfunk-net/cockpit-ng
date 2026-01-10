import { useState, useCallback } from 'react'
import {
    LogicalCondition,
    ConditionTree,
    ConditionItem
} from '@/types/shared/device-selector'
import {
    useSavedInventoriesQuery,
    useSaveInventoryMutation,
    useUpdateInventoryMutation,
    useDeleteInventoryMutation
} from '@/hooks/queries/use-saved-inventories-queries'
import { generateId } from './use-condition-tree'
import { useApi } from '@/hooks/use-api'

export function useSavedInventories() {
    const [isSavingInventory, setIsSavingInventory] = useState(false)
    const { apiCall } = useApi()

    // Use TanStack Query for loading saved inventories
    const {
        data: inventoriesData,
        isLoading: isLoadingInventories,
        refetch: reloadInventories
    } = useSavedInventoriesQuery()

    // Use TanStack Query mutations
    const { mutateAsync: saveInventoryMutation } = useSaveInventoryMutation()
    const { mutateAsync: updateInventoryMutation } = useUpdateInventoryMutation()
    const { mutateAsync: deleteInventoryMutation } = useDeleteInventoryMutation()

    const savedInventories = inventoriesData?.inventories || []

    const loadSavedInventories = useCallback(async () => {
        await reloadInventories()
    }, [reloadInventories])

    const saveInventory = async (
        name: string,
        description: string,
        conditionTree: ConditionTree,
        isUpdate: boolean = false,
        existingId?: number
    ) => {
        setIsSavingInventory(true)
        try {
            // Save the tree structure directly as JSON
            const treeData = {
                version: 2, // Version 2 = tree structure
                tree: conditionTree
            }

            if (isUpdate && existingId) {
                // Update existing inventory
                await updateInventoryMutation({
                    id: existingId,
                    data: {
                        description: description || undefined,
                        conditions: [treeData], // Wrap in array for backend compatibility
                    }
                })
            } else {
                // Create new inventory
                await saveInventoryMutation({
                    name: name,
                    description: description || undefined,
                    conditions: [treeData], // Wrap in array for backend compatibility
                    scope: 'global'
                })
            }

            return true
        } catch (error) {
            console.error('Error saving inventory:', error)
            throw error
        } finally {
            setIsSavingInventory(false)
        }
    }

    // Helper to convert flat conditions to tree
    const flatConditionsToTree = (flatConditions: LogicalCondition[]): ConditionTree => {
        const tree: ConditionTree = {
            type: 'root',
            internalLogic: 'AND',
            items: []
        }

        flatConditions.forEach((condition) => {
            const item: ConditionItem = {
                id: generateId(),
                field: condition.field,
                operator: condition.operator,
                value: condition.value
            }
            tree.items.push(item)
        })

        return tree
    }

    const loadInventory = async (inventoryName: string): Promise<ConditionTree | null> => {
        try {
            // Make direct API call to load inventory by name
            const response = await apiCall<{
                conditions: LogicalCondition[] | Array<{ version: number; tree: ConditionTree }>
            }>(`inventory/by-name/${encodeURIComponent(inventoryName)}`)

            if (!response) {
                return null
            }

            // Check if this is a new tree structure (version 2) or legacy flat format
            if (response.conditions && response.conditions.length > 0) {
                const firstItem = response.conditions[0]

                if (firstItem && typeof firstItem === 'object' && 'version' in firstItem && firstItem.version === 2) {
                    // New tree structure format
                    return firstItem.tree
                } else {
                    // Legacy flat conditions format
                    return flatConditionsToTree(response.conditions as LogicalCondition[])
                }
            }
            return null
        } catch (error) {
            console.error('Error loading inventory:', error)
            throw error
        }
    }

    const updateInventoryDetails = async (inventoryId: number, name: string, description: string) => {
        try {
            // Only send name and description - don't send conditions
            const updateData: { name: string; description: string | undefined } = {
                name,
                description: description || undefined,
            }

            await updateInventoryMutation({
                id: inventoryId,
                data: updateData
            })
        } catch (error) {
            console.error('Error updating inventory:', error)
            throw error
        }
    }

    const deleteInventory = async (inventoryId: number) => {
        try {
            await deleteInventoryMutation(inventoryId)
        } catch (error) {
            console.error('Error deleting inventory:', error)
            throw error
        }
    }

    return {
        savedInventories,
        isLoadingInventories,
        isSavingInventory,
        loadSavedInventories,
        saveInventory,
        loadInventory,
        updateInventoryDetails,
        deleteInventory
    }
}
