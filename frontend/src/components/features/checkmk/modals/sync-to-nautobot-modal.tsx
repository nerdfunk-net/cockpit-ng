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

        {/* Compact Header */}
        <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4">
          <div>
            <h2 className="text-base font-semibold">Sync Device to Nautobot</h2>
            <p className="text-blue-100 text-xs">{host?.host_name}</p>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto bg-gray-50/50 p-4">
          {checkingNautobot ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
                <p className="mt-2 text-sm text-muted-foreground">Checking Nautobot...</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Nautobot Device Status */}
              {nautobotDevice ? (
                <Card className="border-blue-200/60 bg-blue-50/50">
                  <CardContent className="p-3">
                    <div className="flex items-start gap-2">
                      <Badge className="bg-blue-500 text-xs h-5">Found in Nautobot</Badge>
                      <div className="flex-1">
                        <p className="text-xs text-gray-700">
                          Device exists in Nautobot. Sync will update properties.
                        </p>
                        <div className="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-0.5 text-[11px]">
                          <div><span className="font-medium">Name:</span> {(nautobotDevice.name as string) || 'N/A'}</div>
                          <div><span className="font-medium">Role:</span> {((nautobotDevice.role as Record<string, unknown>)?.name as string) || 'N/A'}</div>
                          <div><span className="font-medium">Location:</span> {((nautobotDevice.location as Record<string, unknown>)?.name as string) || 'N/A'}</div>
                          <div><span className="font-medium">Status:</span> {((nautobotDevice.status as Record<string, unknown>)?.name as string) || 'N/A'}</div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card className="border-amber-200/60 bg-amber-50/50">
                  <CardContent className="p-3">
                    <div className="flex items-start gap-2">
                      <Badge className="bg-amber-500 text-xs h-5">Not in Nautobot</Badge>
                      <p className="text-xs text-gray-700 flex-1">
                        Device does not exist in Nautobot. A new device will be created.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Property Mapping Table */}
              <div>
                <div className="flex items-center mb-2 pb-1.5 border-b border-blue-400/60">
                  <h3 className="text-sm font-semibold text-gray-900">Property Mapping</h3>
                </div>
                <p className="text-xs text-gray-600 mb-3">
                  Map CheckMK properties to Nautobot fields.
                </p>

                {loadingMetadata ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mx-auto"></div>
                      <p className="mt-2 text-xs text-muted-foreground">Loading Nautobot metadata...</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* Core Attributes Section */}
                    <div>
                      <h4 className="text-xs font-semibold text-blue-700 mb-2">Core Attributes (Required)</h4>
                      <div className="border border-blue-200/60 rounded-md overflow-hidden">
                        <table className="w-full text-xs table-fixed">
                          <thead className="bg-blue-100/50 border-b border-blue-200/60">
                            <tr>
                              <th className="text-left p-2 font-medium text-gray-900 w-1/4">CheckMK Property</th>
                              <th className="text-left p-2 font-medium text-gray-900 w-1/2">Current Value</th>
                              <th className="text-left p-2 font-medium text-gray-900 w-1/4">Nautobot Field</th>
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
                                  <tr key={`core-${checkMkKey}`} className="border-b border-blue-100/50 hover:bg-blue-50/30">
                                    <td className="p-2">
                                      <div className="flex items-center gap-1.5">
                                        <code className="text-[11px] bg-blue-100/60 px-1.5 py-0.5 rounded font-mono text-blue-900">
                                          {displayKey}
                                        </code>
                                        {mapping.nautobotField === 'role' && (
                                          <Badge className="bg-orange-500 text-white text-[10px] h-4 px-1">Required</Badge>
                                        )}
                                      </div>
                                    </td>
                                    <td className="p-2">
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
                                          <SelectTrigger className={`w-48 h-7 text-xs ${!mapping.value ? 'border-orange-300' : 'border-gray-300'}`}>
                                            <SelectValue placeholder="Select role..." />
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
                                        <span className="text-xs text-gray-900 font-medium">
                                          {String(mapping.value)}
                                        </span>
                                      )}
                                    </td>
                                    <td className="p-2">
                                      <Badge className="bg-blue-600 text-white text-[10px] h-4">
                                        {mapping.nautobotField === 'name' && 'Device Name'}
                                        {mapping.nautobotField === 'primary_ip4' && 'Primary IPv4'}
                                        {mapping.nautobotField === 'location' && 'Location'}
                                        {mapping.nautobotField === 'status' && 'Status'}
                                        {mapping.nautobotField === 'role' && 'Role'}
                                      </Badge>
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
                        <h4 className="text-xs font-semibold text-purple-700 mb-2">Custom Fields & Tags</h4>
                        <div className="border border-purple-200/60 rounded-md overflow-hidden">
                          <table className="w-full text-xs table-fixed">
                            <thead className="bg-purple-50/50 border-b border-purple-200/60">
                              <tr>
                                <th className="text-left p-2 font-medium text-gray-900 w-1/4">CheckMK Property</th>
                                <th className="text-left p-2 font-medium text-gray-900 w-1/4">Current Value</th>
                                <th className="text-left p-2 font-medium text-gray-900 w-1/2">Nautobot Field</th>
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
                                    <tr key={`custom-${checkMkKey}`} className="border-b border-purple-100/50 hover:bg-purple-50/20">
                                      <td className="p-2">
                                        <code className="text-[11px] bg-purple-100/60 px-1.5 py-0.5 rounded font-mono text-purple-900">
                                          {displayKey}
                                        </code>
                                      </td>
                                      <td className="p-2">
                                        <span className="text-xs text-gray-900">
                                          {String(mapping.value)}
                                        </span>
                                      </td>
                                      <td className="p-2">
                                        <Select
                                          value={mapping.nautobotField}
                                          onValueChange={(value) => onUpdateMapping(checkMkKey, value)}
                                        >
                                          <SelectTrigger className="w-full h-7 text-xs border-gray-300">
                                            <SelectValue>
                                              {mapping.nautobotField === 'no_mapping' ? (
                                                <span className="flex items-center gap-1.5">
                                                  <Badge className="bg-gray-400 text-white text-[10px] h-4 px-1">Skip</Badge>
                                                  <span className="text-[11px]">No mapping</span>
                                                </span>
                                              ) : mapping.nautobotField.startsWith('custom_field_') ? (
                                                <span className="flex items-center gap-1.5">
                                                  <Badge className="bg-purple-600 text-white text-[10px] h-4 px-1">CF</Badge>
                                                  <span className="text-[11px]">{mapping.nautobotField.replace('custom_field_', 'cf_')}</span>
                                                </span>
                                              ) : (
                                                <span className="flex items-center gap-1.5">
                                                  <Badge className="bg-blue-600 text-white text-[10px] h-4 px-1">Core</Badge>
                                                  <span className="text-[11px]">
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
                                                </span>
                                              )}
                                            </SelectValue>
                                          </SelectTrigger>
                                            <SelectContent>
                                              <SelectItem value="no_mapping">
                                                <span className="flex items-center gap-1.5 text-xs">
                                                  <Badge className="bg-gray-400 text-white text-[10px] h-4 px-1">Skip</Badge>
                                                  No mapping
                                                </span>
                                              </SelectItem>
                                              <SelectItem disabled value="_core_separator" className="text-[10px] font-medium">— Core Attributes —</SelectItem>
                                              <SelectItem value="name" className="text-xs">Device Name</SelectItem>
                                              <SelectItem value="location" className="text-xs">Location</SelectItem>
                                              <SelectItem value="role" className="text-xs">Role</SelectItem>
                                              <SelectItem value="status" className="text-xs">Status</SelectItem>
                                              <SelectItem value="device_type" className="text-xs">Device Type</SelectItem>
                                              <SelectItem value="platform" className="text-xs">Platform</SelectItem>
                                              <SelectItem value="primary_ip4" className="text-xs">Primary IPv4</SelectItem>
                                              <SelectItem value="serial" className="text-xs">Serial Number</SelectItem>
                                              <SelectItem value="asset_tag" className="text-xs">Asset Tag</SelectItem>
                                              <SelectItem value="software_version" className="text-xs">Software Version</SelectItem>

                                              {nautobotMetadata?.customFields && nautobotMetadata.customFields.length > 0 && (
                                                <>
                                                  <SelectItem disabled value="_separator" className="text-[10px] font-medium">— Custom Fields —</SelectItem>
                                                  {nautobotMetadata.customFields.map((cf) => (
                                                    <SelectItem key={cf.id} value={`custom_field_${cf.key}`} className="text-xs">
                                                      {cf.name} (cf_{cf.key})
                                                    </SelectItem>
                                                  ))}
                                                </>
                                              )}
                                            </SelectContent>
                                          </Select>
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
                <div className="flex items-center mb-2 pb-1.5 border-b border-green-400/60">
                  <h3 className="text-sm font-semibold text-gray-900">Interface Mapping</h3>
                </div>
                <p className="text-xs text-gray-600 mb-3">
                  Select interfaces to sync and assign roles.
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
                  <Card className="border-gray-200/60 bg-gray-50/50">
                    <CardContent className="p-3">
                      <p className="text-xs text-gray-600 text-center">
                        No interfaces found in inventory. Ensure device is discovered by CheckMK.
                      </p>
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* Required Fields Notice */}
              <Card className="border-orange-200/60 bg-orange-50/50">
                <CardContent className="p-3">
                  <div className="flex items-start gap-2">
                    <div className="flex-shrink-0 text-orange-600">
                      <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-orange-800 mb-0.5">Required Fields</p>
                      <p className="text-[11px] text-orange-700">
                        Ensure required fields are mapped: <strong>name, role, status, location, device_type</strong>
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="border-t bg-gray-50/80 px-4 py-3 flex justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={checkingNautobot}
            className="text-xs"
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={onSync}
            disabled={checkingNautobot || loadingMetadata}
            className="bg-blue-600 hover:bg-blue-700 text-xs"
          >
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            Sync to Nautobot
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
