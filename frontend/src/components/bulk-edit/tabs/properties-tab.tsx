'use client'

import { useState, useEffect } from 'react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { useApi } from '@/hooks/use-api'
import type { BulkEditProperties } from '../bulk-edit-page'

interface PropertiesTabProps {
  properties: BulkEditProperties
  onPropertiesChange: (properties: BulkEditProperties) => void
}

interface Namespace {
  id: string
  name: string
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

const NETWORK_MASK_OPTIONS = [
  { value: '/24', label: '/24 (255.255.255.0)' },
  { value: '/25', label: '/25 (255.255.255.128)' },
  { value: '/26', label: '/26 (255.255.255.192)' },
  { value: '/27', label: '/27 (255.255.255.224)' },
  { value: '/28', label: '/28 (255.255.255.240)' },
  { value: '/29', label: '/29 (255.255.255.248)' },
  { value: '/30', label: '/30 (255.255.255.252)' },
  { value: '/31', label: '/31 (255.255.255.254)' },
  { value: '/32', label: '/32 (255.255.255.255)' },
  { value: '/23', label: '/23 (255.255.254.0)' },
  { value: '/22', label: '/22 (255.255.252.0)' },
  { value: '/21', label: '/21 (255.255.248.0)' },
  { value: '/20', label: '/20 (255.255.240.0)' },
  { value: '/16', label: '/16 (255.255.0.0)' },
  { value: '/8', label: '/8 (255.0.0.0)' },
]

export function PropertiesTab({ properties, onPropertiesChange }: PropertiesTabProps) {
  const { apiCall } = useApi()
  const [namespaces, setNamespaces] = useState<Namespace[]>([])
  const [isLoadingNamespaces, setIsLoadingNamespaces] = useState(false)

  // Fetch namespaces on mount
  useEffect(() => {
    const fetchNamespaces = async () => {
      setIsLoadingNamespaces(true)
      try {
        const response = await apiCall('nautobot/namespaces') as Namespace[]
        setNamespaces(response || [])
      } catch (error) {
        console.error('Failed to fetch namespaces:', error)
        // Set default "Global" namespace if fetch fails
        setNamespaces([{ id: 'global', name: 'Global' }])
      } finally {
        setIsLoadingNamespaces(false)
      }
    }
    fetchNamespaces()
  }, [apiCall])

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

  const handleCreateOnIpChangeChange = (checked: boolean) => {
    onPropertiesChange({
      ...properties,
      interfaceConfig: {
        ...properties.interfaceConfig,
        createOnIpChange: checked,
      },
    })
  }

  const handleAddPrefixesChange = (checked: boolean) => {
    onPropertiesChange({
      ...properties,
      ipConfig: {
        ...properties.ipConfig,
        addPrefixesAutomatically: checked,
      },
    })
  }

  const handleNetworkMaskChange = (value: string) => {
    onPropertiesChange({
      ...properties,
      ipConfig: {
        ...properties.ipConfig,
        defaultNetworkMask: value,
      },
    })
  }

  const handleNamespaceChange = (value: string) => {
    onPropertiesChange({
      ...properties,
      ipConfig: {
        ...properties.ipConfig,
        namespace: value,
      },
    })
  }

  return (
    <div className="space-y-6">
      <div className="border rounded-lg overflow-hidden bg-white shadow-sm">
        <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4 rounded-t-lg">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Default Properties</span>
            <div className="text-xs text-blue-100">
              Configure default settings used in bulk edit operations
            </div>
          </div>
        </div>
        <div className="p-6 space-y-6 bg-gray-50">
          {/* Interface Configuration Section */}
          <div className="space-y-4 p-6 bg-white rounded-lg border border-gray-200 shadow-sm">
            <div className="border-b border-gray-200 pb-3">
              <h3 className="text-lg font-semibold text-gray-900">Interface Configuration</h3>
              <p className="text-sm text-gray-600 mt-1">
                Default settings for new interfaces
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Interface Name */}
              <div className="space-y-2">
                <Label htmlFor="interface-name" className="text-sm font-medium text-gray-700">Interface Name</Label>
                <Input
                  id="interface-name"
                  placeholder="e.g., GigabitEthernet0/0"
                  value={properties.interfaceConfig.name}
                  onChange={(e) => handleInterfaceNameChange(e.target.value)}
                  className="bg-white border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                />
              </div>

              {/* Interface Type */}
              <div className="space-y-2">
                <Label htmlFor="interface-type" className="text-sm font-medium text-gray-700">Interface Type</Label>
                <Select
                  value={properties.interfaceConfig.type}
                  onValueChange={handleInterfaceTypeChange}
                >
                  <SelectTrigger id="interface-type" className="bg-white border-gray-300 focus:border-blue-500 focus:ring-blue-500">
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
                <Label htmlFor="interface-status" className="text-sm font-medium text-gray-700">Status</Label>
                <Select
                  value={properties.interfaceConfig.status}
                  onValueChange={handleInterfaceStatusChange}
                >
                  <SelectTrigger id="interface-status" className="bg-white border-gray-300 focus:border-blue-500 focus:ring-blue-500">
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

            {/* Add new Interface when IP changes */}
            <div className="space-y-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-center justify-between">
                <div className="space-y-1 flex-1">
                  <Label htmlFor="create-on-ip-change" className="text-sm font-medium text-gray-900">Add new Interface when IP changes</Label>
                  <p className="text-sm text-gray-700">
                    Automatically create a new interface when the primary IP address is updated
                  </p>
                </div>
                <Switch
                  id="create-on-ip-change"
                  checked={properties.interfaceConfig.createOnIpChange}
                  onCheckedChange={handleCreateOnIpChangeChange}
                  className="ml-4 data-[state=checked]:bg-blue-600 data-[state=unchecked]:bg-gray-300"
                />
              </div>
            </div>
          </div>

          {/* IP Configuration Section */}
          <div className="space-y-4 p-6 bg-white rounded-lg border border-gray-200 shadow-sm">
            <div className="border-b border-gray-200 pb-3">
              <h3 className="text-lg font-semibold text-gray-900">IP Configuration</h3>
              <p className="text-sm text-gray-600 mt-1">
                Default settings for IP address management
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Add IP Prefixes Automatically */}
              <div className="space-y-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-center justify-between">
                  <div className="space-y-1 flex-1">
                    <Label htmlFor="add-prefixes" className="text-sm font-medium text-gray-900">Add IP Prefixes Automatically</Label>
                    <p className="text-sm text-gray-700">
                      Automatically add IP prefixes when creating interfaces
                    </p>
                  </div>
                  <Switch
                    id="add-prefixes"
                    checked={properties.ipConfig.addPrefixesAutomatically}
                    onCheckedChange={handleAddPrefixesChange}
                    className="ml-4 data-[state=checked]:bg-blue-600 data-[state=unchecked]:bg-gray-300"
                  />
                </div>
              </div>

