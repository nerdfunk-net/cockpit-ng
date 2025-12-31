'use client'

import { useState, useEffect, useCallback } from 'react'

// Define default arrays outside component to prevent re-creating on every render
const EMPTY_CONDITIONS: LogicalCondition[] = []
const EMPTY_DEVICES: DeviceInfo[] = []
const EMPTY_DEVICE_IDS: string[] = []
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Plus,
  Play,
  RotateCcw,
  X,
  Filter,
  Database,
  ChevronLeft,
  ChevronRight,
  Save,
  FolderOpen,
  Settings
} from 'lucide-react'
import { useApi } from '@/hooks/use-api'
import { ManageInventoryDialog } from '@/components/features/network/automation/ansible-inventory/dialogs/manage-inventory-dialog'

// Legacy flat condition structure (kept for backward compatibility)
export interface LogicalCondition {
  field: string
  operator: string
  value: string
  logic: string
}

// New tree-based structure for grouped logical expressions
export interface ConditionItem {
  id: string  // Unique identifier for React keys
  field: string
  operator: string
  value: string
}

export interface ConditionGroup {
  id: string  // Unique identifier for React keys
  type: 'group'
  logic: 'AND' | 'OR' | 'NOT'  // Logic operator BEFORE this group
  internalLogic: 'AND' | 'OR'  // Logic operator WITHIN this group
  items: (ConditionItem | ConditionGroup)[]
}

export interface ConditionTree {
  type: 'root'
  internalLogic: 'AND' | 'OR'  // Root level logic
  items: (ConditionItem | ConditionGroup)[]
}

export interface DeviceInfo {
  id: string
  name?: string | null // Name can be null/undefined for unnamed devices
  serial?: string | null
  location?: string
  role?: string
  device_type?: { name: string } | string
  manufacturer?: string
  platform?: { name: string } | string
  primary_ip4?: { address: string } | string
  status?: string
  tags: string[]
}

interface FieldOption {
  value: string
  label: string
}

interface LocationItem {
  id: string
  name: string
  hierarchicalPath: string
  parent?: { id: string }
}

interface CustomField {
  name: string
  label: string
  type: string
}

interface DeviceSelectorProps {
  onDevicesSelected?: (devices: DeviceInfo[], conditions: LogicalCondition[]) => void
  showActions?: boolean
  showSaveLoad?: boolean
  initialConditions?: LogicalCondition[]
  initialDevices?: DeviceInfo[]
  enableSelection?: boolean
  selectedDeviceIds?: string[]
  onSelectionChange?: (selectedIds: string[], selectedDevices: DeviceInfo[]) => void
}

// Helper function to generate unique IDs
const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

// Initial empty tree
const createEmptyTree = (): ConditionTree => ({
  type: 'root',
  internalLogic: 'AND',
  items: []
})

const EMPTY_TREE = createEmptyTree()

