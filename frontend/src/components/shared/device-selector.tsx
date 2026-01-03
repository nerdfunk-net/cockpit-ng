'use client'

import { useState, useEffect, useCallback } from 'react'
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
  Settings,
  HelpCircle
} from 'lucide-react'
import { useApi } from '@/hooks/use-api'
import { ManageInventoryDialog } from '@/components/features/general/inventory/dialogs/manage-inventory-dialog'

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

// Type for backend response conditions that can be either format
interface BackendConditionsResponse {
  id: number
  name: string
  description?: string
  conditions: Array<LogicalCondition | { version: number; tree: ConditionTree }>
  scope: string
  created_by: string
  created_at?: string
  updated_at?: string
}

// Backend operation types
interface BackendCondition {
  field: string
  operator: string
  value: string
}

interface BackendOperation {
  operation_type: string
  conditions: BackendCondition[]
  nested_operations: BackendOperation[]
  _parentLogic?: string
}

// Define default arrays outside component to prevent re-creating on every render
const EMPTY_CONDITIONS: LogicalCondition[] = []
const EMPTY_DEVICES: DeviceInfo[] = []
const EMPTY_DEVICE_IDS: string[] = []
const EMPTY_CONDITION_ARRAY: (ConditionItem | ConditionGroup)[] = []
const EMPTY_PATH_ARRAY: string[] = []

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

  // Tree-based condition state
  const [conditionTree, setConditionTree] = useState<ConditionTree>(EMPTY_TREE)

  // Current input state for adding new conditions
  const [currentField, setCurrentField] = useState('')
  const [currentOperator, setCurrentOperator] = useState('equals')
  const [currentValue, setCurrentValue] = useState('')
  const [currentLogic, setCurrentLogic] = useState('AND')
  const [currentNegate, setCurrentNegate] = useState(false)

  // Track current editing context (which group we're adding to)
  const [currentGroupPath, setCurrentGroupPath] = useState<string[]>([]) // Array of group IDs representing path

  // Modal states
  const [showLogicalTreeModal, setShowLogicalTreeModal] = useState(false)
  const [showHelpModal, setShowHelpModal] = useState(false)

  // Field options and values
  const [fieldOptions, setFieldOptions] = useState<FieldOption[]>([])
  const [operatorOptions, setOperatorOptions] = useState<FieldOption[]>([])
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
      // Convert initial flat conditions to tree structure
      const initialTree = flatConditionsToTree(initialConditions)
      setConditionTree(initialTree)
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

      // Logic options no longer needed - using Connector dropdown + Negate checkbox
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

    if (conditionTree.items.length === 0) {
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
      // Save the tree structure directly as JSON
      const treeData = {
        version: 2, // Version 2 = tree structure
        tree: conditionTree
      }

      if (existingInventory) {
        // Update existing inventory
        await apiCall(`inventory/${existingInventory.id}`, {
          method: 'PUT',
          body: {
            description: saveInventoryDescription || undefined,
            conditions: [treeData], // Wrap in array for backend compatibility
          }
        })
      } else {
        // Create new inventory
        await apiCall('inventory', {
          method: 'POST',
          body: {
            name: saveInventoryName,
            description: saveInventoryDescription || undefined,
            conditions: [treeData], // Wrap in array for backend compatibility
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
      const response = await apiCall<BackendConditionsResponse>(`inventory/by-name/${encodeURIComponent(inventoryName)}`)

      // Check if this is a new tree structure (version 2) or legacy flat format
      if (response.conditions && response.conditions.length > 0) {
        const firstItem = response.conditions[0]

        if (firstItem && typeof firstItem === 'object' && 'version' in firstItem && firstItem.version === 2) {
          // New tree structure format
          setConditionTree(firstItem.tree)
        } else {
          // Legacy flat conditions format
          const loadedTree = flatConditionsToTree(response.conditions as LogicalCondition[])
          setConditionTree(loadedTree)
        }
      }

      setShowPreviewResults(false)
      setPreviewDevices([])
      setShowLoadModal(false)
    } catch (error) {
      console.error('Error loading inventory:', error)
      alert('Error loading inventory: ' + (error as Error).message)
    }
  }

  const openSaveModal = async () => {
    if (conditionTree.items.length === 0) {
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
    const restrictedFields = ['role', 'device_type', 'manufacturer', 'platform', 'has_primary']
    const isCustomField = fieldName && fieldName.startsWith('cf_')

    if (restrictedFields.includes(fieldName)) {
      setOperatorOptions([{ value: 'equals', label: 'Equals' }])
      setCurrentOperator('equals')
    } else if (fieldName === 'location' || fieldName === 'tag') {
      // Location and Tag support equals and not_equals
      setOperatorOptions([
        { value: 'equals', label: 'Equals' },
        { value: 'not_equals', label: 'Not Equals' }
      ])
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
    setCurrentNegate(false)
    setLocationSearchValue('')
    setSelectedLocationValue('')
    setFieldValues([])
  }

  // NEW: Add a new group to the tree
  const addGroup = () => {
    // Determine group logic based on currentLogic and currentNegate
    let groupLogic: 'AND' | 'OR' | 'NOT' = currentLogic as 'AND' | 'OR'
    if (currentNegate) {
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

    // Reset negate state after adding group
    setCurrentNegate(false)
  }

  // NEW: Remove item from tree by ID
  const removeItemFromTree = (itemId: string) => {
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
  const findGroupPath = (groupId: string, items: (ConditionItem | ConditionGroup)[] = EMPTY_CONDITION_ARRAY, currentPath: string[] = EMPTY_PATH_ARRAY): string[] | null => {
    // Use actual items if not using defaults
    const actualItems = items === EMPTY_CONDITION_ARRAY ? conditionTree.items : items
    for (const item of actualItems) {
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
    
    const findGroupById = (
      items: (ConditionItem | ConditionGroup)[],
      groupId: string
    ): ConditionGroup | null => {
      for (const item of items) {
        if ('type' in item && item.type === 'group') {
          if (item.id === groupId) {
            return item as ConditionGroup
          }
          const found = findGroupById(item.items, groupId)
          if (found) return found
        }
      }
      return null
    }
    
    // Find the actual group to get its logic type
    const targetGroupId = currentGroupPath[currentGroupPath.length - 1]
    if (!targetGroupId) {
      return `Group ${currentGroupPath.length}`
    }
    
    const group = findGroupById(conditionTree.items, targetGroupId)
    if (group) {
      return `Group (${group.internalLogic})`
    }
    
    return `Group ${currentGroupPath.length}`
  }

  // NEW: Generate ASCII tree visualization
  const generateTreeVisualization = (): string => {
    const lines: string[] = []

    // Add header
    lines.push(`ROOT (${conditionTree.internalLogic})`)

    if (conditionTree.items.length === 0) {
      lines.push('  (empty)')
      return lines.join('\n')
    }

    const renderTreeItemText = (
      item: ConditionItem | ConditionGroup,
      prefix: string = '',
      isLast: boolean = true,
      isFirst: boolean = false
    ) => {
      const connector = isLast ? '└─ ' : '├─ '
      const extension = isLast ? '   ' : '│  '

      if ('type' in item && item.type === 'group') {
        const group = item as ConditionGroup

        // Add logic operator badge if not first
        const logicBadge = !isFirst ? `[${group.logic}] ` : ''
        lines.push(`${prefix}${connector}${logicBadge}GROUP (${group.internalLogic})`)

        // Render group items
        if (group.items.length === 0) {
          lines.push(`${prefix}${extension}   (empty group)`)
        } else {
          group.items.forEach((subItem, subIndex) => {
            const subIsLast = subIndex === group.items.length - 1
            renderTreeItemText(subItem, `${prefix}${extension}`, subIsLast, subIndex === 0)
          })
        }
      } else {
        // This is a condition
        const condition = item as ConditionItem
        const fieldLabel = getFieldLabel(condition.field)
        lines.push(`${prefix}${connector}${fieldLabel} ${condition.operator} "${condition.value}"`)
      }
    }

    // Render all root-level items
    conditionTree.items.forEach((item, index) => {
      const isLast = index === conditionTree.items.length - 1
      renderTreeItemText(item, '', isLast, index === 0)
    })

    return lines.join('\n')
  }

  // LEGACY functions removed - now using tree-based structure exclusively

  // NEW: Build operations from tree structure
  const buildOperationsFromTree = (tree: ConditionTree | ConditionGroup): BackendOperation[] => {
    const items = tree.items

    if (items.length === 0) return []

    // Helper to convert a single item (condition or group) to backend format
    const convertItem = (item: ConditionItem | ConditionGroup): BackendOperation => {
      if ('type' in item && item.type === 'group') {
        // This is a group - recursively convert it
        const group = item as ConditionGroup
        const groupConditions: BackendCondition[] = []
        const nestedOps: BackendOperation[] = []

        group.items.forEach(subItem => {
          if ('type' in subItem && subItem.type === 'group') {
            // Nested group - recursively convert it
            const subGroup = subItem as ConditionGroup
            const convertedSubGroup = convertItem(subGroup)
            
            // Preserve the logic operator (NOT) from the nested group
            if (subGroup.logic === 'NOT') {
              convertedSubGroup.operation_type = 'NOT'
            }
            
            nestedOps.push(convertedSubGroup)
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
    const regularItems: BackendOperation[] = []
    const notItems: BackendOperation[] = []

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

    const operations: BackendOperation[] = []

    // Add main operation with all regular items
    if (regularItems.length > 0) {
      if (regularItems.length === 1) {
        const firstItem = regularItems[0]
        if (firstItem) {
          operations.push(firstItem)
        }
      } else {
        // Separate root-level conditions from groups
        const rootConditions: BackendCondition[] = []
        const nestedOps: BackendOperation[] = []

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

  // Helper to convert flat conditions to tree structure (for loading saved inventories)
  const flatConditionsToTree = (flatConditions: LogicalCondition[]): ConditionTree => {
    const tree: ConditionTree = {
      type: 'root',
      internalLogic: 'AND',
      items: []
    }

    // Simple conversion: each flat condition becomes a ConditionItem at root level
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

  // Helper to check if an item is at root level
  const isItemAtRootLevel = (itemId: string): boolean => {
    return conditionTree.items.some(item => item.id === itemId)
  }

  // Recursive function to render tree items (conditions and groups)
  const renderTreeItem = (item: ConditionItem | ConditionGroup, isFirst: boolean): React.ReactNode => {
    if ('type' in item && item.type === 'group') {
      // This is a group
      const group = item as ConditionGroup
      const isActiveTarget = currentGroupPath.length > 0 && currentGroupPath[currentGroupPath.length - 1] === group.id
      const isAtRoot = isItemAtRootLevel(group.id)

      return (
        <div
          className={`border-l-4 pl-4 py-2 rounded-r cursor-pointer transition-colors ${
            isActiveTarget
              ? 'border-blue-500 bg-blue-50/70'
              : 'border-purple-300 bg-purple-50/50 hover:bg-purple-100/50'
          }`}
          onClick={(e) => {
            e.stopPropagation()
            setTargetGroup(group.id)
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
          <button
            onClick={() => setShowHelpModal(true)}
            className="flex items-center gap-1.5 text-xs text-white/90 hover:text-white hover:bg-white/10 px-2.5 py-1 rounded transition-colors"
            title="Show help and examples"
          >
            <HelpCircle className="h-3.5 w-3.5" />
            <span>Help</span>
          </button>
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

            {/* Logic Selection - Split into two controls */}
            <div className="space-y-2">
              <Label htmlFor="logic">Connector</Label>
              <div className="flex flex-col gap-2">
                {/* Dropdown for AND/OR */}
                <Select value={currentLogic} onValueChange={setCurrentLogic}>
                  <SelectTrigger className="border-2 border-slate-300 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 shadow-sm">
                    <SelectValue placeholder="Select connector..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="AND">AND</SelectItem>
                    <SelectItem value="OR">OR</SelectItem>
                  </SelectContent>
                </Select>
                {/* Checkbox for Negate */}
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={currentNegate}
                    onChange={(e) => setCurrentNegate(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-gray-700">Negate (NOT)</span>
                </label>
              </div>
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
                <Button
                  onClick={() => setShowLogicalTreeModal(true)}
                  variant="outline"
                  size="sm"
                  title="Show Logical Tree"
                  disabled={conditionTree.items.length === 0}
                  className="ml-auto"
                >
                  <Settings className="h-4 w-4 mr-1" />
                  <span className="text-xs">Show Tree</span>
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

          {/* Logical Tree Visualization Modal */}
          <Dialog open={showLogicalTreeModal} onOpenChange={setShowLogicalTreeModal}>
            <DialogContent className="sm:max-w-3xl">
              <DialogHeader>
                <DialogTitle>Logical Expression Tree</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <pre className="font-mono text-sm whitespace-pre overflow-x-auto">
                    {generateTreeVisualization()}
                  </pre>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-sm text-blue-900">
                    <strong>Legend:</strong>
                  </p>
                  <ul className="text-xs text-blue-800 mt-2 space-y-1 ml-4">
                    <li>• <strong>ROOT (AND/OR)</strong>: How root-level items are combined</li>
                    <li>• <strong>[AND/OR/NOT]</strong>: Logic operator before this item</li>
                    <li>• <strong>GROUP (AND/OR)</strong>: How items inside the group are combined</li>
                    <li>• <strong>└─</strong> or <strong>├─</strong>: Tree structure connectors</li>
                    <li>• <strong>│</strong>: Vertical connection line</li>
                  </ul>
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setShowLogicalTreeModal(false)}
                  >
                    Close
                  </Button>
                  <Button
                    onClick={() => {
                      const treeText = generateTreeVisualization()
                      navigator.clipboard.writeText(treeText)
                      alert('Tree copied to clipboard!')
                    }}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    Copy to Clipboard
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* Help Modal */}
          <Dialog open={showHelpModal} onOpenChange={setShowHelpModal}>
            <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-2xl font-bold text-blue-900">Building Logical Filter Expressions</DialogTitle>
              </DialogHeader>

              <div className="space-y-6 mt-4">
                {/* Introduction */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h3 className="font-semibold text-blue-900 mb-2">What is this?</h3>
                  <p className="text-sm text-blue-800">
                    The logical expression builder allows you to create complex device filters with <strong>groups</strong> and
                    <strong> proper bracket precedence</strong> using AND, OR, and NOT operations. Think of it like writing advanced
                    search queries with parentheses to control evaluation order.
                  </p>
                </div>

                {/* Quick Start */}
                <div>
                  <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <span className="bg-green-100 text-green-800 px-2 py-0.5 rounded text-sm">Quick Start</span>
                    Building Simple Conditions
                  </h3>
                  <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700 ml-2">
                    <li><strong>Select a field</strong> (Location, Role, Status, etc.)</li>
                    <li><strong>Choose an operator</strong> (equals, not equals, contains, not contains - available operators vary by field)</li>
                    <li><strong>Enter a value</strong></li>
                    <li><strong>Select Connector</strong> (AND or OR) - this determines how the NEXT item connects</li>
                    <li><strong>Optional:</strong> Check <strong>&quot;Negate (NOT)&quot;</strong> to exclude instead of include</li>
                    <li><strong>Click the &quot;+&quot; button</strong> to add the condition</li>
                  </ol>
                </div>

                {/* Understanding Connectors */}
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <h3 className="font-semibold text-yellow-900 mb-2">Understanding Connectors</h3>
                  <div className="text-sm text-yellow-800 space-y-2">
                    <p><strong>Connector dropdown (AND/OR):</strong> Determines how this item combines with the previous item</p>
                    <p><strong>Negate checkbox:</strong> When checked, creates NOT logic (excludes the condition)</p>
                    <p className="font-semibold mt-3">Examples:</p>
                    <ul className="list-disc list-inside ml-4 space-y-1">
                      <li>Connector=AND + Negate checked = <strong>&quot;AND NOT&quot;</strong> (include previous AND exclude this)</li>
                      <li>Connector=OR + Negate checked = <strong>&quot;OR NOT&quot;</strong> (include previous OR exclude this)</li>
                    </ul>
                  </div>
                </div>

                {/* Creating Groups */}
                <div>
                  <h3 className="font-semibold text-gray-900 mb-3">Creating Groups (Advanced)</h3>
                  <p className="text-sm text-gray-700 mb-2">
                    Groups allow you to control the order of evaluation, just like using parentheses in mathematics:
                  </p>
                  <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700 ml-2">
                    <li>Click the <strong>&quot;+ Group&quot;</strong> button to create an empty group</li>
                    <li><strong>Click on the group</strong> to set it as the active target (it will highlight in blue)</li>
                    <li>Add conditions inside the group using the regular &quot;+&quot; button</li>
                    <li>Click <strong>&quot;Toggle&quot;</strong> on a group to switch between AND/OR logic</li>
                    <li>Click <strong>&quot;Back to Root&quot;</strong> to return to adding items at the root level</li>
                  </ol>
                </div>

                {/* Root Logic */}
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <h3 className="font-semibold text-purple-900 mb-2">Root Logic Configuration</h3>
                  <p className="text-sm text-purple-800 mb-2">
                    The <strong>Root logic</strong> determines how all top-level items (conditions and groups) are combined:
                  </p>
                  <ul className="list-disc list-inside text-sm text-purple-800 space-y-1 ml-4">
                    <li><strong>Root logic: AND</strong> - All top-level items must match</li>
                    <li><strong>Root logic: OR</strong> - At least one top-level item must match</li>
                    <li>Click the <strong>&quot;Toggle&quot;</strong> button next to &quot;Root logic:&quot; to switch</li>
                  </ul>
                </div>

                {/* Available Operators */}
                <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
                  <h3 className="font-semibold text-indigo-900 mb-2">Available Operators by Field</h3>
                  <div className="text-sm text-indigo-800 space-y-2">
                    <p><strong>Location field:</strong> Supports <span className="font-mono bg-white px-1 rounded">equals</span> and <span className="font-mono bg-white px-1 rounded">not equals</span> operators</p>
                    <p><strong>Name field:</strong> Supports <span className="font-mono bg-white px-1 rounded">equals</span>, <span className="font-mono bg-white px-1 rounded">not equals</span>, <span className="font-mono bg-white px-1 rounded">contains</span>, and <span className="font-mono bg-white px-1 rounded">not contains</span></p>
                    <p><strong>Other fields (Role, Tag, Status, etc.):</strong> Support <span className="font-mono bg-white px-1 rounded">equals</span> only</p>
                    <p className="mt-3 text-xs">
                      <strong>💡 Tip:</strong> For Location, use &quot;not equals&quot; to efficiently exclude devices from a specific location and all its child locations.
                    </p>
                  </div>
                </div>

                {/* Visual Indicators */}
                <div>
                  <h3 className="font-semibold text-gray-900 mb-3">Visual Indicators</h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="flex items-start gap-2">
                      <div className="w-4 h-4 bg-blue-100 border-2 border-blue-400 rounded mt-0.5"></div>
                      <div>
                        <strong>Blue boxes:</strong> Individual conditions
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <div className="w-4 h-4 bg-purple-50 border-l-4 border-purple-300 mt-0.5"></div>
                      <div>
                        <strong>Purple boxes:</strong> Groups (click to target)
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <div className="w-4 h-4 bg-blue-50 border-2 border-blue-600 rounded mt-0.5"></div>
                      <div>
                        <strong>Dark blue border:</strong> Active target group
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <Badge className="bg-blue-500 text-white text-xs mt-0.5">Active Target</Badge>
                      <div>
                        <strong>Badge:</strong> Currently selected group
                      </div>
                    </div>
                  </div>
                </div>

                {/* Example 1 */}
                <div className="border border-gray-200 rounded-lg p-4 bg-gradient-to-br from-white to-gray-50">
                  <h3 className="font-semibold text-gray-900 mb-2">Example 1: Multiple Locations with Status Filter</h3>
                  <p className="text-sm text-gray-600 mb-3"><strong>Goal:</strong> Get devices from City A OR City B that are Active</p>
                  <div className="bg-gray-800 text-green-400 p-3 rounded font-mono text-xs mb-3">
                    (Location = City A OR Location = City B) AND Status = Active
                  </div>
                  <p className="text-sm font-semibold text-gray-700 mb-2">Steps:</p>
                  <ol className="list-decimal list-inside space-y-1.5 text-sm text-gray-700 ml-2">
                    <li>Click <strong>&quot;+ Group&quot;</strong> - empty group created</li>
                    <li><strong>Click on the group</strong> - it highlights blue, shows &quot;Active Target&quot;</li>
                    <li>Add: Field=Location, Value=&quot;City A&quot;, click <strong>&quot;+&quot;</strong></li>
                    <li>Add: Field=Location, Value=&quot;City B&quot;, click <strong>&quot;+&quot;</strong></li>
                    <li>Click <strong>&quot;Toggle&quot;</strong> on group to change from AND to OR</li>
                    <li>Click <strong>&quot;Back to Root&quot;</strong></li>
                    <li>Add: Field=Status, Value=&quot;Active&quot;, click <strong>&quot;+&quot;</strong></li>
                  </ol>
                  <div className="mt-3 p-2 bg-white border border-gray-200 rounded text-xs font-mono">
                    <div>ROOT (AND logic)</div>
                    <div>├─ GROUP (OR logic)</div>
                    <div>│&nbsp;&nbsp;├─ Location equals &quot;City A&quot;</div>
                    <div>│&nbsp;&nbsp;└─ Location equals &quot;City B&quot;</div>
                    <div>└─ Status equals &quot;Active&quot;</div>
                  </div>
                </div>

                {/* Example 2 */}
                <div className="border border-gray-200 rounded-lg p-4 bg-gradient-to-br from-white to-gray-50">
                  <h3 className="font-semibold text-gray-900 mb-2">Example 2: Exclude Devices Using Operators</h3>
                  <p className="text-sm text-gray-600 mb-3"><strong>Goal:</strong> Get all active network devices NOT in City A</p>
                  <div className="bg-gray-800 text-green-400 p-3 rounded font-mono text-xs mb-3">
                    Role = Network AND Status = Active AND Location ≠ City A
                  </div>
                  <p className="text-sm font-semibold text-gray-700 mb-2">Steps:</p>
                  <ol className="list-decimal list-inside space-y-1.5 text-sm text-gray-700 ml-2">
                    <li>Add: Field=Role, Value=&quot;Network&quot;, click <strong>&quot;+&quot;</strong></li>
                    <li>Add: Field=Status, Connector=AND, Value=&quot;Active&quot;, click <strong>&quot;+&quot;</strong></li>
                    <li>Add: Field=Location, Connector=AND, <strong>Operator=&quot;Not Equals&quot;</strong>, Value=&quot;City A&quot;, click <strong>&quot;+&quot;</strong></li>
                  </ol>
                  <p className="text-sm text-gray-600 mt-3"><strong>Result:</strong> All network devices with Active status, excluding those in City A and its child locations</p>
                </div>

                {/* Example 3 */}
                <div className="border border-gray-200 rounded-lg p-4 bg-gradient-to-br from-white to-gray-50">
                  <h3 className="font-semibold text-gray-900 mb-2">Example 3: Complex Multi-Group Expression</h3>
                  <p className="text-sm text-gray-600 mb-3"><strong>Goal:</strong> Network devices in City A OR servers in City B</p>
                  <div className="bg-gray-800 text-green-400 p-3 rounded font-mono text-xs mb-3">
                    (Location = City A AND Role = Network) OR (Location = City B AND Role = server)
                  </div>
                  <p className="text-sm font-semibold text-gray-700 mb-2">Steps:</p>
                  <ol className="list-decimal list-inside space-y-1.5 text-sm text-gray-700 ml-2">
                    <li>Create Group 1, click it, add Location=&quot;City A&quot; and Role=&quot;Network&quot;</li>
                    <li>Back to Root, toggle root logic to <strong>OR</strong></li>
                    <li>Create Group 2, click it, add Location=&quot;City B&quot; and Role=&quot;server&quot;</li>
                  </ol>
                </div>

                {/* Tips */}
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <h3 className="font-semibold text-green-900 mb-2">Pro Tips</h3>
                  <ul className="list-disc list-inside text-sm text-green-800 space-y-1 ml-2">
                    <li><strong>Start simple:</strong> Add individual conditions first, then group them if needed</li>
                    <li><strong>Use &quot;Show Tree&quot;:</strong> Click to see ASCII visualization of your expression</li>
                    <li><strong>Save frequently:</strong> Use the &quot;Save&quot; button to store complex filters for reuse</li>
                    <li><strong>Test incrementally:</strong> Use &quot;Preview Results&quot; after building each group</li>
                    <li><strong>Root logic matters:</strong> Don&apos;t forget to check the root-level logic operator</li>
                  </ul>
                </div>

                {/* Troubleshooting */}
                <div>
                  <h3 className="font-semibold text-gray-900 mb-3">Troubleshooting</h3>
                  <div className="space-y-2 text-sm text-gray-700">
                    <div>
                      <strong>Q: My groups disappeared after clicking preview?</strong>
                      <p className="ml-4 text-gray-600">A: This should no longer happen. If it does, please report the bug.</p>
                    </div>
                    <div>
                      <strong>Q: How do I add conditions to a specific group?</strong>
                      <p className="ml-4 text-gray-600">A: Click on the group - it will highlight blue and show &quot;Active Target&quot; badge. All new conditions will be added inside that group.</p>
                    </div>
                    <div>
                      <strong>Q: What&apos;s the difference between Group logic and Root logic?</strong>
                      <p className="ml-4 text-gray-600">A: <strong>Group logic</strong> controls how items inside a group combine. <strong>Root logic</strong> controls how top-level items (including groups) combine.</p>
                    </div>
                  </div>
                </div>

                {/* Close Button */}
                <div className="flex justify-end pt-4 border-t">
                  <Button
                    onClick={() => setShowHelpModal(false)}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    Got it, thanks!
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  )
}