              {/* Default Network Mask */}
              <div className="space-y-2">
                <Label htmlFor="network-mask" className="text-sm font-medium text-gray-700">Default Network Mask</Label>
                <Select
                  value={properties.ipConfig.defaultNetworkMask}
                  onValueChange={handleNetworkMaskChange}
                >
                  <SelectTrigger id="network-mask" className="bg-white border-gray-300 focus:border-blue-500 focus:ring-blue-500">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {NETWORK_MASK_OPTIONS.map((mask) => (
                      <SelectItem key={mask.value} value={mask.value}>
                        {mask.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Namespace */}
              <div className="space-y-2">
                <Label htmlFor="namespace" className="text-sm font-medium text-gray-700">Namespace</Label>
                <Select
                  value={properties.ipConfig.namespace}
                  onValueChange={handleNamespaceChange}
                  disabled={isLoadingNamespaces}
                >
                  <SelectTrigger id="namespace" className="bg-white border-gray-300 focus:border-blue-500 focus:ring-blue-500">
                    <SelectValue placeholder={isLoadingNamespaces ? "Loading..." : "Select namespace..."} />
                  </SelectTrigger>
                  <SelectContent>
                    {namespaces.map((namespace) => (
                      <SelectItem key={namespace.id} value={namespace.name}>
                        {namespace.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
