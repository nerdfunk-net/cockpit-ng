import React, { useState, useMemo } from 'react'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { CheckMKInterface } from '@/lib/checkmk/interface-mapping-utils'
import { getAdminStatusLabel, getOperStatusLabel, formatSpeed } from '@/lib/checkmk/interface-mapping-utils'

interface InterfaceMappingTableProps {
  interfaces: CheckMKInterface[]
  ipAddressStatuses: Array<{ id: string; name: string }> | null
}

// Interface role options
const INTERFACE_ROLES = [
  { value: 'none', label: 'None' },
  { value: 'management', label: 'Management' },
  { value: 'access', label: 'Access' },
  { value: 'trunk', label: 'Trunk' },
  { value: 'uplink', label: 'Uplink' },
  { value: 'loopback', label: 'Loopback' },
  { value: 'null', label: 'Null' },
] as const

export function InterfaceMappingTable({ interfaces, ipAddressStatuses }: InterfaceMappingTableProps) {
  // State for interface mappings: interfaceIndex -> { enabled, role, status }
  const [interfaceMappings, setInterfaceMappings] = useState<Record<number, { enabled: boolean; role: string; status: string }>>(() => {
    // Initialize with all interfaces enabled and role "none"
    const initial: Record<number, { enabled: boolean; role: string; status: string }> = {}
    // Get default status (first available status or "Active")
    const defaultStatus = ipAddressStatuses?.[0]?.name || 'Active'

    interfaces.forEach((iface) => {
      // Auto-detect role based on interface name
      let defaultRole = 'none'
      const name = iface.name.toLowerCase()
      if (name.includes('null')) {
        defaultRole = 'null'
      } else if (name.includes('loopback') || name.includes('lo')) {
        defaultRole = 'loopback'
      } else if (name.includes('mgmt') || name.includes('management')) {
        defaultRole = 'management'
      }

      initial[iface.index] = {
        enabled: iface.oper_status === 1, // Enable only if operationally up
        role: defaultRole,
        status: defaultStatus,
      }
    })
    return initial
  })

  const handleToggleInterface = (index: number) => {
    setInterfaceMappings((prev) => ({
      ...prev,
      [index]: {
        enabled: !prev[index]?.enabled,
        role: prev[index]?.role || 'none',
        status: prev[index]?.status || ipAddressStatuses?.[0]?.name || 'Active',
      },
    }))
  }

  const handleRoleChange = (index: number, role: string) => {
    setInterfaceMappings((prev) => ({
      ...prev,
      [index]: {
        enabled: prev[index]?.enabled || false,
        role,
        status: prev[index]?.status || ipAddressStatuses?.[0]?.name || 'Active',
      },
    }))
  }

  const handleStatusChange = (index: number, status: string) => {
    setInterfaceMappings((prev) => ({
      ...prev,
      [index]: {
        enabled: prev[index]?.enabled || false,
        role: prev[index]?.role || 'none',
        status,
      },
    }))
  }

  // Filter out Null interfaces by default (user can still enable them)
  const displayedInterfaces = useMemo(() => {
    return interfaces.filter((iface) => {
      const name = iface.name.toLowerCase()
      return !name.includes('null') // Show all except Null interfaces
    })
  }, [interfaces])

  if (interfaces.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No interfaces found in inventory data
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
            <th className="text-left p-3 font-semibold text-gray-900">IP Addresses</th>
            <th className="text-left p-3 font-semibold text-gray-900">Role</th>
            <th className="text-left p-3 font-semibold text-gray-900">Status</th>
            <th className="text-left p-3 font-semibold text-gray-900">Details</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y">
          {displayedInterfaces.map((iface) => {
            const mapping = interfaceMappings[iface.index] || { enabled: false, role: 'none', status: ipAddressStatuses?.[0]?.name || 'Active' }
            const adminStatus = getAdminStatusLabel(iface.admin_status)
            const operStatus = getOperStatusLabel(iface.oper_status)

            return (
              <tr key={iface.index} className={`hover:bg-blue-50 ${!mapping.enabled ? 'opacity-50' : ''}`}>
                {/* Sync checkbox */}
                <td className="p-3">
                  <Checkbox
                    checked={mapping.enabled}
                    onCheckedChange={() => handleToggleInterface(iface.index)}
                  />
                </td>

                {/* Interface name */}
                <td className="p-3">
                  <div className="space-y-1">
                    <code className="text-xs bg-blue-100 px-2 py-1 rounded font-mono text-blue-900">
                      {iface.name}
                    </code>
                    {iface.alias && (
                      <div className="text-xs text-gray-500">Alias: {iface.alias}</div>
                    )}
                  </div>
                </td>

                {/* IP Addresses */}
                <td className="p-3">
                  {iface.ipAddresses.length > 0 ? (
                    <div className="space-y-1">
                      {iface.ipAddresses.map((addr, idx) => (
                        <div key={idx} className="text-xs">
                          <code className="bg-green-100 px-2 py-0.5 rounded text-green-900">
                            {addr.address}/{addr.cidr}
                          </code>
                          <span className="text-gray-500 ml-1">({addr.type})</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span className="text-xs text-gray-400 italic">No IP</span>
                  )}
                </td>

                {/* Role selector */}
                <td className="p-3">
                  <Select
                    value={mapping.role}
                    onValueChange={(value) => handleRoleChange(iface.index, value)}
                    disabled={!mapping.enabled}
                  >
                    <SelectTrigger className="w-full bg-white border-gray-300">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {INTERFACE_ROLES.map((role) => (
                        <SelectItem key={role.value} value={role.value}>
                          {role.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </td>

                {/* Status selector (for IP address status in Nautobot) */}
                <td className="p-3">
                  <Select
                    value={mapping.status}
                    onValueChange={(value) => handleStatusChange(iface.index, value)}
                    disabled={!mapping.enabled || !iface.ipAddresses.length}
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
                    {iface.phys_address && (
                      <div>MAC: {iface.phys_address}</div>
                    )}
                    <div>Speed: {formatSpeed(iface.speed)}</div>
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
            <strong>Total:</strong> {displayedInterfaces.length} interfaces
          </span>
          <span>
            <strong>Enabled:</strong>{' '}
            {Object.values(interfaceMappings).filter((m) => m.enabled).length}
          </span>
          <span>
            <strong>Up/Up:</strong>{' '}
            {displayedInterfaces.filter((i) => i.admin_status === 1 && i.oper_status === 1).length}
          </span>
        </div>
      </div>
    </div>
  )
}
