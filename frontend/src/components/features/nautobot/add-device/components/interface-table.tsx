/**
 * InterfaceTable Component - Table-based interface management for CheckMK sync
 * Each IP address gets its own row, with interface details repeated for multiple IPs
 */

import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Plus, Trash2, Settings } from 'lucide-react'
import { UseFormReturn } from 'react-hook-form'
import { useMemo } from 'react'
import type { DeviceFormValues } from '../validation'
import type { NautobotDropdownsResponse } from '../types'
import { DEFAULT_INTERFACE, DEFAULT_IP_ADDRESS } from '../constants'

interface InterfaceTableProps {
  form: UseFormReturn<DeviceFormValues>
  dropdownData: NautobotDropdownsResponse
  onOpenProperties: (interfaceId: string) => void
  isLoading: boolean
}

interface TableRow {
  interfaceIndex: number
  ipIndex: number
  interfaceId: string
  ipId: string
  isFirstIpForInterface: boolean
  totalIpsForInterface: number
  totalInterfaces: number
}

export function InterfaceTable({
  form,
  dropdownData,
  onOpenProperties,
  isLoading,
}: InterfaceTableProps) {
  const { setValue, watch, formState: { errors } } = form

  const watchedInterfaces = watch('interfaces')
  const interfaces = useMemo(() => watchedInterfaces || [], [watchedInterfaces])

  // Flatten interfaces into table rows (one row per IP address)
  const tableRows = useMemo<TableRow[]>(() => {
    const rows: TableRow[] = []
    
    interfaces.forEach((iface, interfaceIndex) => {
      const ipAddresses = iface.ip_addresses || []
      
      if (ipAddresses.length === 0) {
        // Interface without IPs still gets a row
        rows.push({
          interfaceIndex,
          ipIndex: -1,
          interfaceId: iface.id,
          ipId: '',
          isFirstIpForInterface: true,
          totalIpsForInterface: 0,
          totalInterfaces: interfaces.length,
        })
      } else {
        ipAddresses.forEach((ip, ipIndex) => {
          rows.push({
            interfaceIndex,
            ipIndex,
            interfaceId: iface.id,
            ipId: ip.id,
            isFirstIpForInterface: ipIndex === 0,
            totalIpsForInterface: ipAddresses.length,
            totalInterfaces: interfaces.length,
          })
        })
      }
    })
    
    return rows
  }, [interfaces])

  // Helper function to update interface field
  const updateInterfaceField = (interfaceIndex: number, field: string, value: string) => {
    const updatedInterfaces = interfaces.map((iface, idx) => 
      idx === interfaceIndex ? { ...iface, [field]: value } : iface
    )
    setValue('interfaces', updatedInterfaces, { shouldValidate: true })
  }

  // Helper function to update IP field
  const updateIpField = (interfaceIndex: number, ipIndex: number, field: string, value: string | boolean) => {
    const updatedInterfaces = interfaces.map((iface, idx) => {
      if (idx !== interfaceIndex) return iface
      
      const updatedIps = (iface.ip_addresses || []).map((ip, ipIdx) =>
        ipIdx === ipIndex ? { ...ip, [field]: value } : ip
      )
      
      return { ...iface, ip_addresses: updatedIps }
    })
    setValue('interfaces', updatedInterfaces, { shouldValidate: true })
  }

  const handleAddInterface = () => {
    const newId = Date.now().toString()
    const defaultNamespace = dropdownData.nautobotDefaults?.namespace ||
      (dropdownData.namespaces.length === 1 ? dropdownData.namespaces[0]?.id : '') || ''
    
    const newInterface = {
      id: newId,
      ...DEFAULT_INTERFACE,
      status: dropdownData.nautobotDefaults?.interface_status || '',
      ip_addresses: [{
        id: `${newId}-ip-1`,
        ...DEFAULT_IP_ADDRESS,
        namespace: defaultNamespace,
        ip_role: 'none',
        is_primary: false,
      }],
    }
    
    setValue('interfaces', [...interfaces, newInterface])
  }

  const handleAddIpToInterface = (interfaceIndex: number) => {
    const iface = interfaces[interfaceIndex]
    if (!iface) return
    const currentIps = iface.ip_addresses || []
    const defaultNamespace = dropdownData.nautobotDefaults?.namespace ||
      (dropdownData.namespaces.length === 1 ? dropdownData.namespaces[0]?.id : '') || ''
    
    const newIp = {
      id: `${iface.id}-ip-${Date.now()}`,
      ...DEFAULT_IP_ADDRESS,
      namespace: defaultNamespace,
      ip_role: 'secondary', // Auto-assign secondary for additional IPs
      is_primary: false,
    }
    
    // Update the entire interfaces array to ensure re-render
    const updatedInterfaces = interfaces.map((iface, idx) => 
      idx === interfaceIndex 
        ? { ...iface, ip_addresses: [...currentIps, newIp] }
        : iface
    )
    setValue('interfaces', updatedInterfaces)
  }

  const handleRemoveInterface = (interfaceIndex: number) => {
    if (interfaces.length <= 1) return // Can't remove last interface
    
    const updated = interfaces.filter((_, idx) => idx !== interfaceIndex)
    setValue('interfaces', updated)
  }

  const handleRemoveIp = (interfaceIndex: number, ipIndex: number) => {
    const iface = interfaces[interfaceIndex]
    if (!iface) return
    const currentIps = iface.ip_addresses || []
    
    if (currentIps.length <= 1) return // Can't remove last IP
    
    const updatedIps = currentIps.filter((_, idx) => idx !== ipIndex)
    
    // Update the entire interfaces array to ensure re-render
    const updatedInterfaces = interfaces.map((iface, idx) => 
      idx === interfaceIndex 
        ? { ...iface, ip_addresses: updatedIps }
        : iface
    )
    setValue('interfaces', updatedInterfaces)
  }

  const handlePrimaryChange = (interfaceIndex: number, ipIndex: number, checked: boolean) => {
    if (!checked) {
      // Don't allow unchecking - there must always be exactly one primary
      return
    }
    
    // Uncheck all other IPs across all interfaces
    const updatedInterfaces = interfaces.map((iface, ifaceIdx) => ({
      ...iface,
      ip_addresses: (iface.ip_addresses || []).map((ip, ipIdx) => ({
        ...ip,
        is_primary: ifaceIdx === interfaceIndex && ipIdx === ipIndex,
      })),
    }))
    
    setValue('interfaces', updatedInterfaces)
  }

  const handleSetValues = () => {
    // Get default values from Nautobot defaults - handle both direct and nested data structures
    const rawDefaults = dropdownData.nautobotDefaults
    const defaults = rawDefaults && 'data' in rawDefaults
      ? (rawDefaults as { data: typeof rawDefaults }).data
      : rawDefaults
    const defaultStatus = defaults?.interface_status || ''
    const defaultNamespace = defaults?.namespace ||
      (dropdownData.namespaces.length === 1 ? dropdownData.namespaces[0]?.id : '') || ''
    
    // Update all interfaces at once (same as updateInterfaceField approach)
    const updatedInterfaces = interfaces.map(iface => {
      const ifaceName = (iface.name || '').toLowerCase()
      
      // Determine interface type based on name patterns - ALWAYS set if pattern matches
      let interfaceType = iface.type
      if (ifaceName.startsWith('ethernet') || ifaceName.startsWith('fastethernet')) {
        interfaceType = '100base-tx'
      } else if (ifaceName.startsWith('gigabit')) {
        interfaceType = '1000base-t'
      } else if (ifaceName.startsWith('tengigabitethernet')) {
        interfaceType = '10gbase-t'
      } else if (ifaceName.startsWith('loop') || ifaceName.startsWith('vlan')) {
        interfaceType = 'virtual'
      } else if (ifaceName.startsWith('portchannel') || ifaceName.startsWith('bond')) {
        interfaceType = 'lag'
      }
      
      // Set status to default if we have one - ALWAYS set if default exists
      const interfaceStatus = defaultStatus ? defaultStatus : iface.status
      
      // Update IP addresses: set Namespace to default if empty
      const updatedIpAddresses = (iface.ip_addresses || []).map(ip => ({
        ...ip,
        namespace: ip.namespace || defaultNamespace,
      }))
      
      return {
        ...iface,
        type: interfaceType,
        status: interfaceStatus,
        ip_addresses: updatedIpAddresses,
      }
    })
    
    setValue('interfaces', updatedInterfaces, { shouldValidate: true })
  }

  return (
    <div className="shadow-lg border-0 p-0 bg-white rounded-lg">
      <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4 flex items-center justify-between rounded-t-lg">
        <div className="flex items-center space-x-2">
          <span className="text-sm font-medium">Network Interfaces</span>
          <Badge variant="secondary" className="bg-white/20 text-white border-white/30">
            {interfaces.length} interface{interfaces.length !== 1 ? 's' : ''}, {tableRows.length} IP{tableRows.length !== 1 ? 's' : ''}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            onClick={handleSetValues}
            disabled={isLoading}
            size="sm"
            className="bg-white/20 border-white/30 text-white hover:bg-white/30 h-7 text-xs"
          >
            <Settings className="h-3 w-3 mr-1" />
            Set Values
          </Button>
          <Button
            type="button"
            onClick={handleAddInterface}
            disabled={isLoading}
            size="sm"
            className="bg-white/20 border-white/30 text-white hover:bg-white/30 h-7 text-xs"
          >
            <Plus className="h-3 w-3 mr-1" />
            Add Interface
          </Button>
        </div>
      </div>
      
      <div className="p-4 bg-gradient-to-b from-white to-gray-50">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b-2 border-gray-300 bg-gray-50">
                <th className="text-left p-2 text-xs font-semibold text-gray-700">Interface Name</th>
                <th className="text-left p-2 text-xs font-semibold text-gray-700">Type</th>
                <th className="text-left p-2 text-xs font-semibold text-gray-700">Status</th>
                <th className="text-left p-2 text-xs font-semibold text-gray-700">IP Address</th>
                <th className="text-left p-2 text-xs font-semibold text-gray-700">Namespace</th>
                <th className="text-left p-2 text-xs font-semibold text-gray-700">Role</th>
                <th className="text-center p-2 text-xs font-semibold text-gray-700">Primary</th>
                <th className="text-center p-2 text-xs font-semibold text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {tableRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center p-8 text-muted-foreground">
                    No interfaces configured. Click &quot;Add Interface&quot; to get started.
                  </td>
                </tr>
              ) : (
                tableRows.map((row) => {
                  const iface = interfaces[row.interfaceIndex]
                  if (!iface) return null
                  const ip = row.ipIndex >= 0 ? iface.ip_addresses?.[row.ipIndex] : null
                  const interfaceErrors = errors.interfaces?.[row.interfaceIndex]
                  const ipErrors = row.ipIndex >= 0 ? interfaceErrors?.ip_addresses?.[row.ipIndex] : null

                  return (
                    <tr
                      key={`${row.interfaceId}-${row.ipId || 'no-ip'}`}
                      className={`border-b hover:bg-blue-50/30 transition-colors ${
                        row.isFirstIpForInterface ? 'border-t-2 border-blue-200' : ''
                      }`}
                    >
                      {/* Interface Name */}
                      <td className="p-2">
                        <div className="space-y-1">
                          <Input
                            value={iface.name || ''}
                            onChange={(e) => updateInterfaceField(row.interfaceIndex, 'name', e.target.value)}
                            placeholder="e.g., eth0"
                            disabled={isLoading}
                            className="border-2 border-slate-300 bg-white focus:border-blue-500 text-xs h-8 min-w-[120px]"
                          />
                          {row.isFirstIpForInterface && interfaceErrors?.name && (
                            <p className="text-xs text-destructive">{interfaceErrors.name.message}</p>
                          )}
                        </div>
                      </td>

                      {/* Interface Type */}
                      <td className="p-2">
                        <div className="space-y-1">
                          <Select
                            value={iface.type || ''}
                            onValueChange={(value) => updateInterfaceField(row.interfaceIndex, 'type', value)}
                            disabled={isLoading}
                          >
                            <SelectTrigger className="border-2 border-slate-300 bg-white focus:border-blue-500 text-xs h-8 min-w-[140px]">
                              <SelectValue placeholder="Select..." />
                            </SelectTrigger>
                            <SelectContent>
                              {dropdownData.interfaceTypes.map((type) => (
                                <SelectItem key={type.value} value={type.value}>
                                  {type.display_name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {row.isFirstIpForInterface && interfaceErrors?.type && (
                            <p className="text-xs text-destructive">{interfaceErrors.type.message}</p>
                          )}
                        </div>
                      </td>

                      {/* Interface Status */}
                      <td className="p-2">
                        <div className="space-y-1">
                          <Select
                            value={iface.status || ''}
                            onValueChange={(value) => updateInterfaceField(row.interfaceIndex, 'status', value)}
                            disabled={isLoading}
                          >
                            <SelectTrigger className="border-2 border-slate-300 bg-white focus:border-blue-500 text-xs h-8 min-w-[100px]">
                              <SelectValue placeholder="Select..." />
                            </SelectTrigger>
                            <SelectContent>
                              {dropdownData.interfaceStatuses.map((status) => (
                                <SelectItem key={status.id} value={status.id}>
                                  {status.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {row.isFirstIpForInterface && interfaceErrors?.status && (
                            <p className="text-xs text-destructive">{interfaceErrors.status.message}</p>
                          )}
                        </div>
                      </td>

                      {/* IP Address */}
                      <td className="p-2">
                        {ip ? (
                          <div className="space-y-1">
                            <Input
                              value={ip.address || ''}
                              onChange={(e) => updateIpField(row.interfaceIndex, row.ipIndex, 'address', e.target.value)}
                              placeholder="192.168.1.10/24"
                              disabled={isLoading}
                              className="border-2 border-slate-300 bg-white focus:border-blue-500 text-xs h-8 min-w-[140px]"
                            />
                            {ipErrors?.address && (
                              <p className="text-xs text-destructive">{ipErrors.address.message}</p>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">No IP</span>
                        )}
                      </td>

                      {/* Namespace */}
                      <td className="p-2">
                        {ip ? (
                          <div className="space-y-1">
                            <Select
                              value={ip.namespace || ''}
                              onValueChange={(value) => updateIpField(row.interfaceIndex, row.ipIndex, 'namespace', value)}
                              disabled={isLoading}
                            >
                              <SelectTrigger className="border-2 border-slate-300 bg-white focus:border-blue-500 text-xs h-8 min-w-[120px]">
                                <SelectValue placeholder="Select..." />
                              </SelectTrigger>
                              <SelectContent>
                                {dropdownData.namespaces.map((ns) => (
                                  <SelectItem key={ns.id} value={ns.id}>
                                    {ns.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {ipErrors?.namespace && (
                              <p className="text-xs text-destructive">{ipErrors.namespace.message}</p>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </td>

                      {/* IP Role */}
                      <td className="p-2">
                        {ip ? (
                          <Select
                            value={ip.ip_role || 'none'}
                            onValueChange={(value) => updateIpField(row.interfaceIndex, row.ipIndex, 'ip_role', value)}
                            disabled={isLoading}
                          >
                            <SelectTrigger className="border-2 border-slate-300 bg-white focus:border-blue-500 text-xs h-8 min-w-[110px]">
                              <SelectValue placeholder="Select..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">None</SelectItem>
                              <SelectItem value="secondary">Secondary</SelectItem>
                              {dropdownData.ipRoles.map((role) => (
                                <SelectItem key={role.id} value={role.id}>
                                  {role.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </td>

                      {/* Primary Checkbox */}
                      <td className="p-2 text-center">
                        {ip ? (
                          <Checkbox
                            checked={ip.is_primary || false}
                            onCheckedChange={(checked) => handlePrimaryChange(row.interfaceIndex, row.ipIndex, checked as boolean)}
                            disabled={isLoading}
                          />
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="p-2">
                        <div className="flex items-center justify-start gap-1">
                          {/* Properties Button - only show for first IP of each interface */}
                          {row.isFirstIpForInterface ? (
                            <Button
                              type="button"
                              onClick={() => onOpenProperties(row.interfaceIndex.toString())}
                              disabled={isLoading}
                              size="sm"
                              variant="outline"
                              className="h-7 px-2"
                              title="Interface Properties"
                            >
                              <Settings className="h-3 w-3" />
                            </Button>
                          ) : (
                            <div className="h-7 w-[36px]" />
                          )}

                          {/* Add IP Button - only show for first IP of each interface */}
                          {row.isFirstIpForInterface ? (
                            <Button
                              type="button"
                              onClick={() => handleAddIpToInterface(row.interfaceIndex)}
                              disabled={isLoading}
                              size="sm"
                              variant="outline"
                              className="h-7 px-2"
                              title="Add IP Address"
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                          ) : (
                            <div className="h-7 w-[36px]" />
                          )}

                          {/* Remove IP Button - show for all rows with IPs (disabled if only 1 IP) */}
                          {ip && (
                            <Button
                              type="button"
                              onClick={() => handleRemoveIp(row.interfaceIndex, row.ipIndex)}
                              disabled={isLoading || row.totalIpsForInterface <= 1}
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2"
                              title={row.totalIpsForInterface <= 1 ? "Cannot remove last IP" : "Remove IP Address"}
                            >
                              <Trash2 className={`h-3 w-3 ${row.totalIpsForInterface > 1 ? 'text-orange-600' : 'text-gray-400'}`} />
                            </Button>
                          )}

                          {/* Remove Interface Button - only show for first IP of each interface */}
                          {row.isFirstIpForInterface ? (
                            <Button
                              type="button"
                              onClick={() => handleRemoveInterface(row.interfaceIndex)}
                              disabled={isLoading || row.totalInterfaces <= 1}
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2"
                              title={row.totalInterfaces <= 1 ? "Cannot remove last interface" : "Remove Interface"}
                            >
                              <Trash2 className={`h-3 w-3 ${row.totalInterfaces > 1 ? 'text-destructive' : 'text-gray-400'}`} />
                            </Button>
                          ) : (
                            <div className="h-7 w-[36px]" />
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
