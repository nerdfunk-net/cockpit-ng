import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Info, GripVertical, Eye, EyeOff, Filter } from 'lucide-react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useState, useEffect } from 'react'

interface PropertyItem {
  id: string
  label: string
  description: string
  enabled: boolean
}

const DEFAULT_PROPERTIES: Omit<PropertyItem, 'enabled'>[] = [
  {
    id: 'name',
    label: 'Name',
    description: 'Device name',
  },
  {
    id: 'device_type',
    label: 'Device Type',
    description: 'Device type/model information',
  },
  {
    id: 'platform',
    label: 'Platform',
    description: 'Device platform (e.g., cisco_ios, juniper_junos)',
  },
  {
    id: 'role',
    label: 'Role',
    description: 'Device role',
  },
  {
    id: 'status',
    label: 'Status',
    description: 'Device status',
  },
  {
    id: 'location',
    label: 'Location',
    description: 'Device location/site',
  },
  {
    id: 'asset_tag',
    label: 'Asset Tag',
    description: 'Asset tag identifier',
  },
  {
    id: '_custom_field_data',
    label: 'Custom Field Data',
    description: 'Custom field data (internal)',
  },
  {
    id: 'serial',
    label: 'Serial Number',
    description: 'Device serial number',
  },
  {
    id: 'primary_ip4',
    label: 'Primary IPv4',
    description: 'Primary IPv4 address',
  },
  {
    id: 'namespace',
    label: 'Namespace',
    description: 'IP namespace',
  },
  {
    id: 'interfaces',
    label: 'Interfaces',
    description: 'Network interfaces with IP addresses',
  },
  {
    id: 'tags',
    label: 'Tags',
    description: 'Device tags',
  },
]

interface SortablePropertyItemProps {
  property: PropertyItem
  onToggle: (id: string) => void
}

function SortablePropertyItem({ property, onToggle }: SortablePropertyItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: property.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`
        group relative flex items-center gap-2 p-2 rounded-md border transition-all
        ${isDragging ? 'border-blue-400 bg-blue-50 shadow-lg z-50 opacity-90' : ''}
        ${property.enabled 
          ? 'border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 hover:border-blue-300 hover:shadow' 
          : 'border-gray-200 bg-gray-50 hover:border-gray-300'
        }
      `}
    >
      {/* Drag Handle */}
      <button
        {...attributes}
        {...listeners}
        className={`
          cursor-grab active:cursor-grabbing p-1 rounded transition-colors
          ${property.enabled ? 'text-blue-600 hover:bg-blue-100' : 'text-gray-400 hover:bg-gray-100'}
        `}
        aria-label="Drag to reorder"
      >
        <GripVertical className="h-4 w-4" />
      </button>

      {/* Property Content */}
      <div className="flex-1 min-w-0">
        <Label
          className={`text-sm font-medium block cursor-pointer leading-tight ${
            property.enabled ? 'text-gray-900' : 'text-gray-500'
          }`}
          onClick={() => onToggle(property.id)}
        >
          {property.label}
        </Label>
        <p className={`text-xs leading-tight ${property.enabled ? 'text-gray-600' : 'text-gray-400'}`}>
          {property.description}
        </p>
      </div>

      {/* Toggle Button */}
      <button
        onClick={() => onToggle(property.id)}
        className={`
          px-2 py-1 rounded transition-all flex items-center gap-1.5 font-medium text-xs
          ${property.enabled 
            ? 'bg-blue-600 text-white hover:bg-blue-700' 
            : 'bg-gray-300 text-gray-600 hover:bg-gray-400'
          }
        `}
        aria-label={property.enabled ? 'Disable property' : 'Enable property'}
      >
        {property.enabled ? (
          <>
            <Eye className="h-3.5 w-3.5" />
            <span>Export</span>
          </>
        ) : (
          <>
            <EyeOff className="h-3.5 w-3.5" />
            <span>Skip</span>
          </>
        )}
      </button>
    </div>
  )
}

interface PropertiesTabProps {
  selectedProperties: string[]
  onPropertiesChange: (properties: string[]) => void
}

