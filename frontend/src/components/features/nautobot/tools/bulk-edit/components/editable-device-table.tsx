'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ArrowUp, ArrowDown } from 'lucide-react'
import { useApi } from '@/hooks/use-api'
import { fetchDeviceTypesWithManufacturer } from '@/services/nautobot-graphql'
import type { DeviceInfo } from '@/components/shared/device-selector'
import type { ColumnDefinition } from '../tabs/bulk-edit-tab'

// Status options for devices
const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'planned', label: 'Planned' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'failed', label: 'Failed' },
  { value: 'decommissioning', label: 'Decommissioning' },
  { value: 'offline', label: 'Offline' },
]

interface FieldOption {
  value: string
  label: string
}

interface EditableDeviceTableProps {
  devices: DeviceInfo[]
  columns: ColumnDefinition[]
  modifiedDevices: Map<string, Partial<DeviceInfo>>
  onDeviceModified: (deviceId: string, changes: Partial<DeviceInfo>) => void
}

export function EditableDeviceTable({
  devices,
  columns,
  modifiedDevices,
  onDeviceModified,
}: EditableDeviceTableProps) {
  const { apiCall } = useApi()
  const [editingCell, setEditingCell] = useState<{ deviceId: string; field: string } | null>(null)
  const [editValue, setEditValue] = useState<string>('')

  // Field options cache
  const [roleOptions, setRoleOptions] = useState<FieldOption[]>([])
  const [locationOptions, setLocationOptions] = useState<FieldOption[]>([])
  const [deviceTypeOptions, setDeviceTypeOptions] = useState<FieldOption[]>([])
  const [platformOptions, setPlatformOptions] = useState<FieldOption[]>([])

  // Device type to manufacturer mapping
  const [deviceTypeToManufacturer, setDeviceTypeToManufacturer] = useState<Map<string, string>>(new Map())

  // Location search state
  const [locationSearchValue, setLocationSearchValue] = useState<string>('')
  const [showLocationDropdown, setShowLocationDropdown] = useState(false)
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 })
  const locationInputRef = useRef<HTMLInputElement>(null)

  const isDeviceModified = useCallback((deviceId: string) => {
    return modifiedDevices.has(deviceId)
  }, [modifiedDevices])

  // Load field options on mount
  useEffect(() => {
    const loadFieldOptions = async () => {
      try {
        console.log('[BulkEdit] Loading field options...')
        // Load all field options in parallel
        const [roles, locationsRaw, deviceTypesRaw, platforms] = await Promise.all([
          apiCall<{ field: string; values: FieldOption[] }>('inventory/field-values/role'),
          apiCall<Array<{ id: string; name: string; parent?: { id: string } }>>('nautobot/locations'),
          fetchDeviceTypesWithManufacturer(apiCall),
          apiCall<{ field: string; values: FieldOption[] }>('inventory/field-values/platform'),
        ])

        console.log('[BulkEdit] Loaded locations:', locationsRaw.length)

        // Build hierarchical paths for locations
        const locationMap = new Map(locationsRaw.map(loc => [loc.id, loc]))
        const locationsWithHierarchy = locationsRaw.map(location => {
          const path: string[] = []
          let current: typeof location | undefined = location

          while (current) {
            path.unshift(current.name)
            current = current.parent?.id ? locationMap.get(current.parent.id) : undefined
          }

          return {
            value: location.name,
            label: path.join(' → ')
          }
        })

        locationsWithHierarchy.sort((a, b) => a.label.localeCompare(b.label))

        console.log('[BulkEdit] Built hierarchical locations:', locationsWithHierarchy.length)
        console.log('[BulkEdit] Sample locations:', locationsWithHierarchy.slice(0, 3))

        // Build device type options and manufacturer mapping from GraphQL response
        const deviceTypeMapping = new Map<string, string>()
        console.log('[BulkEdit] Device types GraphQL response:', deviceTypesRaw)

        // Extract device types from GraphQL response
        const deviceTypesArray = deviceTypesRaw?.data?.device_types || []
        console.log('[BulkEdit] Device types array:', deviceTypesArray)

        const deviceTypes = deviceTypesArray.map((dt: { id: string; model: string; manufacturer: { id: string; name: string } }) => {
          const modelName = dt.model
          const manufacturerName = dt.manufacturer?.name || ''

          console.log('[BulkEdit] Processing device type:', modelName, 'manufacturer:', manufacturerName)

          if (manufacturerName) {
            deviceTypeMapping.set(modelName, manufacturerName)
          }

          return {
            value: modelName,
            label: modelName
          }
        })
        deviceTypes.sort((a, b) => a.label.localeCompare(b.label))

        console.log('[BulkEdit] Loaded device types:', deviceTypes.length)
        console.log('[BulkEdit] deviceTypeMapping entries:', Array.from(deviceTypeMapping.entries()))

        setRoleOptions(roles.values || [])
        setLocationOptions(locationsWithHierarchy)
        setDeviceTypeOptions(deviceTypes)
        setPlatformOptions(platforms.values || [])
        setDeviceTypeToManufacturer(deviceTypeMapping)
      } catch (error) {
        console.error('Failed to load field options:', error)
      }
    }

    void loadFieldOptions()
  }, [apiCall])

  const getFieldValue = useCallback((device: DeviceInfo, field: string): string => {
    const value = device[field as keyof DeviceInfo]

    // Handle nested objects
    if (value && typeof value === 'object') {
      if ('name' in value) return value.name as string
      if ('address' in value) return value.address as string
    }

    // Handle arrays (tags)
    if (Array.isArray(value)) {
      return value.join(', ')
    }

    return value?.toString() || ''
  }, [])

  const handleCellClick = useCallback((device: DeviceInfo, column: ColumnDefinition) => {
    if (!column.editable) return

    const currentValue = getFieldValue(device, column.field)

    // For status field, normalize to lowercase to match SELECT_OPTIONS values
    const normalizedValue = column.field === 'status' ? currentValue.toLowerCase() : currentValue

    // For location field, set the search value to the hierarchical label
    if (column.field === 'location') {
      console.log('[BulkEdit] Clicked location field, current value:', currentValue)
      console.log('[BulkEdit] Available locationOptions:', locationOptions.length)
      const locationOption = locationOptions.find(loc => loc.value === currentValue)
      console.log('[BulkEdit] Found locationOption:', locationOption)
      setLocationSearchValue(locationOption?.label || currentValue)
    }

    // For device_type field, log the current device for debugging
    if (column.field === 'device_type') {
      console.log('[BulkEdit] Clicked device_type field, device:', device)
      console.log('[BulkEdit] Current value:', currentValue)
      console.log('[BulkEdit] Device type options:', deviceTypeOptions)
    }

    setEditingCell({ deviceId: device.id, field: column.field })
    setEditValue(normalizedValue)
  }, [getFieldValue, locationOptions, deviceTypeOptions])

  const handleCellBlur = useCallback(() => {
    if (!editingCell) return

    const device = devices.find(d => d.id === editingCell.deviceId)
    if (!device) return

    const originalValue = getFieldValue(device, editingCell.field)

    // Only update if value changed
    if (editValue !== originalValue) {
      const changes = modifiedDevices.get(editingCell.deviceId) || {}
      onDeviceModified(editingCell.deviceId, {
        ...changes,
        [editingCell.field]: editValue,
      })
    }

    setEditingCell(null)
    setEditValue('')
  }, [editingCell, editValue, devices, modifiedDevices, onDeviceModified, getFieldValue])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleCellBlur()
    } else if (e.key === 'Escape') {
      setEditingCell(null)
      setEditValue('')
    }
  }, [handleCellBlur])

  // Get options for a specific field
  const getOptionsForField = useCallback((field: string): FieldOption[] | null => {
    switch (field) {
      case 'status':
        return STATUS_OPTIONS
      case 'role':
        return roleOptions
      case 'location':
        return null // Location uses custom searchable input
      case 'device_type':
        return deviceTypeOptions
      case 'platform':
        return platformOptions
      default:
        return null
    }
  }, [roleOptions, deviceTypeOptions, platformOptions])

  // Render a Select dropdown for fields with predefined options
  const renderSelectField = useCallback((device: DeviceInfo, column: ColumnDefinition, options: FieldOption[]) => {
    return (
      <div className="flex items-center h-12">
        <Select
          value={editValue}
          onValueChange={(newValue) => {
            setEditValue(newValue)
            // Auto-save on selection change
            const changes = modifiedDevices.get(device.id) || {}

            // If changing device type, also update manufacturer
            if (column.field === 'device_type') {
              const manufacturer = deviceTypeToManufacturer.get(newValue)
              console.log('[BulkEdit] Device type changed to:', newValue)
              console.log('[BulkEdit] Manufacturer from mapping:', manufacturer)
              console.log('[BulkEdit] deviceTypeToManufacturer size:', deviceTypeToManufacturer.size)
              onDeviceModified(device.id, {
                ...changes,
                device_type: newValue,
                manufacturer: manufacturer || changes.manufacturer || '',
              })
            } else {
              onDeviceModified(device.id, {
                ...changes,
                [column.field]: newValue,
              })
            }

            setEditingCell(null)
            setEditValue('')
          }}
        >
          <SelectTrigger className="h-8 text-sm w-full min-w-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    )
  }, [editValue, modifiedDevices, onDeviceModified, deviceTypeToManufacturer])

  const renderCell = useCallback((device: DeviceInfo, column: ColumnDefinition) => {
    const isEditing = editingCell?.deviceId === device.id && editingCell?.field === column.field

    // Check if this device has been modified and use the modified value if available
    const modifications = modifiedDevices.get(device.id)
    const fieldValue = modifications && column.field in modifications
      ? modifications[column.field as keyof DeviceInfo]
      : device[column.field as keyof DeviceInfo]

    const value = (() => {
      // Handle nested objects
      if (fieldValue && typeof fieldValue === 'object') {
        if ('name' in fieldValue) return (fieldValue as { name: string }).name
        if ('address' in fieldValue) return (fieldValue as { address: string }).address
      }
      // Handle arrays (tags)
      if (Array.isArray(fieldValue)) {
        return fieldValue.join(', ')
      }
      return fieldValue?.toString() || ''
    })()

    if (isEditing) {
      // Special handling for location field - searchable dropdown
      if (column.field === 'location') {
        console.log('[BulkEdit] Rendering location field')
        console.log('[BulkEdit] locationSearchValue:', locationSearchValue)
        console.log('[BulkEdit] showLocationDropdown:', showLocationDropdown)
        console.log('[BulkEdit] locationOptions.length:', locationOptions.length)

        const filteredLocations = locationOptions.filter(loc =>
          loc.label.toLowerCase().includes(locationSearchValue.toLowerCase())
        )
        console.log('[BulkEdit] filteredLocations.length:', filteredLocations.length)

        const updateDropdownPosition = () => {
          if (locationInputRef.current) {
            const rect = locationInputRef.current.getBoundingClientRect()
            setDropdownPosition({
              top: rect.bottom + window.scrollY,
              left: rect.left + window.scrollX,
              width: rect.width
            })
          }
        }

        return (
          <div className="flex items-center h-12">
            <Input
              ref={locationInputRef}
              placeholder="Search locations..."
              value={locationSearchValue}
              onChange={(e) => {
                console.log('[BulkEdit] Input changed:', e.target.value)
                setLocationSearchValue(e.target.value)
                setShowLocationDropdown(true)
                updateDropdownPosition()
              }}
              onFocus={() => {
                console.log('[BulkEdit] Input focused')
                setShowLocationDropdown(true)
                updateDropdownPosition()
              }}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  console.log('[BulkEdit] Escape pressed')
                  setShowLocationDropdown(false)
                  setLocationSearchValue('')
                  setEditingCell(null)
                }
              }}
              className="h-8 text-sm w-full min-w-0"
              autoFocus
            />
            {showLocationDropdown && typeof window !== 'undefined' && createPortal(
              <div
                className="fixed bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-y-auto"
                style={{
                  top: `${dropdownPosition.top}px`,
                  left: `${dropdownPosition.left}px`,
                  width: `${dropdownPosition.width}px`,
                  zIndex: 9999
                }}
              >
                {filteredLocations.map(location => (
                  <div
                    key={location.value}
                    className="px-3 py-2 hover:bg-gray-100 cursor-pointer text-sm"
                    onClick={() => {
                      console.log('[BulkEdit] Location clicked:', location.label)
                      const changes = modifiedDevices.get(device.id) || {}
                      onDeviceModified(device.id, {
                        ...changes,
                        [column.field]: location.value,
                      })
                      setLocationSearchValue('')
                      setShowLocationDropdown(false)
                      setEditingCell(null)
                    }}
                  >
                    {location.label}
                  </div>
                ))}
              </div>,
              document.body
            )}
          </div>
        )
      }

      // Check if this field has predefined options (dropdown)
      const fieldOptions = getOptionsForField(column.field)

      if (fieldOptions) {
        return renderSelectField(device, column, fieldOptions)
      }

      // Default text input for other fields
      return (
        <div className="flex items-center h-12">
          <Input
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleCellBlur}
            onKeyDown={handleKeyDown}
            autoFocus
            className="h-8 text-sm w-full min-w-0"
          />
        </div>
      )
    }

    // Render special cases
    if (column.field === 'tags' && Array.isArray(device.tags)) {
      return (
        <div className="flex items-center gap-1 flex-wrap h-12">
          {device.tags.map((tag) => (
            <Badge key={tag} variant="secondary" className="text-xs">
              {tag}
            </Badge>
          ))}
        </div>
      )
    }

    if (column.field === 'status') {
      const statusColors: Record<string, string> = {
        active: 'bg-green-100 text-green-800',
        planned: 'bg-blue-100 text-blue-800',
        maintenance: 'bg-yellow-100 text-yellow-800',
        failed: 'bg-red-100 text-red-800',
        decommissioning: 'bg-gray-100 text-gray-800',
      }
      const colorClass = statusColors[value.toLowerCase()] || 'bg-gray-100 text-gray-800'

      return (
        <div className="flex items-center h-12">
          <Badge variant="secondary" className={`text-xs ${colorClass}`}>
            {value}
          </Badge>
        </div>
      )
    }

    // Special rendering for name field with uppercase/lowercase icons
    if (column.field === 'name') {
      return (
        <div className="flex items-center gap-1 h-12">
          <span className="text-sm flex-1">
            {value || <span className="text-gray-400 italic">Empty</span>}
          </span>
          <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={(e) => {
                e.stopPropagation()
                const changes = modifiedDevices.get(device.id) || {}
                onDeviceModified(device.id, {
                  ...changes,
                  name: value.toUpperCase(),
                })
              }}
              className="p-0.5 hover:bg-gray-200 rounded"
              title="Convert to UPPERCASE"
            >
              <ArrowUp className="h-3 w-3 text-gray-600" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                const changes = modifiedDevices.get(device.id) || {}
                onDeviceModified(device.id, {
                  ...changes,
                  name: value.toLowerCase(),
                })
              }}
              className="p-0.5 hover:bg-gray-200 rounded"
              title="Convert to lowercase"
            >
              <ArrowDown className="h-3 w-3 text-gray-600" />
            </button>
          </div>
        </div>
      )
    }

    return (
      <div className="flex items-center h-12">
        <span className="text-sm">
          {value || <span className="text-gray-400 italic">Empty</span>}
        </span>
      </div>
    )
  }, [editingCell, editValue, handleCellBlur, handleKeyDown, getOptionsForField, renderSelectField, locationSearchValue, showLocationDropdown, locationOptions, modifiedDevices, onDeviceModified, dropdownPosition])

  const getCellClassName = useCallback((column: ColumnDefinition) => {
    const baseClass = 'px-4 py-0'
    const hoverClass = column.editable ? 'cursor-pointer hover:bg-gray-50' : ''

    return `${baseClass} ${hoverClass}`
  }, [])

  const getRowClassName = useCallback((device: DeviceInfo) => {
    const baseClass = 'border-b transition-colors h-12 group'
    const modifiedClass = isDeviceModified(device.id) ? 'bg-red-50 hover:bg-red-100' : 'hover:bg-gray-50'

    return `${baseClass} ${modifiedClass}`
  }, [isDeviceModified])

  return (
    <div className="border rounded-lg overflow-visible">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((column) => (
                <TableHead
                  key={column.id}
                  className="font-semibold"
                  style={{ width: column.width || 'auto', minWidth: column.width || 'auto', maxWidth: column.width || 'auto' }}
                >
                  {column.label}
                  {column.editable && (
                    <span className="ml-1 text-xs text-gray-400">(editable)</span>
                  )}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {devices.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="text-center py-8 text-gray-500">
                  No devices selected
                </TableCell>
              </TableRow>
            ) : (
              devices.map((device) => (
                <TableRow key={device.id} className={getRowClassName(device)}>
                  {columns.map((column) => (
                    <TableCell
                      key={column.id}
                      className={getCellClassName(column)}
                      style={{ width: column.width || 'auto', minWidth: column.width || 'auto', maxWidth: column.width || 'auto' }}
                      onClick={() => handleCellClick(device, column)}
                    >
                      {renderCell(device, column)}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
