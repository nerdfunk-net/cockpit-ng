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
        scope: string,
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
                    scope: scope
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

    const loadInventory = async (inventoryId: number): Promise<ConditionTree | null> => {
        try {
            // Make direct API call to load inventory by ID (not by name to avoid ambiguity)
            const response = await apiCall<{
                conditions: LogicalCondition[] | Array<{ version: number; tree: ConditionTree }>
            }>(`inventory/${inventoryId}`)

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

    const updateInventoryDetails = async (inventoryId: number, name: string, description: string, scope: string) => {
        try {
            // Only send name, description, and scope - don't send conditions
            const updateData: { name: string; description: string | undefined; scope: string } = {
                name,
                description: description || undefined,
                scope,
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

    const exportInventory = async (inventoryId: number) => {
        try {
            // Call the backend export endpoint
            const response = await apiCall<{
                version: number
                metadata: {
                    name: string
                    description: string
                    scope: string
                    exportedAt: string
                    exportedBy: string
                    originalId: number
                }
                conditionTree: ConditionTree
            }>(`inventory/export/${inventoryId}`)

            if (!response) {
                throw new Error('Failed to export inventory')
            }

            // Create a blob and download
            const blob = new Blob([JSON.stringify(response, null, 2)], { type: 'application/json' })
            const url = URL.createObjectURL(blob)
            const link = document.createElement('a')
            link.href = url
            const filename = `inventory-${response.metadata.name.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-${Date.now()}.json`
            link.download = filename
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
            URL.revokeObjectURL(url)
        } catch (error) {
            console.error('Error exporting inventory:', error)
            throw error
        }
    }

    const importInventory = async (file: File) => {
        try {
            // Read the file
            const text = await file.text()
            const importData = JSON.parse(text)

            // Validate the import data
            if (!importData.version || importData.version !== 2) {
                throw new Error('Invalid inventory file format. Expected version 2.')
            }

            if (!importData.conditionTree) {
                throw new Error('Invalid inventory file. Missing condition tree.')
            }

            if (!importData.metadata || !importData.metadata.name) {
                throw new Error('Invalid inventory file. Missing metadata.')
            }

            // Call backend import endpoint
            await apiCall('inventory/import', {
                method: 'POST',
                body: JSON.stringify({ import_data: importData }),
                headers: {
                    'Content-Type': 'application/json'
                }
            })

            // Reload inventories to show the new one
            await reloadInventories()
        } catch (error) {
            console.error('Error importing inventory:', error)
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
        deleteInventory,
        exportInventory,
        importInventory
    }
}
