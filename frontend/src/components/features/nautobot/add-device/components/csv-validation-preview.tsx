'use client'

import { useCallback, useState } from 'react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Settings2,
  XCircle,
} from 'lucide-react'
import { CSVParseResult } from '../types'
import { useApi } from '@/hooks/use-api'

interface LookupData {
  roles: Array<{ id: string; name: string }>
  locations: Array<{ id: string; name: string; hierarchicalPath?: string }>
  deviceTypes: Array<{ id: string; model: string; display?: string }>
}

interface CSVValidationPreviewProps {
  parseResult: CSVParseResult
  lookupData: LookupData
  onShowMappingConfig: (show: boolean) => void
}

export function CSVValidationPreview({
  parseResult,
  lookupData,
  onShowMappingConfig,
}: CSVValidationPreviewProps) {
  const [isCheckingIPs, setIsCheckingIPs] = useState(false)
  const [ipCheckResults, setIpCheckResults] = useState<
    Array<{ device: string; ip: string; assignedTo: string }>
  >([])
  const [isCheckingConflicts, setIsCheckingConflicts] = useState(false)
  const [ipConflicts, setIpConflicts] = useState<Set<string>>(new Set())
  const { apiCall } = useApi()

  const errorCount = parseResult.validationErrors.filter((e) => e.severity === 'error').length
  const warningCount = parseResult.validationErrors.filter((e) => e.severity === 'warning').length

  const getRoleName = (roleIdOrName: string | undefined) => {
    if (!roleIdOrName) return null
    const role = lookupData.roles.find((r) => r.id === roleIdOrName || r.name === roleIdOrName)
    return role?.name || roleIdOrName
  }

  const getLocationName = (locationIdOrName: string | undefined) => {
    if (!locationIdOrName) return null
    const location = lookupData.locations.find(
      (l) =>
        l.id === locationIdOrName ||
        l.name === locationIdOrName ||
        l.hierarchicalPath === locationIdOrName
    )
    return location?.hierarchicalPath || location?.name || locationIdOrName
  }

  const getDeviceTypeName = (deviceTypeIdOrName: string | undefined) => {
    if (!deviceTypeIdOrName) return null
    const deviceType = lookupData.deviceTypes.find(
      (dt) =>
        dt.id === deviceTypeIdOrName ||
        dt.model === deviceTypeIdOrName ||
        dt.display === deviceTypeIdOrName
    )
    return deviceType?.display || deviceType?.model || deviceTypeIdOrName
  }

  const handleCheckIPs = useCallback(async () => {
    setIsCheckingIPs(true)
    setIpCheckResults([])

    const assignedIPs: Array<{ device: string; ip: string; assignedTo: string }> = []

    try {
      for (const device of parseResult.devices) {
        for (const iface of device.interfaces) {
          if (iface.ip_address) {
            try {
              const ipOnly = iface.ip_address.split('/')[0]
              if (!ipOnly) continue

              const data = (await apiCall(
                `nautobot/ipam/ip-addresses/detailed?address=${encodeURIComponent(ipOnly)}&get_address=true&get_name=true&get_primary_ip4_for=true&get_interfaces=false`
              )) as {
                count: number
                ip_addresses: Array<{
                  primary_ip4_for?: Array<{ name: string }>
                  interfaces?: Array<{ name: string; device: { name: string } }>
                }>
              }

              if (data.count > 0 && data.ip_addresses && data.ip_addresses.length > 0) {
                const ipData = data.ip_addresses[0]
                if (!ipData) continue

                let assignedDevice: string | null = null

                if (ipData.primary_ip4_for && ipData.primary_ip4_for.length > 0) {
                  assignedDevice = ipData.primary_ip4_for[0]?.name ?? null
                } else if (ipData.interfaces && ipData.interfaces.length > 0) {
                  assignedDevice = ipData.interfaces[0]?.device?.name ?? null
                }

                if (assignedDevice) {
                  assignedIPs.push({
                    device: device.name,
                    ip: iface.ip_address,
                    assignedTo: assignedDevice,
                  })
                }
              }
            } catch (error) {
              console.error(`Error checking IP ${iface.ip_address}:`, error)
            }
          }
        }
      }

      setIpCheckResults(assignedIPs)

      if (assignedIPs.length > 0) {
        const devicesToRemove = new Set(assignedIPs.map((r) => r.device))
        parseResult.devices = parseResult.devices.filter((d) => !devicesToRemove.has(d.name))
      }
    } catch (error) {
      console.error('Error checking IPs:', error)
    } finally {
      setIsCheckingIPs(false)
    }
  }, [parseResult, apiCall])

  const handleCheckConflicts = useCallback(async () => {
    setIsCheckingConflicts(true)
    setIpConflicts(new Set())

    const conflicts = new Set<string>()

    try {
      for (const device of parseResult.devices) {
        for (const iface of device.interfaces) {
          if (iface.ip_address) {
            try {
              const ipOnly = iface.ip_address.split('/')[0]
              if (!ipOnly) continue

              const data = (await apiCall(
                `nautobot/ipam/ip-addresses/detailed?address=${encodeURIComponent(ipOnly)}&get_address=true&get_name=true&get_primary_ip4_for=true&get_interfaces=false`
              )) as {
                count: number
                ip_addresses: Array<{
                  primary_ip4_for?: Array<{ name: string }>
                  interfaces?: Array<{ name: string; device: { name: string } }>
                }>
              }

              if (data.count > 0 && data.ip_addresses && data.ip_addresses.length > 0) {
                const ipData = data.ip_addresses[0]
                if (!ipData) continue

                let assignedDevice: string | null = null

                if (ipData.primary_ip4_for && ipData.primary_ip4_for.length > 0) {
                  assignedDevice = ipData.primary_ip4_for[0]?.name ?? null
                } else if (ipData.interfaces && ipData.interfaces.length > 0) {
                  assignedDevice = ipData.interfaces[0]?.device?.name ?? null
                }

                if (assignedDevice && assignedDevice !== device.name) {
                  conflicts.add(device.name)
                }
              }
            } catch (error) {
              console.error(`Error checking IP ${iface.ip_address}:`, error)
            }
          }
        }
      }

      setIpConflicts(conflicts)
    } catch (error) {
      console.error('Error checking IP conflicts:', error)
    } finally {
      setIsCheckingConflicts(false)
    }
  }, [parseResult, apiCall])

  return (
    <div className="space-y-3">
      {/* Summary Stats + Action Buttons */}
      <div className="flex items-center gap-4 text-sm">
        <span className="font-medium">{parseResult.devices.length} device(s) found</span>
        <span className="text-muted-foreground">from {parseResult.rowCount} row(s)</span>
        {errorCount > 0 && <Badge variant="destructive">{errorCount} error(s)</Badge>}
        {warningCount > 0 && (
          <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
            {warningCount} warning(s)
          </Badge>
        )}
        <Button
          size="sm"
          variant="outline"
          onClick={handleCheckIPs}
          disabled={isCheckingIPs || isCheckingConflicts}
          className="ml-auto"
        >
          {isCheckingIPs ? (
            <>
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              Checking...
            </>
          ) : (
            <>
              <CheckCircle2 className="h-4 w-4 mr-1" />
              Check IP
            </>
          )}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={handleCheckConflicts}
          disabled={isCheckingIPs || isCheckingConflicts}
        >
          {isCheckingConflicts ? (
            <>
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              Checking...
            </>
          ) : (
            <>
              <AlertCircle className="h-4 w-4 mr-1" />
              Check IP Conflicts
            </>
          )}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => onShowMappingConfig(true)}>
          <Settings2 className="h-4 w-4 mr-1" />
          Configure Mapping
        </Button>
      </div>

      {/* IP Check Results (devices removed) */}
      {ipCheckResults.length > 0 && (
        <Alert className="status-warning">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-2">
              <p className="font-semibold">
                {ipCheckResults.length} device(s) removed due to IP conflicts:
              </p>
              <ul className="text-xs space-y-1">
                {ipCheckResults.map((result) => (
                  <li key={`${result.device}-${result.ip}`}>
                    <strong>{result.device}</strong> - IP {result.ip} is already assigned to{' '}
                    <strong>{result.assignedTo}</strong>
                  </li>
                ))}
              </ul>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* IP Conflicts (devices marked) */}
      {ipConflicts.size > 0 && (
        <Alert className="status-error">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <p className="font-semibold">
              {ipConflicts.size} device(s) have IP conflicts (marked in red below)
            </p>
          </AlertDescription>
        </Alert>
      )}

      {/* Validation Errors */}
      {parseResult.validationErrors.length > 0 && (
        <div className="border rounded-lg p-3 bg-muted/20 max-h-40 overflow-y-auto">
          <h4 className="font-medium text-sm mb-2">Validation Issues</h4>
          <ul className="space-y-1 text-xs">
            {parseResult.validationErrors.map((error) => (
              <li
                key={`${error.deviceName}-${error.field}-${error.message}`}
                className="flex items-start gap-2"
              >
                {error.severity === 'error' ? (
                  <XCircle className="h-3 w-3 text-red-500 mt-0.5 flex-shrink-0" />
                ) : (
                  <AlertCircle className="h-3 w-3 text-yellow-500 mt-0.5 flex-shrink-0" />
                )}
                <span>
                  <strong>{error.deviceName}</strong> - {error.field}: {error.message}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Devices Preview Table */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[200px]">Device Name</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Device Type</TableHead>
              <TableHead className="text-center">Interfaces</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {parseResult.devices.slice(0, 10).map((device) => {
              const hasConflict = ipConflicts.has(device.name)
              return (
                <TableRow
                  key={device.name}
                  className={hasConflict ? 'bg-red-50 border-l-4 border-l-red-500' : ''}
                >
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {hasConflict && <AlertCircle className="h-4 w-4 text-red-500" />}
                      {device.name}
                    </div>
                  </TableCell>
                  <TableCell>
                    {getRoleName(device.role) || (
                      <span className="text-muted-foreground">default</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {getLocationName(device.location) || (
                      <span className="text-muted-foreground">default</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {getDeviceTypeName(device.device_type) || (
                      <span className="text-red-500">missing</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline">{device.interfaces.length}</Badge>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
        {parseResult.devices.length > 10 && (
          <div className="px-4 py-2 text-xs text-muted-foreground bg-muted/50">
            Showing 10 of {parseResult.devices.length} devices
          </div>
        )}
      </div>
    </div>
  )
}
