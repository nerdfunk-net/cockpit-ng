import React, { useState, useMemo, useEffect } from 'react'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { CheckMKInterface, CheckMKAddress } from '@/lib/checkmk/interface-mapping-utils'
import { getAdminStatusLabel, getOperStatusLabel, formatSpeed } from '@/lib/checkmk/interface-mapping-utils'

interface InterfaceMappingTableProps {
  interfaces: CheckMKInterface[]
  ipAddressStatuses: Array<{ id: string; name: string }> | null
  ipAddressRoles: Array<{ id: string; name: string }> | null
  onInterfaceMappingsChange?: (mappings: Record<string, { enabled: boolean; ipRole: string; status: string; ipAddress: string; interfaceName: string; isPrimary: boolean }>) => void
}

export interface InterfaceMapping {
  enabled: boolean
  ipRole: string
  status: string
  ipAddress: string
  interfaceName: string
  isPrimary: boolean
}

// Flattened row structure: one row per IP address
interface IPAddressRow {
  interface: CheckMKInterface
  ipAddress: CheckMKAddress
  rowKey: string // Unique key: "interfaceIndex-ipAddress"
}

export function InterfaceMappingTable({ interfaces, ipAddressStatuses, ipAddressRoles, onInterfaceMappingsChange }: InterfaceMappingTableProps) {
  // Flatten interfaces into IP address rows
  const ipAddressRows = useMemo<IPAddressRow[]>(() => {
    const rows: IPAddressRow[] = []
    interfaces.forEach((iface) => {
      if (iface.ipAddresses.length > 0) {
        iface.ipAddresses.forEach((ipAddr) => {
          rows.push({
            interface: iface,
            ipAddress: ipAddr,
            rowKey: `${iface.index}-${ipAddr.address}`,
          })
        })
      }
    })
    return rows
  }, [interfaces])

  // State for IP address mappings: rowKey -> { enabled, ipRole, status, ipAddress, interfaceName, isPrimary }
  const [ipMappings, setIpMappings] = useState<Record<string, { enabled: boolean; ipRole: string; status: string; ipAddress: string; interfaceName: string; isPrimary: boolean }>>(() => {
    // Initialize with all IP addresses enabled and default IP role/status
    const initial: Record<string, { enabled: boolean; ipRole: string; status: string; ipAddress: string; interfaceName: string; isPrimary: boolean }> = {}
    const defaultStatus = ipAddressStatuses?.[0]?.name || 'Active'
    const defaultIpRole = 'none' // Default to 'none' - no role assigned

    ipAddressRows.forEach((row, index) => {
      initial[row.rowKey] = {
        enabled: row.interface.oper_status === 1, // Enable only if interface is operationally up
        ipRole: defaultIpRole,
        status: defaultStatus,
        ipAddress: `${row.ipAddress.address}/${row.ipAddress.cidr}`, // Default value from inventory
        interfaceName: row.interface.name, // Default interface name from inventory
        isPrimary: index === 0 && row.interface.oper_status === 1, // First enabled interface is primary by default
      }
    })
    return initial
  })

  // Notify parent of changes using useEffect to avoid calling setState during render
  useEffect(() => {
    onInterfaceMappingsChange?.(ipMappings)
  }, [ipMappings, onInterfaceMappingsChange])

  const handleToggleIpAddress = (rowKey: string) => {
    setIpMappings((prev) => ({
      ...prev,
      [rowKey]: {
        enabled: !prev[rowKey]?.enabled,
        ipRole: prev[rowKey]?.ipRole || 'none',
        status: prev[rowKey]?.status || ipAddressStatuses?.[0]?.name || 'Active',
        ipAddress: prev[rowKey]?.ipAddress || '',
        interfaceName: prev[rowKey]?.interfaceName || '',
        isPrimary: prev[rowKey]?.isPrimary || false,
      },
    }))
  }

  const handleIpRoleChange = (rowKey: string, ipRole: string) => {
    setIpMappings((prev) => ({
      ...prev,
      [rowKey]: {
        enabled: prev[rowKey]?.enabled || false,
        ipRole: ipRole || 'none',
        status: prev[rowKey]?.status || ipAddressStatuses?.[0]?.name || 'Active',
        ipAddress: prev[rowKey]?.ipAddress || '',
        interfaceName: prev[rowKey]?.interfaceName || '',
        isPrimary: prev[rowKey]?.isPrimary || false,
      },
    }))
  }

  const handleStatusChange = (rowKey: string, status: string) => {
    setIpMappings((prev) => ({
      ...prev,
      [rowKey]: {
        enabled: prev[rowKey]?.enabled || false,
        ipRole: prev[rowKey]?.ipRole || 'none',
        status,
        ipAddress: prev[rowKey]?.ipAddress || '',
        interfaceName: prev[rowKey]?.interfaceName || '',
        isPrimary: prev[rowKey]?.isPrimary || false,
      },
    }))
  }

  const handleIpAddressChange = (rowKey: string, ipAddress: string) => {
    setIpMappings((prev) => ({
      ...prev,
      [rowKey]: {
        enabled: prev[rowKey]?.enabled || false,
        ipRole: prev[rowKey]?.ipRole || 'none',
        status: prev[rowKey]?.status || ipAddressStatuses?.[0]?.name || 'Active',
        ipAddress,
        interfaceName: prev[rowKey]?.interfaceName || '',
        isPrimary: prev[rowKey]?.isPrimary || false,
      },
    }))
  }

  const handleInterfaceNameChange = (rowKey: string, interfaceName: string) => {
    setIpMappings((prev) => ({
      ...prev,
      [rowKey]: {
        enabled: prev[rowKey]?.enabled || false,
        ipRole: prev[rowKey]?.ipRole || 'none',
        status: prev[rowKey]?.status || ipAddressStatuses?.[0]?.name || 'Active',
        ipAddress: prev[rowKey]?.ipAddress || '',
        interfaceName,
        isPrimary: prev[rowKey]?.isPrimary || false,
      },
    }))
  }

  const handleSetPrimary = (rowKey: string) => {
    setIpMappings((prev) => {
      const updated: Record<string, InterfaceMapping> = {}
      // Clear all isPrimary flags
      Object.keys(prev).forEach(key => {
        const existing = prev[key]
        if (existing) {
          updated[key] = {
            enabled: existing.enabled,
            ipRole: existing.ipRole,
            status: existing.status,
            ipAddress: existing.ipAddress,
            interfaceName: existing.interfaceName,
            isPrimary: false,
          }
        }
      })
      // Set the selected one as primary
      if (updated[rowKey]) {
        updated[rowKey] = { ...updated[rowKey], isPrimary: true }
      }
      return updated
    })
  }

  // Filter out rows from Null interfaces
  const displayedRows = useMemo(() => {
    return ipAddressRows.filter((row) => {
      const name = row.interface.name.toLowerCase()
      return !name.includes('null') // Show all except Null interfaces
    })
  }, [ipAddressRows])

  if (ipAddressRows.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No IP addresses found in inventory data
      </div>
    )
  }

  return (
    <div className="border border-green-200/60 rounded-md overflow-hidden">
      <table className="w-full text-xs">
        <thead className="bg-green-50/50 border-b border-green-200/60">
          <tr>
            <th className="text-left p-2 font-medium text-gray-900 w-14">Sync</th>
            <th className="text-left p-2 font-medium text-gray-900 w-16">Primary</th>
            <th className="text-left p-2 font-medium text-gray-900">Interface</th>
            <th className="text-left p-2 font-medium text-gray-900">IP Address</th>
            <th className="text-left p-2 font-medium text-gray-900">IP Role</th>
            <th className="text-left p-2 font-medium text-gray-900">Status</th>
            <th className="text-left p-2 font-medium text-gray-900">Details</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y">
          {displayedRows.map((row) => {
            const mapping = ipMappings[row.rowKey] || {
              enabled: false,
              ipRole: 'none',
              status: ipAddressStatuses?.[0]?.name || 'Active',
              ipAddress: `${row.ipAddress.address}/${row.ipAddress.cidr}`,
              interfaceName: row.interface.name,
              isPrimary: false,
            }
            const adminStatus = getAdminStatusLabel(row.interface.admin_status)
            const operStatus = getOperStatusLabel(row.interface.oper_status)

            return (
              <tr key={row.rowKey} className={`hover:bg-green-50/30 ${!mapping.enabled ? 'opacity-50' : ''}`}>
                {/* Sync checkbox */}
                <td className="p-2 align-top">
                  <div className="pt-1">
                    <Checkbox
                      checked={mapping.enabled}
                      onCheckedChange={() => handleToggleIpAddress(row.rowKey)}
                    />
                  </div>
                </td>

                {/* Primary IP radio button */}
                <td className="p-2 align-top">
                  <div className="pt-1">
                    <input
                      type="radio"
                      name="primaryIp"
                      checked={mapping.isPrimary}
                      onChange={() => handleSetPrimary(row.rowKey)}
                      disabled={!mapping.enabled}
                      className="w-4 h-4 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                    />
                  </div>
                </td>

                {/* Editable Interface name */}
                <td className="p-2 align-top">
                  <div className="space-y-0.5">
                    <input
                      type="text"
                      value={mapping.interfaceName}
                      onChange={(e) => handleInterfaceNameChange(row.rowKey, e.target.value)}
                      disabled={!mapping.enabled}
                      className="w-full px-2 py-1 text-xs border border-gray-300 rounded font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-500"
                      placeholder="Ethernet0/0"
                    />
                    <div className="text-[10px] text-gray-500 h-3.5">
                      {row.interface.alias ? `Alias: ${row.interface.alias}` : '\u00A0'}
                    </div>
                  </div>
                </td>

                {/* Editable IP Address */}
                <td className="p-2 align-top">
                  <input
                    type="text"
                    value={mapping.ipAddress}
                    onChange={(e) => handleIpAddressChange(row.rowKey, e.target.value)}
                    disabled={!mapping.enabled}
                    className="w-full px-2 py-1 text-xs border border-gray-300 rounded font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-500"
                    placeholder="192.168.1.1/24"
                  />
                </td>

                {/* IP Role selector */}
                <td className="p-2 align-top">
                  <Select
                    value={mapping.ipRole}
                    onValueChange={(value) => handleIpRoleChange(row.rowKey, value)}
                    disabled={!mapping.enabled}
                  >
                    <SelectTrigger className="h-7 text-xs bg-white border-gray-300">
                      <SelectValue placeholder="Select IP role..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none" className="text-xs">
                        (none)
                      </SelectItem>
                      {ipAddressRoles && ipAddressRoles.length > 0 ? (
                        ipAddressRoles.map((role) => (
                          <SelectItem key={role.id} value={role.name} className="text-xs">
                            {role.name}
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="loading" disabled className="text-xs">
                          Loading roles...
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </td>

                {/* Status selector (for IP address status in Nautobot) */}
                <td className="p-2 align-top">
                  <Select
                    value={mapping.status}
                    onValueChange={(value) => handleStatusChange(row.rowKey, value)}
                    disabled={!mapping.enabled}
                  >
                    <SelectTrigger className="h-7 text-xs bg-white border-gray-300">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ipAddressStatuses && ipAddressStatuses.length > 0 ? (
                        ipAddressStatuses.map((status) => (
                          <SelectItem key={status.id} value={status.name} className="text-xs">
                            {status.name}
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="loading" disabled className="text-xs">
                          Loading statuses...
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </td>

                {/* Details */}
                <td className="p-2 align-top">
                  <div className="space-y-0.5 text-[11px] text-gray-600">
                    <div className="flex items-center gap-1.5">
                      <span>Admin:</span>
                      <Badge
                        className={`text-[10px] h-4 px-1 ${
                          adminStatus === 'Up' ? 'bg-green-500' : 'bg-red-500'
                        }`}
                      >
                        {adminStatus}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span>Oper:</span>
                      <Badge
                        className={`text-[10px] h-4 px-1 ${
                          operStatus === 'Up' ? 'bg-green-500' : 'bg-red-500'
                        }`}
                      >
                        {operStatus}
                      </Badge>
                    </div>
                    {row.interface.phys_address && (
                      <div>MAC: {row.interface.phys_address}</div>
                    )}
                    <div>Speed: {formatSpeed(row.interface.speed)}</div>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {/* Summary */}
      <div className="bg-green-50/30 px-3 py-2 border-t border-green-200/60 text-[11px] text-gray-600">
        <div className="flex gap-4">
          <span>
            <strong>Total:</strong> {displayedRows.length} IP addresses
          </span>
          <span>
            <strong>Enabled:</strong>{' '}
            {Object.values(ipMappings).filter((m) => m.enabled).length}
          </span>
          <span>
            <strong>Up/Up:</strong>{' '}
            {displayedRows.filter((r) => r.interface.admin_status === 1 && r.interface.oper_status === 1).length}
          </span>
        </div>
      </div>
    </div>
  )
}
