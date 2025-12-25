'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { BulkEditProperties } from '../bulk-edit-page'

interface PropertiesTabProps {
  properties: BulkEditProperties
  onPropertiesChange: (properties: BulkEditProperties) => void
}

const INTERFACE_TYPES = [
  { value: '1000base-t', label: '1000BASE-T (1GE)' },
  { value: '10gbase-x-sfpp', label: '10GBASE-X SFP+' },
  { value: '25gbase-x-sfp28', label: '25GBASE-X SFP28' },
  { value: '40gbase-x-qsfpp', label: '40GBASE-X QSFP+' },
  { value: '100gbase-x-qsfp28', label: '100GBASE-X QSFP28' },
  { value: 'virtual', label: 'Virtual' },
  { value: 'lag', label: 'Link Aggregation Group (LAG)' },
  { value: 'other', label: 'Other' },
]

const INTERFACE_STATUSES = [
  { value: 'active', label: 'Active' },
  { value: 'planned', label: 'Planned' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'decommissioning', label: 'Decommissioning' },
  { value: 'failed', label: 'Failed' },
]

export function PropertiesTab({ properties, onPropertiesChange }: PropertiesTabProps) {
  const handleInterfaceNameChange = (value: string) => {
    onPropertiesChange({
      ...properties,
      interfaceConfig: {
        ...properties.interfaceConfig,
        name: value,
      },
    })
  }

  const handleInterfaceTypeChange = (value: string) => {
    onPropertiesChange({
      ...properties,
      interfaceConfig: {
        ...properties.interfaceConfig,
        type: value,
      },
    })
  }

  const handleInterfaceStatusChange = (value: string) => {
    onPropertiesChange({
      ...properties,
      interfaceConfig: {
        ...properties.interfaceConfig,
        status: value,
      },
    })
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Default Properties</CardTitle>
          <CardDescription>
            Configure default settings used in bulk edit operations
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Interface Configuration Section */}
          <div className="space-y-4">
            <div className="border-b pb-2">
              <h3 className="text-lg font-semibold">Interface Configuration</h3>
              <p className="text-sm text-gray-600">
                Default settings for new interfaces
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Interface Name */}
              <div className="space-y-2">
                <Label htmlFor="interface-name">Interface Name</Label>
                <Input
                  id="interface-name"
                  placeholder="e.g., GigabitEthernet0/0"
                  value={properties.interfaceConfig.name}
                  onChange={(e) => handleInterfaceNameChange(e.target.value)}
                />
              </div>

              {/* Interface Type */}
              <div className="space-y-2">
                <Label htmlFor="interface-type">Interface Type</Label>
                <Select
                  value={properties.interfaceConfig.type}
                  onValueChange={handleInterfaceTypeChange}
                >
                  <SelectTrigger id="interface-type">
                    <SelectValue placeholder="Select type..." />
                  </SelectTrigger>
                  <SelectContent>
                    {INTERFACE_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Interface Status */}
              <div className="space-y-2">
                <Label htmlFor="interface-status">Status</Label>
                <Select
                  value={properties.interfaceConfig.status}
                  onValueChange={handleInterfaceStatusChange}
                >
                  <SelectTrigger id="interface-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INTERFACE_STATUSES.map((status) => (
                      <SelectItem key={status.value} value={status.value}>
                        {status.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Placeholder for future properties */}
          <div className="space-y-4">
            <div className="border-b pb-2">
              <h3 className="text-lg font-semibold">Additional Properties</h3>
              <p className="text-sm text-gray-600">
                More configuration options will be added here
              </p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg text-center text-gray-500">
              Additional property configurations will be added in future updates
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
