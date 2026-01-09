import React, { useMemo } from 'react'
import { RefreshCw } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { InterfaceMappingTable } from '@/components/features/checkmk/sync/interface-mapping-table'
import { parseInterfacesFromInventory } from '@/lib/checkmk/interface-mapping-utils'
import type { CheckMKHost, NautobotMetadata } from '@/types/checkmk/types'

interface PropertyMapping {
  nautobotField: string
  value: unknown
  isCore?: boolean
}

interface SyncToNautobotModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  host: CheckMKHost | null
  nautobotDevice: Record<string, unknown> | null
  checkingNautobot: boolean
  nautobotMetadata: NautobotMetadata | null
  propertyMappings: Record<string, PropertyMapping>
  loadingMetadata: boolean
  inventoryData: Record<string, unknown> | null
  loadingInventory: boolean
  ipAddressStatuses: Array<{ id: string; name: string }> | null
  ipAddressRoles: Array<{ id: string; name: string }> | null
  onSync: () => void
  onUpdateMapping: (checkMkKey: string, nautobotField: string) => void
  onUpdatePropertyMappings: (mappings: Record<string, PropertyMapping>) => void
}

export function SyncToNautobotModal({
  open,
  onOpenChange,
  host,
  nautobotDevice,
  checkingNautobot,
  nautobotMetadata,
  propertyMappings,
  loadingMetadata,
  inventoryData,
  loadingInventory,
  ipAddressStatuses,
  ipAddressRoles,
  onSync,
  onUpdateMapping,
  onUpdatePropertyMappings,
}: SyncToNautobotModalProps) {
  // Parse interfaces from inventory data
  const interfaces = useMemo(() => {
    return parseInterfacesFromInventory(inventoryData)
  }, [inventoryData])
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!max-w-[72vw] !w-[72vw] max-h-[90vh] overflow-hidden flex flex-col p-0" style={{ maxWidth: '72vw', width: '72vw' }}>
        <DialogHeader className="sr-only">
          <DialogTitle>Sync to Nautobot - {host?.host_name}</DialogTitle>
          <DialogDescription>Map CheckMK properties to Nautobot fields and sync the device</DialogDescription>
        </DialogHeader>
        
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-3 px-6">
          <div>
            <h2 className="text-lg font-semibold">Sync Device to Nautobot</h2>
            <p className="text-blue-100 text-sm">{host?.host_name}</p>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto bg-white p-6">
          {checkingNautobot ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
                <p className="mt-2 text-sm text-muted-foreground">Checking Nautobot...</p>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Nautobot Device Status */}
              {nautobotDevice ? (
                <Card className="border-blue-200 bg-blue-50">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 mt-0.5">
                        <Badge className="bg-blue-500">Found in Nautobot</Badge>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-gray-700">
                          This device already exists in Nautobot. The sync will update its properties.
                        </p>
                        <div className="mt-2 space-y-1 text-xs">
                          <div><span className="font-semibold">Name:</span> {(nautobotDevice.name as string) || 'N/A'}</div>
                          <div><span className="font-semibold">Location:</span> {((nautobotDevice.location as Record<string, unknown>)?.name as string) || 'N/A'}</div>
                          <div><span className="font-semibold">Role:</span> {((nautobotDevice.role as Record<string, unknown>)?.name as string) || 'N/A'}</div>
                          <div><span className="font-semibold">Status:</span> {((nautobotDevice.status as Record<string, unknown>)?.name as string) || 'N/A'}</div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card className="border-amber-200 bg-amber-50">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 mt-0.5">
                        <Badge className="bg-amber-500">Not in Nautobot</Badge>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-gray-700">
                          This device does not exist in Nautobot. A new device will be created.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Property Mapping Table */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Property Mapping</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Map CheckMK properties to Nautobot fields. Select the appropriate Nautobot field for each CheckMK property.
                </p>

                {loadingMetadata ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mx-auto"></div>
                      <p className="mt-2 text-xs text-muted-foreground">Loading Nautobot metadata...</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Core Attributes Section */}
                    <div>
                      <h4 className="text-md font-semibold text-gray-900 mb-3">Core Attributes (Required)</h4>
                      <div className="border rounded-lg overflow-hidden">
                        <table className="w-full">
                          <thead className="bg-blue-100 border-b">
                            <tr>
                              <th className="text-left p-3 font-semibold text-sm text-gray-900">CheckMK Property</th>
                              <th className="text-left p-3 font-semibold text-sm text-gray-900">Current Value</th>
                              <th className="text-left p-3 font-semibold text-sm text-gray-900">Nautobot Field</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white">
                            {Object.entries(propertyMappings)
                              .filter(([, mapping]) => mapping.isCore)
                              .map(([checkMkKey, mapping]) => {
                                const displayKey = checkMkKey.startsWith('tag_') 
                                  ? checkMkKey.replace('tag_', '')
                                  : checkMkKey
                                
                                return (
                                  <tr key={`core-${checkMkKey}`} className="border-b hover:bg-blue-50">
                                    <td className="p-3">
                                      <code className="text-xs bg-blue-100 px-2 py-1 rounded font-mono text-blue-900">
                                        {displayKey}
                                      </code>
                                      {mapping.nautobotField === 'role' && (
                                        <Badge className="ml-2 bg-orange-500 text-white text-xs">Required</Badge>
                                      )}
                                    </td>
                                    <td className="p-3">
                                      {mapping.nautobotField === 'role' ? (
                                        <Select
                                          value={String(mapping.value)}
                                          onValueChange={(value) => {
                                            onUpdatePropertyMappings({
                                              ...propertyMappings,
                                              [checkMkKey]: {
                                                nautobotField: mapping.nautobotField,
                                                value,
                                                isCore: mapping.isCore
                                              }
                                            })
                                          }}
                                        >
                                          <SelectTrigger className={`w-full bg-white ${!mapping.value ? 'border-orange-300' : 'border-gray-300'}`}>
                                            <SelectValue placeholder="Select a role..." />
                                          </SelectTrigger>
                                          <SelectContent>
                                            {nautobotMetadata?.roles && nautobotMetadata.roles.length > 0 ? (
                                              nautobotMetadata.roles.map((role) => (
                                                <SelectItem key={role.id} value={role.name}>
                                                  {role.name}
                                                </SelectItem>
                                              ))
                                            ) : (
                                              <SelectItem value="loading" disabled>
                                                Loading roles...
                                              </SelectItem>
                                            )}
                                          </SelectContent>
                                        </Select>
                                      ) : (
                                        <span className="text-sm text-gray-900 font-medium">
                                          {String(mapping.value)}
                                        </span>
                                      )}
                                    </td>
                                    <td className="p-3">
                                      <div className="space-y-2">
                                        <div className="flex items-center gap-2">
                                          <Badge className="bg-blue-600 text-white">
                                            {mapping.nautobotField === 'name' && 'Device Name'}
                                            {mapping.nautobotField === 'primary_ip4' && 'Primary IPv4'}
                                            {mapping.nautobotField === 'location' && 'Location'}
                                            {mapping.nautobotField === 'status' && 'Status'}
                                            {mapping.nautobotField === 'role' && 'Role'}
                                          </Badge>
                                        </div>
                                        {['location', 'role', 'status'].includes(mapping.nautobotField) && Boolean(mapping.value) && (
                                          <p className="text-xs text-gray-600">
                                            Will be matched to Nautobot {mapping.nautobotField}
                                          </p>
                                        )}
                                      </div>
                                    </td>
                                  </tr>
                                )
                              })}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Custom Fields Section */}
                    {Object.entries(propertyMappings).some(([, mapping]) => !mapping.isCore) && (
                      <div>
                        <h4 className="text-md font-semibold text-gray-900 mb-3">Custom Fields & Tags</h4>
                        <div className="border rounded-lg overflow-hidden">
                          <table className="w-full">
                            <thead className="bg-gray-100 border-b">
                              <tr>
                                <th className="text-left p-3 font-semibold text-sm text-gray-900">CheckMK Property</th>
                                <th className="text-left p-3 font-semibold text-sm text-gray-900">Current Value</th>
                                <th className="text-left p-3 font-semibold text-sm text-gray-900">Nautobot Field</th>
                              </tr>
                            </thead>
                            <tbody className="bg-white">
                              {Object.entries(propertyMappings)
                                .filter(([, mapping]) => !mapping.isCore)
                                .map(([checkMkKey, mapping]) => {
                                  const displayKey = checkMkKey.startsWith('tag_') 
                                    ? checkMkKey.replace('tag_', '')
                                    : checkMkKey
                                  
                                  return (
                                    <tr key={`custom-${checkMkKey}`} className="border-b hover:bg-gray-50">
                                      <td className="p-3">
                                        <code className="text-xs bg-gray-100 px-2 py-1 rounded font-mono text-gray-900">
                                          {displayKey}
                                        </code>
                                      </td>
                                      <td className="p-3">
                                        <span className="text-sm text-gray-900">
                                          {String(mapping.value)}
                                        </span>
                                      </td>
                                      <td className="p-3">
                                        <div className="space-y-2">
                                          <Select
                                            value={mapping.nautobotField}
                                            onValueChange={(value) => onUpdateMapping(checkMkKey, value)}
                                          >
                                            <SelectTrigger className="w-full bg-white border-gray-300">
                                              <SelectValue>
                                                {mapping.nautobotField === 'no_mapping' ? (
                                                  <span className="flex items-center gap-2">
                                                    <Badge className="bg-gray-400 text-white text-xs">Skip</Badge>
                                                    No mapping
                                                  </span>
                                                ) : mapping.nautobotField.startsWith('custom_field_') ? (
                                                  <span className="flex items-center gap-2">
                                                    <Badge className="bg-purple-600 text-white text-xs">CF</Badge>
                                                    {mapping.nautobotField.replace('custom_field_', 'cf_')}
                                                  </span>
                                                ) : (
                                                  <span className="flex items-center gap-2">
                                                    <Badge className="bg-blue-600 text-white text-xs">Core</Badge>
                                                    {mapping.nautobotField === 'name' && 'Device Name'}
                                                    {mapping.nautobotField === 'location' && 'Location'}
                                                    {mapping.nautobotField === 'role' && 'Role'}
                                                    {mapping.nautobotField === 'status' && 'Status'}
                                                    {mapping.nautobotField === 'device_type' && 'Device Type'}
                                                    {mapping.nautobotField === 'platform' && 'Platform'}
                                                    {mapping.nautobotField === 'primary_ip4' && 'Primary IPv4'}
                                                    {mapping.nautobotField === 'serial' && 'Serial Number'}
                                                    {mapping.nautobotField === 'asset_tag' && 'Asset Tag'}
                                                    {mapping.nautobotField === 'software_version' && 'Software Version'}
                                                  </span>
                                                )}
                                              </SelectValue>
                                            </SelectTrigger>
                                            <SelectContent>
                                              <SelectItem value="no_mapping">
                                                <span className="flex items-center gap-2">
                                                  <Badge className="bg-gray-400 text-white text-xs">Skip</Badge>
                                                  No mapping (don&apos;t sync)
                                                </span>
                                              </SelectItem>
                                              <SelectItem disabled value="_core_separator">--- Core Attributes ---</SelectItem>
                                              <SelectItem value="name">Device Name</SelectItem>
                                              <SelectItem value="location">Location</SelectItem>
                                              <SelectItem value="role">Role</SelectItem>
                                              <SelectItem value="status">Status</SelectItem>
                                              <SelectItem value="device_type">Device Type</SelectItem>
                                              <SelectItem value="platform">Platform</SelectItem>
                                              <SelectItem value="primary_ip4">Primary IPv4</SelectItem>
                                              <SelectItem value="serial">Serial Number</SelectItem>
                                              <SelectItem value="asset_tag">Asset Tag</SelectItem>
                                              <SelectItem value="software_version">Software Version</SelectItem>
                                              
                                              {nautobotMetadata?.customFields && nautobotMetadata.customFields.length > 0 && (
                                                <>
                                                  <SelectItem disabled value="_separator">--- Custom Fields ---</SelectItem>
                                                  {nautobotMetadata.customFields.map((cf) => (
                                                    <SelectItem key={cf.id} value={`custom_field_${cf.key}`}>
                                                      {cf.name} (CF: cf_{cf.key})
                                                    </SelectItem>
                                                  ))}
                                                </>
                                              )}
                                            </SelectContent>
                                          </Select>
                                          
                                          {mapping.nautobotField === 'no_mapping' ? (
                                            <p className="text-xs text-gray-500 italic">
                                              This attribute will not be synced to Nautobot
                                            </p>
                                          ) : mapping.nautobotField.startsWith('custom_field_') ? (
                                            <p className="text-xs text-gray-600">
                                              Maps to custom field: cf_{mapping.nautobotField.replace('custom_field_', '')}
                                            </p>
                                          ) : null}
                                        </div>
                                      </td>
                                    </tr>
                                  )
                                })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Interface Mapping Section */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Interface Mapping</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Select which interfaces to sync to Nautobot and assign roles. Interfaces are automatically detected from CheckMK inventory.
                </p>

                {loadingInventory ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mx-auto"></div>
                      <p className="mt-2 text-xs text-muted-foreground">Loading inventory data...</p>
                    </div>
                  </div>
                ) : interfaces.length > 0 ? (
                  <InterfaceMappingTable
                    interfaces={interfaces}
                    ipAddressStatuses={ipAddressStatuses}
                    ipAddressRoles={ipAddressRoles}
                  />
                ) : (
                  <Card className="border-gray-200 bg-gray-50">
                    <CardContent className="p-4">
                      <p className="text-sm text-gray-600 text-center">
                        No interfaces found in inventory data. Make sure the device has been discovered by CheckMK.
                      </p>
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* Required Fields Notice */}
              <Card className="border-orange-200 bg-orange-50">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-0.5 text-orange-600">
                      <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-orange-800 mb-1">Required Fields</p>
                      <p className="text-xs text-orange-700">
                        Make sure to map the following required fields: <strong>name, role, status, location, device_type</strong>
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="border-t bg-gray-50 px-6 py-4 flex justify-end gap-3">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={checkingNautobot}
          >
            Cancel
          </Button>
          <Button
            onClick={onSync}
            disabled={checkingNautobot || loadingMetadata}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Sync to Nautobot
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
