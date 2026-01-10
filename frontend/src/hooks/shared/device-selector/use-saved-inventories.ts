import { useState, useCallback } from 'react'
import {
    LogicalCondition,
    ConditionTree,
    BackendConditionsResponse,
    ConditionItem
} from '@/types/shared/device-selector'
import { useApi } from '@/hooks/use-api'
import { generateId } from './use-condition-tree'

export function useSavedInventories() {
    const { apiCall } = useApi()

    const [savedInventories, setSavedInventories] = useState<Array<{
        id: number
        name: string
        description?: string
        conditions: LogicalCondition[]
        scope: string
        created_by: string
        created_at?: string
        updated_at?: string
    }>>([])

    const [isLoadingInventories, setIsLoadingInventories] = useState(false)
    const [isSavingInventory, setIsSavingInventory] = useState(false)

    const loadSavedInventories = useCallback(async () => {
        setIsLoadingInventories(true)
        try {
            const response = await apiCall<{
                inventories: Array<{
                    id: number
                    name: string
                    description?: string
                    conditions: LogicalCondition[]
                    scope: string
                    created_by: string
                    created_at?: string
                    updated_at?: string
                }>
                total: number
            }>('inventory')

            setSavedInventories(response.inventories)
        } catch (error) {
            console.error('Error loading saved inventories:', error)
            setSavedInventories([])
        } finally {
            setIsLoadingInventories(false)
        }
    }, [apiCall])

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
                await apiCall(`inventory/${existingId}`, {
                    method: 'PUT',
                    body: {
                        description: description || undefined,
                        conditions: [treeData], // Wrap in array for backend compatibility
                    }
                })
            } else {
                // Create new inventory
                await apiCall('inventory', {
                    method: 'POST',
                    body: {
                        name: name,
                        description: description || undefined,
                        conditions: [treeData], // Wrap in array for backend compatibility
                        scope: 'global'
                    }
                })
            }

            await loadSavedInventories()
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
            const response = await apiCall<BackendConditionsResponse>(`inventory/by-name/${encodeURIComponent(inventoryName)}`)

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
            const updateData: { name: string; description: string | null } = {
                name,
                description: description || null,
            }

            await apiCall(`inventory/${inventoryId}`, {
                method: 'PUT',
                body: JSON.stringify(updateData),
            })

            // Reload inventories to reflect the change
            await loadSavedInventories()
        } catch (error) {
            console.error('Error updating inventory:', error)
            throw error
        }
    }

    const deleteInventory = async (inventoryId: number) => {
        try {
            await apiCall(`inventory/${inventoryId}`, {
                method: 'DELETE',
            })

            // Reload inventories to reflect the deletion
            await loadSavedInventories()
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