export function DeviceSelector({
  onDevicesSelected,
  showActions = true,
  showSaveLoad = true,
  initialConditions = EMPTY_CONDITIONS,
  initialDevices = EMPTY_DEVICES,
  enableSelection = false,
  selectedDeviceIds = EMPTY_DEVICE_IDS,
  onSelectionChange
}: DeviceSelectorProps) {
  const { apiCall } = useApi()

  // NEW: Tree-based condition state (primary)
  const [conditionTree, setConditionTree] = useState<ConditionTree>(EMPTY_TREE)

  // LEGACY: Keep for backward compatibility with saved inventories
  const [conditions, setConditions] = useState<LogicalCondition[]>(initialConditions)

  // Current input state for adding new conditions
  const [currentField, setCurrentField] = useState('')
  const [currentOperator, setCurrentOperator] = useState('equals')
  const [currentValue, setCurrentValue] = useState('')
  const [currentLogic, setCurrentLogic] = useState('AND')

  // Track current editing context (which group we're adding to)
  const [currentGroupPath, setCurrentGroupPath] = useState<string[]>([]) // Array of group IDs representing path

  // Field options and values
  const [fieldOptions, setFieldOptions] = useState<FieldOption[]>([])
  const [operatorOptions, setOperatorOptions] = useState<FieldOption[]>([])
  const [logicOptions, setLogicOptions] = useState<FieldOption[]>([])
  const [fieldValues, setFieldValues] = useState<FieldOption[]>([])
  const [customFields, setCustomFields] = useState<CustomField[]>([])

  // Location handling
  const [locations, setLocations] = useState<LocationItem[]>([])
  const [locationSearchValue, setLocationSearchValue] = useState('')
  const [showLocationDropdown, setShowLocationDropdown] = useState(false)
  const [_selectedLocationValue, setSelectedLocationValue] = useState('')

  // Preview results
  const [previewDevices, setPreviewDevices] = useState<DeviceInfo[]>(initialDevices)
  const [totalDevices, setTotalDevices] = useState(initialDevices.length)
  const [operationsExecuted, setOperationsExecuted] = useState(0)
  const [showPreviewResults, setShowPreviewResults] = useState(initialDevices.length > 0)

  // Selection state (for checkbox feature)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(selectedDeviceIds))

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)

  // Loading states
  const [isLoadingPreview, setIsLoadingPreview] = useState(false)
  const [isLoadingFieldValues, setIsLoadingFieldValues] = useState(false)
  const [isLoadingCustomFields, setIsLoadingCustomFields] = useState(false)

  // Selected custom field (when 'custom_fields' is chosen as field type)
  const [selectedCustomField, setSelectedCustomField] = useState('')

  // Save/Load/Manage Inventory modals
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [showLoadModal, setShowLoadModal] = useState(false)
  const [showManageModal, setShowManageModal] = useState(false)
  // Inventory repositories no longer used - using database storage
  // const [inventoryRepositories, setInventoryRepositories] = useState<Array<{id: number, name: string, url: string, branch: string}>>([])
  // const [selectedInventoryRepo, setSelectedInventoryRepo] = useState<number | null>(null)
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
  const [saveInventoryName, setSaveInventoryName] = useState('')
  const [saveInventoryDescription, setSaveInventoryDescription] = useState('')
  const [isSavingInventory, setIsSavingInventory] = useState(false)
  const [isLoadingInventories, setIsLoadingInventories] = useState(false)
  const [showOverwriteConfirm, setShowOverwriteConfirm] = useState(false)
  const [inventoryToOverwrite, setInventoryToOverwrite] = useState<string | null>(null)

  // Sync with initial props when they change
  useEffect(() => {
    if (initialConditions.length > 0) {
      setConditions(initialConditions)
    }
  }, [initialConditions])

  useEffect(() => {
    if (initialDevices.length > 0) {
      setPreviewDevices(initialDevices)
      setTotalDevices(initialDevices.length)
      setShowPreviewResults(true)
    }
  }, [initialDevices])

  // Sync selected device IDs
  useEffect(() => {
    setSelectedIds(new Set(selectedDeviceIds))
  }, [selectedDeviceIds])

  // Selection handlers
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      // Select all devices across all pages
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

  const loadFieldOptions = useCallback(async () => {
    try {
      const response = await apiCall<{
        fields: FieldOption[]
        operators: FieldOption[]
        logical_operations: FieldOption[]
      }>('ansible-inventory/field-options')

      setFieldOptions(response.fields)
      setOperatorOptions(response.operators)

      const modifiedLogicOptions = response.logical_operations.map(option => {
        if (option.value === 'not') {
          return { ...option, label: '& NOT' }
        }
        return option
      })
      setLogicOptions(modifiedLogicOptions)
    } catch (error) {
      console.error('Error loading field options:', error)
    }
  }, [apiCall])

  useEffect(() => {
    loadFieldOptions()
  }, [loadFieldOptions])

  // Inventory repositories no longer needed - using database storage
  // const loadInventoryRepositories = async () => { ... }

  const loadSavedInventories = async () => {
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
  }

  const handleSaveInventory = async () => {
    if (!saveInventoryName.trim()) {
      alert('Please enter an inventory name.')
      return
    }

    if (conditions.length === 0) {
      alert('Please add at least one condition before saving.')
      return
    }

    const existingInventory = savedInventories.find(inv => inv.name === saveInventoryName)
    if (existingInventory && !showOverwriteConfirm) {
      setInventoryToOverwrite(saveInventoryName)
      setShowOverwriteConfirm(true)
      return
    }

    setIsSavingInventory(true)
    try {
      if (existingInventory) {
        // Update existing inventory
        await apiCall(`inventory/${existingInventory.id}`, {
          method: 'PUT',
          body: {
            description: saveInventoryDescription || undefined,
            conditions: conditions,
          }
        })
      } else {
        // Create new inventory
        await apiCall('inventory', {
          method: 'POST',
          body: {
            name: saveInventoryName,
            description: saveInventoryDescription || undefined,
            conditions: conditions,
            scope: 'global'
          }
        })
      }

      alert(`Inventory "${saveInventoryName}" saved successfully!`)
      setSaveInventoryName('')
      setSaveInventoryDescription('')
      setShowSaveModal(false)
      setShowOverwriteConfirm(false)
      setInventoryToOverwrite(null)

      await loadSavedInventories()
    } catch (error) {
      console.error('Error saving inventory:', error)
      alert('Error saving inventory: ' + (error as Error).message)
    } finally {
      setIsSavingInventory(false)
    }
  }

  const handleLoadInventory = async (inventoryName: string) => {
    try {
      const response = await apiCall<{
        id: number
        name: string
        description?: string
        conditions: LogicalCondition[]
        scope: string
        created_by: string
        created_at?: string
        updated_at?: string
      }>(`inventory/by-name/${encodeURIComponent(inventoryName)}`)

      setConditions(response.conditions)
      setShowPreviewResults(false)
      setPreviewDevices([])
      setShowLoadModal(false)
    } catch (error) {
      console.error('Error loading inventory:', error)
      alert('Error loading inventory: ' + (error as Error).message)
    }
  }

  const openSaveModal = async () => {
    if (conditions.length === 0) {
      alert('Please add at least one condition before saving.')
      return
    }

    setShowSaveModal(true)
    // Load saved inventories from database
    await loadSavedInventories()
  }

  const openLoadModal = async () => {
    setShowLoadModal(true)
    // Load saved inventories from database
    await loadSavedInventories()
  }

  const openManageModal = async () => {
    setShowManageModal(true)
    // Load saved inventories from database
    await loadSavedInventories()
  }

  const handleUpdateInventory = async (inventoryId: number, name: string, description: string) => {
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
      alert('Inventory updated successfully!')
    } catch (error) {
      console.error('Error updating inventory:', error)
      alert('Error updating inventory: ' + (error as Error).message)
      throw error
    }
  }

  const handleDeleteInventory = async (inventoryId: number, inventoryName: string) => {
    try {
      await apiCall(`inventory/${inventoryId}`, {
        method: 'DELETE',
      })

      // Reload inventories to reflect the deletion
      await loadSavedInventories()
      alert(`Inventory "${inventoryName}" deleted successfully!`)
    } catch (error) {
      console.error('Error deleting inventory:', error)
      alert('Error deleting inventory: ' + (error as Error).message)
      throw error
    }
  }

  const loadCustomFields = async () => {
    try {
      const response = await apiCall<{ custom_fields: CustomField[] }>('ansible-inventory/custom-fields')
      setCustomFields(response.custom_fields)
    } catch (error) {
      console.error('Error loading custom fields:', error)
      setCustomFields([])
    }
  }

  const loadFieldValues = async (fieldName: string) => {
    if (!fieldName || fieldName === 'custom_fields' || fieldName === 'has_primary') return

    setIsLoadingFieldValues(true)
    try {
      if (fieldName === 'location') {
        const response = await apiCall<LocationItem[]>('nautobot/locations')
        setLocations(response)
        buildLocationHierarchy(response)
        setIsLoadingFieldValues(false)
        return
      } else {
        const response = await apiCall<{
          field: string
          values: FieldOption[]
          input_type: string
        }>(`ansible-inventory/field-values/${fieldName}`)
        setFieldValues(response.values)
      }
    } catch (error) {
      console.error(`Error loading field values for ${fieldName}:`, error)
      setFieldValues([])
    } finally {
      setIsLoadingFieldValues(false)
    }
  }

  const buildLocationHierarchy = (locationData: LocationItem[]) => {
    const locationMap = new Map(locationData.map(loc => [loc.id, loc]))

    locationData.forEach(location => {
      const path: string[] = []
      let current: LocationItem | null = location

      while (current) {
        path.unshift(current.name)
        if (current.parent?.id) {
          current = locationMap.get(current.parent.id) || null
        } else {
          current = null
        }
      }

      location.hierarchicalPath = path.join(' → ')
    })

    locationData.sort((a, b) => a.hierarchicalPath.localeCompare(b.hierarchicalPath))
    setLocations(locationData)
  }

  const handleFieldChange = async (fieldName: string) => {
    setCurrentField(fieldName)
    setCurrentValue('')
    setLocationSearchValue('')
    setSelectedLocationValue('')
    setFieldValues([])
    setSelectedCustomField('')

    if (fieldName === 'custom_fields') {
      // Load custom fields for the inline dropdown
      setIsLoadingCustomFields(true)
      await loadCustomFields()
      setIsLoadingCustomFields(false)
      return
    }

    updateOperatorOptions(fieldName)

    if (fieldName) {
      await loadFieldValues(fieldName)
    }
  }

  const handleCustomFieldSelect = async (customFieldValue: string) => {
    setSelectedCustomField(customFieldValue)
    // Set the actual field to the cf_ prefixed value
    setCurrentField(customFieldValue)
    setCurrentValue('')
    setFieldValues([])
    updateOperatorOptions(customFieldValue)
    
    // Load field values - for 'select' type custom fields, this will return the available choices
    if (customFieldValue) {
      await loadFieldValues(customFieldValue)
    }
  }

  const handleOperatorChange = async (operator: string) => {
    setCurrentOperator(operator)
  }

  const updateOperatorOptions = (fieldName: string) => {
    const restrictedFields = ['role', 'tag', 'device_type', 'manufacturer', 'platform', 'location', 'has_primary']
    const isCustomField = fieldName && fieldName.startsWith('cf_')

    if (restrictedFields.includes(fieldName)) {
      setOperatorOptions([{ value: 'equals', label: 'Equals' }])
      setCurrentOperator('equals')
    } else if (isCustomField || fieldName === 'name') {
      setOperatorOptions([
        { value: 'equals', label: 'Equals' },
        { value: 'contains', label: 'Contains' }
      ])
    } else {
      setOperatorOptions([
        { value: 'equals', label: 'Equals' },
        { value: 'contains', label: 'Contains' }
      ])
    }
  }

  // NEW: Helper to add condition to tree
  const addConditionToTree = () => {
    if (!currentField || !currentValue) {
      alert('Please select a field and enter a value.')
      return
    }

    const newCondition: ConditionItem = {
      id: generateId(),
      field: currentField,
      operator: currentOperator,
      value: currentValue
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

    // Reset input fields
    setCurrentField('')
    setCurrentOperator('equals')
    setCurrentValue('')
    setCurrentLogic('AND')
    setLocationSearchValue('')
    setSelectedLocationValue('')
    setFieldValues([])
  }

  // NEW: Add a new group to the tree
  const addGroup = () => {
    const newGroup: ConditionGroup = {
      id: generateId(),
      type: 'group',
      logic: currentLogic as 'AND' | 'OR' | 'NOT',
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
  }

  // NEW: Remove item from tree by ID
  const removeItemFromTree = (itemId: string) => {
    setConditionTree(prevTree => {
      const removeFromItems = (items: (ConditionItem | ConditionGroup)[]): (ConditionItem | ConditionGroup)[] => {
        return items.filter(item => {
          if (item.id === itemId) return false
          if ('type' in item && item.type === 'group') {
            // Recursively remove from group items
            const group = item as ConditionGroup
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

    if (conditionTree.items.length === 0) {
      setShowPreviewResults(false)
    }
  }

  // NEW: Update group's internal logic
  const updateGroupLogic = (groupId: string, newLogic: 'AND' | 'OR') => {
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
  }

  // NEW: Helper to find path to a specific group
  const findGroupPath = (groupId: string, items: (ConditionItem | ConditionGroup)[] = conditionTree.items, currentPath: string[] = []): string[] | null => {
    for (const item of items) {
      if ('type' in item && item.type === 'group') {
        if (item.id === groupId) {
          return [...currentPath, groupId]
        }
        const found = findGroupPath(groupId, item.items, [...currentPath, item.id])
        if (found) return found
      }
    }
    return null
  }

  // NEW: Set target group for adding conditions
  const setTargetGroup = (groupId: string | null) => {
    if (groupId === null) {
      setCurrentGroupPath([])
    } else {
      const path = findGroupPath(groupId)
      if (path) {
        setCurrentGroupPath(path)
      }
    }
  }

  // NEW: Get current target display name
  const getCurrentTargetName = () => {
    if (currentGroupPath.length === 0) {
      return 'Root'
    }
    return `Group ${currentGroupPath.length}`
  }

  // LEGACY: Keep for backward compatibility
  const addCondition = () => {
    if (!currentField || !currentValue) {
      alert('Please select a field and enter a value.')
      return
    }

    const condition: LogicalCondition = {
      field: currentField,
      operator: currentOperator,
      value: currentValue,
      logic: currentLogic
    }

    setConditions([...conditions, condition])

    setCurrentField('')
    setCurrentOperator('equals')
    setCurrentValue('')
    setCurrentLogic('AND')
    setLocationSearchValue('')
    setSelectedLocationValue('')
    setFieldValues([])
  }

  const removeCondition = (index: number) => {
    const newConditions = conditions.filter((_, i) => i !== index)
    setConditions(newConditions)

    if (newConditions.length === 0) {
      setShowPreviewResults(false)
    }
  }

  const clearAllConditions = () => {
    setConditions([])
    setCurrentField('')
    setCurrentOperator('equals')
    setCurrentValue('')
    setCurrentLogic('AND')
    setLocationSearchValue('')
    setSelectedLocationValue('')
    setFieldValues([])
    setPreviewDevices([])
    setTotalDevices(0)
    setOperationsExecuted(0)
    setShowPreviewResults(false)
  }

  const buildOperationsFromConditions = () => {
    if (conditions.length === 0) return []

    if (conditions.length === 1 && conditions[0]) {
      return [{
        operation_type: 'AND',
        conditions: [{
          field: conditions[0].field,
          operator: conditions[0].operator,
          value: conditions[0].value
        }],
        nested_operations: []
      }]
    }

    const andConditions: Array<{field: string, operator: string, value: string}> = []
    const orConditions: Array<{field: string, operator: string, value: string}> = []
    const notConditions: Array<{field: string, operator: string, value: string}> = []

    conditions.forEach((condition, index) => {
      const conditionData = {
        field: condition.field,
        operator: condition.operator,
        value: condition.value
      }

      if (index === 0) {
        andConditions.push(conditionData)
      } else {
        switch (condition.logic) {
          case 'AND':
            andConditions.push(conditionData)
            break
          case 'OR':
            orConditions.push(conditionData)
            break
          case 'NOT':
            notConditions.push(conditionData)
            break
        }
      }
    })

    const operations = []

    if (orConditions.length > 0) {
      operations.push({
        operation_type: 'OR',
        conditions: [...andConditions, ...orConditions],
        nested_operations: []
      })
    } else if (andConditions.length > 0) {
      operations.push({
        operation_type: 'AND',
        conditions: andConditions,
        nested_operations: []
      })
    }

    notConditions.forEach(condition => {
      operations.push({
        operation_type: 'NOT',
        conditions: [condition],
        nested_operations: []
      })
    })

    return operations
  }

  // NEW: Build operations from tree structure
  const buildOperationsFromTree = (tree: ConditionTree | ConditionGroup): any[] => {
    const items = tree.items

    if (items.length === 0) return []

    // Helper to convert a single item (condition or group) to backend format
    const convertItem = (item: ConditionItem | ConditionGroup) => {
      if ('type' in item && item.type === 'group') {
        // This is a group - recursively convert it
        const group = item as ConditionGroup
        const groupConditions: any[] = []
        const nestedOps: any[] = []

        group.items.forEach(subItem => {
          if ('type' in subItem && subItem.type === 'group') {
            // Nested group
            const subGroupOps = buildOperationsFromTree(subItem as ConditionGroup)
            nestedOps.push(...subGroupOps)
          } else {
            // Regular condition
            const cond = subItem as ConditionItem
            groupConditions.push({
              field: cond.field,
              operator: cond.operator,
              value: cond.value
            })
          }
        })

        return {
          operation_type: group.internalLogic,  // AND or OR within the group
          conditions: groupConditions,
          nested_operations: nestedOps,
          _parentLogic: group.logic  // Store for later processing
        }
      } else {
        // This is a simple condition
        const cond = item as ConditionItem
        return {
          operation_type: 'AND',  // Single conditions are wrapped in AND
          conditions: [{
            field: cond.field,
            operator: cond.operator,
            value: cond.value
          }],
          nested_operations: []
        }
      }
    }

    // Convert root level logic
    const internalLogic = 'internalLogic' in tree ? tree.internalLogic : 'AND'

    // Separate items by their parent logic (AND, OR, NOT)
    const regularItems: any[] = []
    const notItems: any[] = []

    items.forEach(item => {
      const converted = convertItem(item)

      if ('type' in item && item.type === 'group' && (item as ConditionGroup).logic === 'NOT') {
        // This is a NOT group
        converted.operation_type = 'NOT'
        notItems.push(converted)
      } else {
        regularItems.push(converted)
      }
    })

    const operations: any[] = []

    // Add main operation with all regular items
    if (regularItems.length > 0) {
      if (regularItems.length === 1) {
        operations.push(regularItems[0])
      } else {
        // Separate root-level conditions from groups
        const rootConditions: any[] = []
        const nestedOps: any[] = []

        regularItems.forEach(item => {
          // Check if this item represents a group or a single condition
          if (item.conditions.length > 1 || item.nested_operations.length > 0) {
            // This is a group - add it as a nested operation
            nestedOps.push(item)
          } else if (item.conditions.length === 1) {
            // This is a single condition - add to root conditions
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

    // Add NOT operations
    operations.push(...notItems)

    return operations
  }

  const previewResults = async () => {
    // Check if tree has any items
    if (conditionTree.items.length === 0) {
      alert('Please add at least one condition.')
      return
    }

    setIsLoadingPreview(true)
    try {
      // Use NEW tree-based builder
      const operations = buildOperationsFromTree(conditionTree)

      console.log('Generated operations from tree:', JSON.stringify(operations, null, 2))

      const response = await apiCall<{
        devices: DeviceInfo[]
        total_count: number
        operations_executed: number
      }>('ansible-inventory/preview', {
        method: 'POST',
        body: { operations }
      })

      setPreviewDevices(response.devices)
      setTotalDevices(response.total_count)
      setOperationsExecuted(response.operations_executed)
      setShowPreviewResults(true)
      setCurrentPage(1)

      if (onDevicesSelected) {
        // Convert tree to flat conditions for backward compatibility
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

  const getFieldLabel = (field: string) => {
    const option = fieldOptions.find(opt => opt.value === field)
    return option?.label || field
  }

  const getLogicBadgeColor = (logic: string) => {
    switch (logic) {
      case 'AND': return 'bg-green-100 text-green-800'
      case 'OR': return 'bg-yellow-100 text-yellow-800'
      case 'AND NOT': return 'bg-red-100 text-red-800'
      default: return 'bg-blue-100 text-blue-800'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'active': return 'bg-green-100 text-green-800'
      case 'planned': return 'bg-blue-100 text-blue-800'
      case 'staged': return 'bg-yellow-100 text-yellow-800'
      case 'failed': return 'bg-red-100 text-red-800'
      case 'offline': return 'bg-gray-100 text-gray-800'
      default: return 'bg-blue-100 text-blue-800'
    }
  }

  const formatDeviceValue = (value: string | { name?: string; address?: string } | null | undefined) => {
    if (!value) return 'N/A'
    if (typeof value === 'object') {
      return value.name || value.address?.split('/')[0] || 'N/A'
    }
    return value
  }

  // Pagination calculations
  const totalPages = Math.ceil(previewDevices.length / pageSize)
  const startIndex = (currentPage - 1) * pageSize
  const endIndex = Math.min(startIndex + pageSize, previewDevices.length)
  const currentPageDevices = previewDevices.slice(startIndex, endIndex)

  // Recursive function to render tree items (conditions and groups)
  const renderTreeItem = (item: ConditionItem | ConditionGroup, isFirst: boolean): React.ReactNode => {
    if ('type' in item && item.type === 'group') {
      // This is a group
      const group = item as ConditionGroup
      const isActiveTarget = currentGroupPath.length > 0 && currentGroupPath[currentGroupPath.length - 1] === group.id
      return (
        <div
          className={`border-l-4 pl-4 py-2 rounded-r cursor-pointer transition-colors ${
            isActiveTarget
              ? 'border-blue-500 bg-blue-50/70'
              : 'border-purple-300 bg-purple-50/50 hover:bg-purple-100/50'
          }`}
          onClick={() => setTargetGroup(group.id)}
          title="Click to add conditions to this group"
        >
          {/* Group header with logic operators */}
          <div className="flex items-center gap-2 mb-2">
            {!isFirst && (
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
                updateGroupLogic(group.id, group.internalLogic === 'AND' ? 'OR' : 'AND')
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
                removeItemFromTree(group.id)
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
                  {renderTreeItem(subItem, subIndex === 0)}
                </div>
              ))
            )}
          </div>
        </div>
      )
    } else {
      // This is a simple condition
      const condition = item as ConditionItem
      return (
        <div className="flex items-center gap-2">
          <div className="inline-flex items-center space-x-2 px-3 py-1.5 bg-blue-100 text-blue-800 rounded text-sm">
            <span className="font-medium">{getFieldLabel(condition.field)}</span>
            <span className="text-gray-600">{condition.operator}</span>
            <span className="font-medium">&quot;{condition.value}&quot;</span>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => removeItemFromTree(condition.id)}
              className="h-4 w-4 p-0 hover:bg-blue-200"
              title="Delete condition"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        </div>
      )
    }
  }

  return (
    <div className="space-y-6">
      {/* Condition Builder */}
      <div className="shadow-lg border-0 p-0 bg-white rounded-lg">
        <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4 flex items-center justify-between rounded-t-lg">
          <div className="flex items-center space-x-2">
            <Filter className="h-4 w-4" />
            <span className="text-sm font-medium">Device Filter</span>
          </div>
          <div className="text-xs text-blue-100">
            Build logical operations to filter devices
          </div>
        </div>
        <div className="p-6 bg-gradient-to-b from-white to-gray-50">
          {/* Target Location Indicator */}
          <div className="mb-4 flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center gap-2 flex-1">
              <span className="text-sm font-medium text-blue-900">Adding conditions to:</span>
              <Badge variant="outline" className="bg-white">
                {getCurrentTargetName()}
              </Badge>
            </div>
            {currentGroupPath.length > 0 && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setTargetGroup(null)}
                className="h-7 text-xs text-blue-700 hover:text-blue-900 hover:bg-blue-100"
              >
                <ChevronLeft className="h-3 w-3 mr-1" />
                Back to Root
              </Button>
            )}
          </div>

          <div className={`grid grid-cols-1 gap-4 ${currentField === 'custom_fields' || selectedCustomField ? 'md:grid-cols-[1fr_1fr_1fr_2fr_1fr_auto]' : 'md:grid-cols-[1fr_1fr_2fr_1fr_auto]'}`}>
            {/* Field Selection */}
            <div className="space-y-2">
              <Label htmlFor="field">Field</Label>
              <Select value={currentField === 'custom_fields' || selectedCustomField ? 'custom_fields' : currentField} onValueChange={handleFieldChange}>
                <SelectTrigger className="border-2 border-slate-300 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 shadow-sm">
                  <SelectValue placeholder="Select field..." />
                </SelectTrigger>
                <SelectContent>
                  {fieldOptions.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Custom Field Selection - shown when 'custom_fields' is selected */}
            {(currentField === 'custom_fields' || selectedCustomField) && (
              <div className="space-y-2">
                <Label htmlFor="custom-field">Custom Field</Label>
                <Select value={selectedCustomField} onValueChange={handleCustomFieldSelect} disabled={isLoadingCustomFields}>
                  <SelectTrigger className="border-2 border-slate-300 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 shadow-sm">
                    <SelectValue placeholder={isLoadingCustomFields ? "Loading..." : "Select custom field..."} />
                  </SelectTrigger>
                  <SelectContent>
                    {customFields.map(field => (
                      <SelectItem key={field.name} value={`cf_${String(field.name)}`}>
                        {String(field.label || field.name)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Operator Selection */}
            <div className="space-y-2">
              <Label htmlFor="operator">Operator</Label>
              <Select value={currentOperator} onValueChange={handleOperatorChange}>
                <SelectTrigger className="border-2 border-slate-300 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 shadow-sm">
                  <SelectValue placeholder="Select operator..." />
                </SelectTrigger>
                <SelectContent>
                  {operatorOptions.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Value Input */}
            <div className="space-y-2">
              <Label htmlFor="value">Value</Label>
              {currentField === 'has_primary' ? (
                <Select value={currentValue} onValueChange={setCurrentValue}>
                  <SelectTrigger className="border-2 border-slate-300 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 shadow-sm">
                    <SelectValue placeholder="Select value..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="True">True</SelectItem>
                    <SelectItem value="False">False</SelectItem>
                  </SelectContent>
                </Select>
              ) : currentField === 'location' ? (
                <div className="relative">
                  <Input
                    placeholder="Search locations..."
                    value={locationSearchValue}
                    onChange={(e) => {
                      setLocationSearchValue(e.target.value)
                      setShowLocationDropdown(true)
                    }}
                    onFocus={() => setShowLocationDropdown(true)}
                    className="border-2 border-slate-300 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 shadow-sm"
                  />
                  {showLocationDropdown && (
                    <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
                      {locations
                        .filter(loc =>
                          loc.hierarchicalPath.toLowerCase().includes(locationSearchValue.toLowerCase())
                        )
                        .map(location => (
                          <div
                            key={location.id}
                            className="px-3 py-2 hover:bg-gray-100 cursor-pointer text-sm"
                            onClick={() => {
                              setLocationSearchValue(location.hierarchicalPath)
                              setCurrentValue(location.name)
                              setSelectedLocationValue(location.name)
                              setShowLocationDropdown(false)
                            }}
                          >
                            {location.hierarchicalPath}
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              ) : fieldValues.length > 0 ? (
                <Select value={currentValue} onValueChange={setCurrentValue}>
                  <SelectTrigger className="border-2 border-slate-300 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 shadow-sm">
                    <SelectValue placeholder="Choose value..." />
                  </SelectTrigger>
                  <SelectContent>
                    {fieldValues.map(option => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  placeholder={currentField ? `Enter ${currentField}...` : 'Select a field first'}
                  value={currentValue}
                  onChange={(e) => setCurrentValue(e.target.value)}
                  disabled={!currentField || isLoadingFieldValues}
                  className="border-2 border-slate-300 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 shadow-sm disabled:bg-slate-100 disabled:border-slate-200"
                />
              )}
            </div>

            {/* Logic Selection */}
            <div className="space-y-2">
              <Label htmlFor="logic">Logic</Label>
              <Select value={currentLogic} onValueChange={setCurrentLogic}>
                <SelectTrigger className="border-2 border-slate-300 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 shadow-sm">
                  <SelectValue placeholder="Select logic..." />
                </SelectTrigger>
                <SelectContent>
                  {logicOptions.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2">
              <Label>&nbsp;</Label>
              <div className="flex space-x-2">
                <Button onClick={addConditionToTree} size="sm" title="Add Condition">
                  <Plus className="h-4 w-4" />
                </Button>
                <Button onClick={addGroup} size="sm" variant="secondary" title="Add Group">
                  <Plus className="h-4 w-4 mr-1" />
                  <span className="text-xs">Group</span>
                </Button>
                <Button onClick={() => setConditionTree(createEmptyTree())} variant="outline" size="sm" title="Clear All">
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* NEW: Tree-based Conditions Display */}
          <div className="mt-6">
            <Label className="text-base font-medium">Logical Expression</Label>
            <div className="mt-2 p-4 bg-gray-50 rounded-lg min-h-[60px]">
              {conditionTree.items.length === 0 ? (
                <p className="text-gray-500 text-sm italic">
                  No conditions added yet. Add conditions or groups above to filter devices.
                </p>
              ) : (
                <div className="space-y-2">
                  {/* Root level logic indicator */}
                  <div className="text-xs text-gray-500 mb-2">
                    Root logic: <Badge variant="outline">{conditionTree.internalLogic}</Badge>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="ml-2 h-5 text-xs"
                      onClick={() => {
                        setConditionTree(prev => ({
                          ...prev,
                          internalLogic: prev.internalLogic === 'AND' ? 'OR' : 'AND'
                        }))
                      }}
                    >
                      Toggle
                    </Button>
                  </div>
                  {conditionTree.items.map((item, index) => (
                    <div key={item.id}>
                      {renderTreeItem(item, index === 0)}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          {showActions && (
            <div className="flex justify-start gap-2 mt-4">
              <Button
                onClick={previewResults}
                disabled={conditionTree.items.length === 0 || isLoadingPreview}
                className="flex items-center space-x-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white border-0"
              >
                <Play className="h-4 w-4" />
                <span>{isLoadingPreview ? 'Loading...' : 'Preview Results'}</span>
              </Button>
              {showSaveLoad && (
                <>
                  <Button
                    onClick={openSaveModal}
                    disabled={conditionTree.items.length === 0}
                    className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white border-0"
                  >
                    <Save className="h-4 w-4" />
                    <span>Save</span>
                  </Button>
                  <Button
                    onClick={openLoadModal}
                    variant="outline"
                    className="flex items-center space-x-2"
                  >
                    <FolderOpen className="h-4 w-4" />
                    <span>Load</span>
                  </Button>
                  <Button
                    onClick={openManageModal}
                    variant="outline"
                    className="flex items-center space-x-2 border-purple-300 text-purple-600 hover:bg-purple-50 hover:text-purple-700"
                  >
                    <Settings className="h-4 w-4" />
                    <span>Manage Inventory</span>
                  </Button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Preview Results */}
      {(showPreviewResults || previewDevices.length > 0) && (
        <div className="shadow-lg border-0 p-0 bg-white rounded-lg">
          <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4 flex items-center justify-between rounded-t-lg">
            <div className="flex items-center space-x-2">
              <Database className="h-4 w-4" />
              <span className="text-sm font-medium">Preview Results</span>
            </div>
            <div className="text-xs text-blue-100">
              {totalDevices} devices found ({operationsExecuted} queries executed)
            </div>
          </div>
          <div className="p-6 bg-gradient-to-b from-white to-gray-50">
            {enableSelection && selectedIds.size > 0 && (
              <div className="mb-4 p-3 bg-purple-50 border border-purple-200 rounded-md flex items-center justify-between">
                <p className="text-sm text-purple-800">
                  <strong>{selectedIds.size}</strong> device{selectedIds.size !== 1 ? 's' : ''} selected for command execution
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelectedIds(new Set())
                    if (onSelectionChange) {
                      onSelectionChange([], [])
                    }
                  }}
                  className="text-purple-600 hover:text-purple-800"
                >
                  Clear Selection
                </Button>
              </div>
            )}
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {enableSelection && (
                      <TableHead className="w-12">
                        <Checkbox
                          checked={previewDevices.length > 0 && previewDevices.every(d => selectedIds.has(d.id))}
                          onCheckedChange={(checked) => handleSelectAll(checked as boolean)}
                        />
                      </TableHead>
                    )}
                    <TableHead>Name</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Device Type</TableHead>
                    <TableHead>Platform</TableHead>
                    <TableHead>IP Address</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Tags</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {currentPageDevices.map((device) => (
                    <TableRow key={device.id}>
                      {enableSelection && (
                        <TableCell className="w-12">
                          <Checkbox
                            checked={selectedIds.has(device.id)}
                            onCheckedChange={(checked) => handleSelectDevice(device.id, checked as boolean)}
                          />
                        </TableCell>
                      )}
                      <TableCell className="font-medium">
                        {formatDeviceValue(device.name)}
                      </TableCell>
                      <TableCell>{formatDeviceValue(device.location)}</TableCell>
                      <TableCell>{formatDeviceValue(device.role)}</TableCell>
                      <TableCell>{formatDeviceValue(device.device_type)}</TableCell>
                      <TableCell>{formatDeviceValue(device.platform)}</TableCell>
                      <TableCell>{formatDeviceValue(device.primary_ip4)}</TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(device.status || '')}>
                          {formatDeviceValue(device.status)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {device.tags.map((tag) => (
                            <Badge key={`${device.id}-tag-${tag}`} variant="outline" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <div className="flex items-center space-x-2">
                  <Label htmlFor="pageSize" className="text-sm">Show:</Label>
                  <Select value={pageSize.toString()} onValueChange={(value) => {
                    setPageSize(parseInt(value))
                    setCurrentPage(1)
                  }}>
                    <SelectTrigger className="w-20 border-2 border-slate-300 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 shadow-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10</SelectItem>
                      <SelectItem value="20">20</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                      <SelectItem value="100">100</SelectItem>
                    </SelectContent>
                  </Select>
                  <span className="text-sm text-gray-600">
                    Showing {startIndex + 1} to {endIndex} of {previewDevices.length} entries
                  </span>
                </div>

                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>

                  <span className="text-sm">
                    Page {currentPage} of {totalPages}
                  </span>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Save/Load Modals - Only shown if showSaveLoad is true */}
      {showSaveLoad && (
        <>
          {/* Save Inventory Modal */}
          {showSaveModal && (
            <Dialog open={showSaveModal} onOpenChange={setShowSaveModal}>
              <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Save Device Filter</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 mt-4">
                  {/* Repository selection removed - using database storage */}

                  <div className="space-y-2">
                    <Label htmlFor="inventory-name">Name *</Label>
                    <Input
                      id="inventory-name"
                      placeholder="Enter name..."
                      value={saveInventoryName}
                      onChange={(e) => setSaveInventoryName(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="inventory-description">Description</Label>
                    <Textarea
                      id="inventory-description"
                      placeholder="Enter a description..."
                      value={saveInventoryDescription}
                      onChange={(e) => setSaveInventoryDescription(e.target.value)}
                      rows={3}
                    />
                  </div>

                  {savedInventories.length > 0 && (
                    <div className="space-y-2">
                      <Label>Existing Filters</Label>
                      <div className="border rounded-md p-2 max-h-48 overflow-y-auto">
                        {savedInventories.map((inv) => (
                          <div
                            key={inv.name}
                            className="p-2 hover:bg-gray-50 rounded cursor-pointer"
                            onClick={() => setSaveInventoryName(inv.name)}
                          >
                            <div className="font-medium">{inv.name}</div>
                            {inv.description && (
                              <div className="text-sm text-gray-600">{inv.description}</div>
                            )}
                            <div className="text-xs text-gray-400">
                              {inv.conditions.length} condition{inv.conditions.length !== 1 ? 's' : ''}
                            </div>
                          </div>
                        ))}
                      </div>
                      <p className="text-xs text-gray-500">Click a filter to select its name (will overwrite if you save)</p>
                    </div>
                  )}

                  {showOverwriteConfirm && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
                      <p className="text-sm text-yellow-800">
                        A filter named &quot;{inventoryToOverwrite}&quot; already exists. Do you want to overwrite it?
                      </p>
                    </div>
                  )}

                  <div className="flex justify-end gap-2 pt-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowSaveModal(false)
                        setShowOverwriteConfirm(false)
                        setInventoryToOverwrite(null)
                        setSaveInventoryName('')
                        setSaveInventoryDescription('')
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleSaveInventory}
                      disabled={isSavingInventory || !saveInventoryName.trim()}
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      {isSavingInventory ? 'Saving...' : (showOverwriteConfirm ? 'Yes, Overwrite' : 'Save')}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          )}

          {/* Load Inventory Modal */}
          {showLoadModal && (
            <Dialog open={showLoadModal} onOpenChange={setShowLoadModal}>
              <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Load Device Filter</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 mt-4">
                  {/* Repository selection removed - using database storage */}

                  {isLoadingInventories && (
                    <div className="flex items-center justify-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
                    </div>
                  )}

                  {!isLoadingInventories && savedInventories.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      No saved filters found in this repository.
                    </div>
                  )}

                  {!isLoadingInventories && savedInventories.length > 0 && (
                    <div className="space-y-2">
                      <Label>Select a Filter to Load</Label>
                      <div className="border rounded-md max-h-96 overflow-y-auto">
                        {savedInventories.map((inv) => (
                          <div
                            key={inv.name}
                            className="p-3 hover:bg-blue-50 border-b last:border-b-0 cursor-pointer transition-colors"
                            onClick={() => handleLoadInventory(inv.name)}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="font-medium text-gray-900">{inv.name}</div>
                                {inv.description && (
                                  <div className="text-sm text-gray-600 mt-1">{inv.description}</div>
                                )}
                                <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                                  <span>{inv.conditions.length} condition{inv.conditions.length !== 1 ? 's' : ''}</span>
                                  {inv.updated_at && (
                                    <span>Updated: {new Date(inv.updated_at).toLocaleDateString()}</span>
                                  )}
                                </div>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="ml-2"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleLoadInventory(inv.name)
                                }}
                              >
                                Load
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end pt-2">
                    <Button
                      variant="outline"
                      onClick={() => setShowLoadModal(false)}
                    >
                      Close
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          )}

          {/* Manage Inventory Modal */}
          <ManageInventoryDialog
            show={showManageModal}
            onClose={() => setShowManageModal(false)}
            onUpdate={handleUpdateInventory}
            onDelete={handleDeleteInventory}
            inventories={savedInventories}
            isLoading={isLoadingInventories}
          />
        </>
      )}
    </div>
  )
}
