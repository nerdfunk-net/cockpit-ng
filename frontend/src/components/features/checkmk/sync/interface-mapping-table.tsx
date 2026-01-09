import React, { useState, useMemo } from 'react'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { CheckMKInterface, CheckMKAddress } from '@/lib/checkmk/interface-mapping-utils'
import { getAdminStatusLabel, getOperStatusLabel, formatSpeed } from '@/lib/checkmk/interface-mapping-utils'

interface InterfaceMappingTableProps {
  interfaces: CheckMKInterface[]
  ipAddressStatuses: Array<{ id: string; name: string }> | null
  ipAddressRoles: Array<{ id: string; name: string }> | null
}

// Flattened row structure: one row per IP address
interface IPAddressRow {
  interface: CheckMKInterface
  ipAddress: CheckMKAddress
  rowKey: string // Unique key: "interfaceIndex-ipAddress"
}

export function InterfaceMappingTable({ interfaces, ipAddressStatuses, ipAddressRoles }: InterfaceMappingTableProps) {
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

  // State for IP address mappings: rowKey -> { enabled, ipRole, status, ipAddress, interfaceName }
  const [ipMappings, setIpMappings] = useState<Record<string, { enabled: boolean; ipRole: string; status: string; ipAddress: string; interfaceName: string }>>(() => {
    // Initialize with all IP addresses enabled and default IP role/status
    const initial: Record<string, { enabled: boolean; ipRole: string; status: string; ipAddress: string; interfaceName: string }> = {}
    const defaultStatus = ipAddressStatuses?.[0]?.name || 'Active'
    const defaultIpRole = ipAddressRoles?.[0]?.name || ''

    ipAddressRows.forEach((row) => {
      initial[row.rowKey] = {
        enabled: row.interface.oper_status === 1, // Enable only if interface is operationally up
        ipRole: defaultIpRole,
        status: defaultStatus,
        ipAddress: `${row.ipAddress.address}/${row.ipAddress.cidr}`, // Default value from inventory
        interfaceName: row.interface.name, // Default interface name from inventory
      }
    })
    return initial
  })

  const handleToggleIpAddress = (rowKey: string) => {
    setIpMappings((prev) => ({
      ...prev,
      [rowKey]: {
        enabled: !prev[rowKey]?.enabled,
        ipRole: prev[rowKey]?.ipRole || ipAddressRoles?.[0]?.name || '',
        status: prev[rowKey]?.status || ipAddressStatuses?.[0]?.name || 'Active',
        ipAddress: prev[rowKey]?.ipAddress || '',
        interfaceName: prev[rowKey]?.interfaceName || '',
      },
    }))
  }

  const handleIpRoleChange = (rowKey: string, ipRole: string) => {
    setIpMappings((prev) => ({
      ...prev,
      [rowKey]: {
        enabled: prev[rowKey]?.enabled || false,
        ipRole,
        status: prev[rowKey]?.status || ipAddressStatuses?.[0]?.name || 'Active',
        ipAddress: prev[rowKey]?.ipAddress || '',
        interfaceName: prev[rowKey]?.interfaceName || '',
      },
    }))
  }

  const handleStatusChange = (rowKey: string, status: string) => {
    setIpMappings((prev) => ({
      ...prev,
      [rowKey]: {
        enabled: prev[rowKey]?.enabled || false,
        ipRole: prev[rowKey]?.ipRole || ipAddressRoles?.[0]?.name || '',
        status,
        ipAddress: prev[rowKey]?.ipAddress || '',
        interfaceName: prev[rowKey]?.interfaceName || '',
      },
    }))
  }

  const handleIpAddressChange = (rowKey: string, ipAddress: string) => {
    setIpMappings((prev) => ({
      ...prev,
      [rowKey]: {
        enabled: prev[rowKey]?.enabled || false,
        ipRole: prev[rowKey]?.ipRole || ipAddressRoles?.[0]?.name || '',
        status: prev[rowKey]?.status || ipAddressStatuses?.[0]?.name || 'Active',
        ipAddress,
        interfaceName: prev[rowKey]?.interfaceName || '',
      },
    }))
  }

  const handleInterfaceNameChange = (rowKey: string, interfaceName: string) => {
    setIpMappings((prev) => ({
      ...prev,
      [rowKey]: {
        enabled: prev[rowKey]?.enabled || false,
        ipRole: prev[rowKey]?.ipRole || ipAddressRoles?.[0]?.name || '',
        status: prev[rowKey]?.status || ipAddressStatuses?.[0]?.name || 'Active',
        ipAddress: prev[rowKey]?.ipAddress || '',
        interfaceName,
      },
    }))
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
    <div className="border rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-blue-100 border-b">
          <tr>
            <th className="text-left p-3 font-semibold text-gray-900 w-16">Sync</th>
            <th className="text-left p-3 font-semibold text-gray-900">Interface</th>
            <th className="text-left p-3 font-semibold text-gray-900">IP Address</th>
            <th className="text-left p-3 font-semibold text-gray-900">IP Role</th>
            <th className="text-left p-3 font-semibold text-gray-900">Status</th>
            <th className="text-left p-3 font-semibold text-gray-900">Details</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y">
          {displayedRows.map((row) => {
            const mapping = ipMappings[row.rowKey] || {
              enabled: false,
              ipRole: ipAddressRoles?.[0]?.name || '',
              status: ipAddressStatuses?.[0]?.name || 'Active',
              ipAddress: `${row.ipAddress.address}/${row.ipAddress.cidr}`,
              interfaceName: row.interface.name,
            }
            const adminStatus = getAdminStatusLabel(row.interface.admin_status)
            const operStatus = getOperStatusLabel(row.interface.oper_status)

            return (
              <tr key={row.rowKey} className={`hover:bg-blue-50 ${!mapping.enabled ? 'opacity-50' : ''}`}>
                {/* Sync checkbox */}
                <td className="p-3">
                  <Checkbox
                    checked={mapping.enabled}
                    onCheckedChange={() => handleToggleIpAddress(row.rowKey)}
                  />
                </td>

                {/* Editable Interface name */}
                <td className="p-3">
                  <div className="space-y-1">
                    <input
                      type="text"
                      value={mapping.interfaceName}
                      onChange={(e) => handleInterfaceNameChange(row.rowKey, e.target.value)}
                      disabled={!mapping.enabled}
                      className="w-full px-2 py-1 text-xs border border-gray-300 rounded font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-500"
                      placeholder="Ethernet0/0"
                    />
                    {row.interface.alias && (
                      <div className="text-xs text-gray-500">Alias: {row.interface.alias}</div>
                    )}
                  </div>
                </td>

                {/* Editable IP Address */}
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={mapping.ipAddress}
                      onChange={(e) => handleIpAddressChange(row.rowKey, e.target.value)}
                      disabled={!mapping.enabled}
                      className="w-full px-2 py-1 text-xs border border-gray-300 rounded font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-500"
                      placeholder="192.168.1.1/24"
                    />
                    <span className="text-xs text-gray-500 whitespace-nowrap">({row.ipAddress.type})</span>
                  </div>
                </td>

                {/* IP Role selector */}
                <td className="p-3">
                  <Select
                    value={mapping.ipRole}
                    onValueChange={(value) => handleIpRoleChange(row.rowKey, value)}
                    disabled={!mapping.enabled}
                  >
                    <SelectTrigger className="w-full bg-white border-gray-300">
                      <SelectValue placeholder="Select IP role..." />
                    </SelectTrigger>
                    <SelectContent>
                      {ipAddressRoles && ipAddressRoles.length > 0 ? (
                        ipAddressRoles.map((role) => (
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
                </td>

                {/* Status selector (for IP address status in Nautobot) */}
                <td className="p-3">
                  <Select
                    value={mapping.status}
                    onValueChange={(value) => handleStatusChange(row.rowKey, value)}
                    disabled={!mapping.enabled}
                  >
                    <SelectTrigger className="w-full bg-white border-gray-300">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ipAddressStatuses && ipAddressStatuses.length > 0 ? (
                        ipAddressStatuses.map((status) => (
                          <SelectItem key={status.id} value={status.name}>
                            {status.name}
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="loading" disabled>
                          Loading statuses...
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </td>

                {/* Details */}
                <td className="p-3">
                  <div className="space-y-1 text-xs text-gray-600">
                    <div className="flex items-center gap-2">
                      <span>Admin:</span>
                      <Badge
                        className={`text-xs ${
                          adminStatus === 'Up' ? 'bg-green-500' : 'bg-red-500'
                        }`}
                      >
                        {adminStatus}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <span>Oper:</span>
                      <Badge
                        className={`text-xs ${
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
      <div className="bg-gray-50 px-4 py-3 border-t text-xs text-gray-600">
        <div className="flex gap-6">
          <span>
            <strong>Total:</strong> {displayedRows.length} IP addresses
          </span>
          <span>
            <strong>Enabled:</strong>{' '}
            {Object.values(ipMappings).filter((m) => m.enabled).length}
          </span>
          <span>
            <strong>Interfaces Up/Up:</strong>{' '}
            {displayedRows.filter((r) => r.interface.admin_status === 1 && r.interface.oper_status === 1).length}
          </span>
        </div>
      </div>
    </div>
  )
}
