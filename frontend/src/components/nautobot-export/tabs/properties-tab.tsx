import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Info } from 'lucide-react'

interface PropertyItem {
  id: string
  label: string
  description: string
}

const AVAILABLE_PROPERTIES: PropertyItem[] = [
  {
    id: 'name',
    label: 'Name',
    description: 'Device name',
  },
  {
    id: 'asset_tag',
    label: 'Asset Tag',
    description: 'Asset tag identifier',
  },
  {
    id: 'config_context',
    label: 'Config Context',
    description: 'Configuration context data',
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
    id: 'tags',
    label: 'Tags',
    description: 'Device tags',
  },
]

interface PropertiesTabProps {
  selectedProperties: string[]
  onPropertiesChange: (properties: string[]) => void
}

export function PropertiesTab({
  selectedProperties,
  onPropertiesChange,
}: PropertiesTabProps) {
  const handlePropertyToggle = (propertyId: string) => {
    if (selectedProperties.includes(propertyId)) {
      onPropertiesChange(selectedProperties.filter(p => p !== propertyId))
    } else {
      onPropertiesChange([...selectedProperties, propertyId])
    }
  }

  const handleSelectAll = () => {
    onPropertiesChange(AVAILABLE_PROPERTIES.map(p => p.id))
  }

  const handleDeselectAll = () => {
    onPropertiesChange([])
  }

  return (
    <div className="space-y-6">
      <Alert className="bg-blue-50 border-blue-200">
        <Info className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-blue-800">
          Select the properties you want to include in your export. At least one property must be selected.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Export Properties</CardTitle>
              <CardDescription>
                Choose which device properties to include in the export
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleSelectAll}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                Select All
              </button>
              <span className="text-gray-300">|</span>
              <button
                onClick={handleDeselectAll}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                Deselect All
              </button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {AVAILABLE_PROPERTIES.map((property) => (
              <div
                key={property.id}
                className="flex items-start space-x-3 p-4 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50/50 transition-colors"
              >
                <Checkbox
                  id={property.id}
                  checked={selectedProperties.includes(property.id)}
                  onCheckedChange={() => handlePropertyToggle(property.id)}
                  className="mt-1"
                />
                <div className="flex-1">
                  <Label
                    htmlFor={property.id}
                    className="text-sm font-medium text-gray-900 cursor-pointer"
                  >
                    {property.label}
                  </Label>
                  <p className="text-xs text-gray-500 mt-1">{property.description}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-700">
              <strong>Selected:</strong>{' '}
              {selectedProperties.length > 0 ? (
                <span className="text-blue-600 font-medium">
                  {selectedProperties.length} propert{selectedProperties.length !== 1 ? 'ies' : 'y'}
                </span>
              ) : (
                <span className="text-red-600 font-medium">No properties selected</span>
              )}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
