import { useState, useEffect } from 'react'
import {
    DeviceInfo,
    ConditionTree,
    ConditionGroup,
    ConditionItem,
    LogicalCondition,
    BackendOperation,
    BackendCondition
} from '@/types/shared/device-selector'
import { useApi } from '@/hooks/use-api'

const EMPTY_DEVICES: DeviceInfo[] = []
const EMPTY_DEVICE_IDS: string[] = []

export function useDevicePreview(
    conditionTree: ConditionTree,
    initialDevices: DeviceInfo[] = EMPTY_DEVICES,
    selectedDeviceIds: string[] = EMPTY_DEVICE_IDS,
    onDevicesSelected?: (devices: DeviceInfo[], conditions: LogicalCondition[]) => void,
    onSelectionChange?: (selectedIds: string[], selectedDevices: DeviceInfo[]) => void
) {
    const { apiCall } = useApi()

    // Preview results
    const [previewDevices, setPreviewDevices] = useState<DeviceInfo[]>(initialDevices)
    const [totalDevices, setTotalDevices] = useState(initialDevices.length)
    const [operationsExecuted, setOperationsExecuted] = useState(0)
    const [showPreviewResults, setShowPreviewResults] = useState(initialDevices.length > 0)

    // Selection state
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(selectedDeviceIds))

    // Pagination
    const [currentPage, setCurrentPage] = useState(1)
    const [pageSize, setPageSize] = useState(20)

    // Loading states
    const [isLoadingPreview, setIsLoadingPreview] = useState(false)

    // Sync with initial props
    useEffect(() => {
        if (initialDevices.length > 0) {
            setPreviewDevices(initialDevices)
            setTotalDevices(initialDevices.length)
            setShowPreviewResults(true)
        }
    }, [initialDevices])

    useEffect(() => {
        setSelectedIds(new Set(selectedDeviceIds))
    }, [selectedDeviceIds])

    // Helper to convert tree back to flat conditions (for backward compatibility)
    const treeToFlatConditions = (tree: ConditionTree): LogicalCondition[] => {
        const flatConditions: LogicalCondition[] = []

        const flatten = (items: (ConditionItem | ConditionGroup)[], logic: string = 'AND') => {
            items.forEach((item, index) => {
                if ('type' in item && item.type === 'group') {
                    const group = item as ConditionGroup
                    flatten(group.items, group.internalLogic)
                } else {
                    const cond = item as ConditionItem
                    flatConditions.push({
                        field: cond.field,
                        operator: cond.operator,
                        value: cond.value,
                        logic: index === 0 ? 'AND' : logic
                    })
                }
            })
        }

        flatten(tree.items, tree.internalLogic)
        return flatConditions
    }

    // Build operations from tree structure
    const buildOperationsFromTree = (tree: ConditionTree | ConditionGroup): BackendOperation[] => {
        const items = tree.items

        if (items.length === 0) return []

        // Helper to convert a single item (condition or group) to backend format
        const convertItem = (item: ConditionItem | ConditionGroup): BackendOperation => {
            if ('type' in item && item.type === 'group') {
                const group = item as ConditionGroup
                const groupConditions: BackendCondition[] = []
                const nestedOps: BackendOperation[] = []

                group.items.forEach(subItem => {
                    if ('type' in subItem && subItem.type === 'group') {
                        const subGroup = subItem as ConditionGroup
                        const convertedSubGroup = convertItem(subGroup)

                        if (subGroup.logic === 'NOT') {
                            convertedSubGroup.operation_type = 'NOT'
                        }

                        nestedOps.push(convertedSubGroup)
                    } else {
                        const cond = subItem as ConditionItem
                        groupConditions.push({
                            field: cond.field,
                            operator: cond.operator,
                            value: cond.value
                        })
                    }
                })

                return {
                    operation_type: group.internalLogic,
                    conditions: groupConditions,
                    nested_operations: nestedOps,
                    _parentLogic: group.logic
                }
            } else {
                const cond = item as ConditionItem
                return {
                    operation_type: 'AND',
                    conditions: [{
                        field: cond.field,
                        operator: cond.operator,
                        value: cond.value
                    }],
                    nested_operations: []
                }
            }
        }

        const internalLogic = 'internalLogic' in tree ? tree.internalLogic : 'AND'
        const regularItems: BackendOperation[] = []
        const notItems: BackendOperation[] = []

        items.forEach(item => {
            const converted = convertItem(item)

            if ('type' in item && item.type === 'group' && (item as ConditionGroup).logic === 'NOT') {
                converted.operation_type = 'NOT'
                notItems.push(converted)
            } else {
                regularItems.push(converted)
            }
        })

        const operations: BackendOperation[] = []

        if (regularItems.length > 0) {
            if (regularItems.length === 1) {
                const firstItem = regularItems[0]
                if (firstItem) {
                    operations.push(firstItem)
                }
            } else {
                const rootConditions: BackendCondition[] = []
                const nestedOps: BackendOperation[] = []

                regularItems.forEach(item => {
                    if (item.conditions.length > 1 || item.nested_operations.length > 0) {
                        nestedOps.push(item)
                    } else if (item.conditions.length === 1) {
                        rootConditions.push(...item.conditions)
                    }
                })

                operations.push({
                    operation_type: internalLogic,
                    conditions: rootConditions,
                    nested_operations: nestedOps
                })
            }
        }

        operations.push(...notItems)

        return operations
    }

    const loadPreview = async () => {
        if (conditionTree.items.length === 0) {
            alert('Please add at least one condition.')
            return
        }

        setIsLoadingPreview(true)
        try {
            const operations = buildOperationsFromTree(conditionTree)

            const response = await apiCall<{
                devices: DeviceInfo[]
                total_count: number
                operations_executed: number
            }>('inventory/preview', {
                method: 'POST',
                body: { operations }
            })

            setPreviewDevices(response.devices)
            setTotalDevices(response.total_count)
            setOperationsExecuted(response.operations_executed)
            setShowPreviewResults(true)
            setCurrentPage(1)

            if (onDevicesSelected) {
                const flatConditions = treeToFlatConditions(conditionTree)
                onDevicesSelected(response.devices, flatConditions)
            }
        } catch (error) {
            console.error('Error previewing results:', error)
            alert('Error previewing results: ' + (error as Error).message)
        } finally {
            setIsLoadingPreview(false)
        }
    }

    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            const allIds = new Set(previewDevices.map(d => d.id))
            setSelectedIds(allIds)
            if (onSelectionChange) {
                onSelectionChange(Array.from(allIds), previewDevices)
            }
        } else {
            setSelectedIds(new Set())
            if (onSelectionChange) {
                onSelectionChange([], [])
            }
        }
    }

    const handleSelectDevice = (deviceId: string, checked: boolean) => {
        const newSelectedIds = new Set(selectedIds)
        if (checked) {
            newSelectedIds.add(deviceId)
        } else {
            newSelectedIds.delete(deviceId)
        }
        setSelectedIds(newSelectedIds)

        if (onSelectionChange) {
            const selectedDevices = previewDevices.filter(d => newSelectedIds.has(d.id))
            onSelectionChange(Array.from(newSelectedIds), selectedDevices)
        }
    }

    // Pagination calculations
    const totalPages = Math.ceil(previewDevices.length / pageSize)
    const startIndex = (currentPage - 1) * pageSize
    const endIndex = Math.min(startIndex + pageSize, previewDevices.length)
    const currentPageDevices = previewDevices.slice(startIndex, endIndex)

    const handlePageChange = (page: number) => {
        setCurrentPage(page)
    }

    return {
        previewDevices,
        totalDevices,
        operationsExecuted,
        showPreviewResults,
        setShowPreviewResults,
        isLoadingPreview,
        currentPage,
        setCurrentPage,
        pageSize,
        setPageSize,
        selectedIds,
        setSelectedIds,
        currentPageDevices,
        totalPages,
        handlePageChange,
        handleSelectAll,
        handleSelectDevice,
        loadPreview,
        treeToFlatConditions
    }
}