export function PropertiesTab({
  selectedProperties,
  onPropertiesChange,
}: PropertiesTabProps) {
  // Initialize properties with enabled state based on selectedProperties
  const [properties, setProperties] = useState<PropertyItem[]>(() => {
    // Create initial order based on selectedProperties, then add remaining
    const selectedSet = new Set(selectedProperties)
    const orderedProps: PropertyItem[] = []
    
    // First add selected properties in their order
    selectedProperties.forEach(id => {
      const prop = DEFAULT_PROPERTIES.find(p => p.id === id)
      if (prop) {
        orderedProps.push({ ...prop, enabled: true })
      }
    })
    
    // Then add unselected properties
    DEFAULT_PROPERTIES.forEach(prop => {
      if (!selectedSet.has(prop.id)) {
        orderedProps.push({ ...prop, enabled: false })
      }
    })
    
    return orderedProps
  })

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // Sync changes back to parent
  useEffect(() => {
    const enabledPropertyIds = properties
      .filter(p => p.enabled)
      .map(p => p.id)
    onPropertiesChange(enabledPropertyIds)
  }, [properties, onPropertiesChange])

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      setProperties((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id)
        const newIndex = items.findIndex((item) => item.id === over.id)
        return arrayMove(items, oldIndex, newIndex)
      })
    }
  }

  const handleToggle = (id: string) => {
    setProperties((items) =>
      items.map((item) =>
        item.id === id ? { ...item, enabled: !item.enabled } : item
      )
    )
  }

  const handleEnableAll = () => {
    setProperties((items) => items.map((item) => ({ ...item, enabled: true })))
  }

  const handleDisableAll = () => {
    setProperties((items) => items.map((item) => ({ ...item, enabled: false })))
  }

  const handleOnboardingPreset = () => {
    const onboardingOrder = [
      'primary_ip4',
      'location',
      'role',
      'platform',
      'status',
      'namespace',
      'tags',
      '_custom_field_data',
    ]
    
    const enabledIds = new Set(onboardingOrder)
    
    // Create new ordered array: enabled properties first (in order), then disabled ones
    const enabledProps = onboardingOrder
      .map(id => properties.find(p => p.id === id))
      .filter((p): p is PropertyItem => p !== undefined)
      .map(p => ({ ...p, enabled: true }))
    
    const disabledProps = properties
      .filter(p => !enabledIds.has(p.id))
      .map(p => ({ ...p, enabled: false }))
    
    setProperties([...enabledProps, ...disabledProps])
  }

  const enabledCount = properties.filter(p => p.enabled).length

  return (
    <div className="space-y-3">
      <Alert className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200 py-2">
        <Info className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-blue-900 text-sm">
          <strong>Drag and drop</strong> to reorder (CSV column order). Click <strong>Export/Skip</strong> to toggle.
        </AlertDescription>
      </Alert>

      <div className="shadow-lg border-0 p-0 bg-white rounded-lg">
        <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4 flex items-center justify-between rounded-t-lg">
          <div className="flex items-center space-x-2">
            <Filter className="h-4 w-4" />
            <span className="text-sm font-medium">Export Properties</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleOnboardingPreset}
              className="px-3 py-1.5 text-xs font-medium text-white bg-purple-600 hover:bg-purple-700 rounded transition-colors"
            >
              Onboarding
            </button>
            <button
              onClick={handleEnableAll}
              className="px-3 py-1.5 text-xs font-medium text-blue-700 bg-white hover:bg-blue-50 rounded transition-colors"
            >
              Enable All
            </button>
            <button
              onClick={handleDisableAll}
              className="px-3 py-1.5 text-xs font-medium text-white bg-blue-700 hover:bg-blue-800 rounded transition-colors border border-blue-400"
            >
              Disable All
            </button>
          </div>
        </div>
        <div className="p-3">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={properties.map(p => p.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-1 max-w-2xl mx-auto">
                {properties.map((property) => (
                  <SortablePropertyItem
                    key={property.id}
                    property={property}
                    onToggle={handleToggle}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>

          <div className="mt-3 p-2 bg-gradient-to-r from-blue-50 to-indigo-50 rounded border border-blue-200">
            <p className="text-xs font-medium text-gray-900">
              <span className="text-blue-600 font-bold text-base">{enabledCount}</span> of {properties.length} properties enabled
            </p>
            {enabledCount === 0 && (
              <p className="text-xs text-red-600 font-medium mt-0.5">
                ⚠️ At least one property must be enabled to export
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
