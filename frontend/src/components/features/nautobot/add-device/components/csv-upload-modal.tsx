'use client'

import { useCallback, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Upload,
  FileSpreadsheet,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Settings2,
  HelpCircle,
} from 'lucide-react'
import {
  CSVParseResult,
  ImportSummary,
  NAUTOBOT_DEVICE_FIELDS,
  NAUTOBOT_INTERFACE_FIELDS,
} from '../types'
import { useApi } from '@/hooks/use-api'

interface LookupData {
  roles: Array<{ id: string; name: string }>
  locations: Array<{ id: string; name: string; hierarchicalPath?: string }>
  deviceTypes: Array<{ id: string; model: string; display?: string }>
}

interface CSVUploadModalProps {
  showModal: boolean
  onClose: () => void
  csvFile: File | null
  parseResult: CSVParseResult | null
  isParsing: boolean
  parseError: string
  isImporting: boolean
  importProgress: { current: number; total: number }
  importSummary: ImportSummary | null
  columnMappings: Record<string, string>
  showMappingConfig: boolean
  lookupData: LookupData
  onFileSelect: (file: File) => void
  onImport: () => void
  onUpdateMapping: (csvColumn: string, nautobotField: string) => void
  onApplyMappings: () => void
  onShowMappingConfig: (show: boolean) => void
  onReset: () => void
}

export function CSVUploadModal({
  showModal,
  onClose,
  csvFile,
  parseResult,
  isParsing,
  parseError,
  isImporting,
  importProgress,
  importSummary,
  columnMappings,
  showMappingConfig,
  lookupData,
  onFileSelect,
  onImport,
  onUpdateMapping,
  onApplyMappings,
  onShowMappingConfig,
  onReset,
}: CSVUploadModalProps) {
  const [showHelp, setShowHelp] = useState(false)
  const [isCheckingIPs, setIsCheckingIPs] = useState(false)
  const [ipCheckResults, setIpCheckResults] = useState<Array<{device: string, ip: string, assignedTo: string}>>([])
  const [isCheckingConflicts, setIsCheckingConflicts] = useState(false)
  const [ipConflicts, setIpConflicts] = useState<Set<string>>(new Set())
  const { apiCall } = useApi()

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      onFileSelect(file)
    }
  }, [onFileSelect])

  const errorCount = parseResult?.validationErrors.filter(e => e.severity === 'error').length || 0
  const warningCount = parseResult?.validationErrors.filter(e => e.severity === 'warning').length || 0

  // Build list of all available fields for mapping
  const allNautobotFields = [
    ...NAUTOBOT_DEVICE_FIELDS.map(f => ({ ...f, key: f.key, isInterface: false, isCustom: false })),
    ...NAUTOBOT_INTERFACE_FIELDS.map(f => ({ ...f, key: `interface_${f.key}`, isInterface: true, isCustom: false })),
  ]

  // Get display label for a mapping value
  const getMappingLabel = (value: string) => {
    if (value === 'unmapped') return '-- Unmapped --'
    if (value.startsWith('cf_')) {
      return `[Custom] ${value.substring(3)}`
    }
    const field = allNautobotFields.find(f => f.key === value)
    if (field) {
      return field.isInterface ? `[Interface] ${field.label}` : field.label
    }
    return value
  }

  // Helper functions to resolve UUIDs to display names
  const getRoleName = (roleIdOrName: string | undefined) => {
    if (!roleIdOrName) return null
    const role = lookupData.roles.find(r => r.id === roleIdOrName || r.name === roleIdOrName)
    return role?.name || roleIdOrName
  }

  const getLocationName = (locationIdOrName: string | undefined) => {
    if (!locationIdOrName) return null
    const location = lookupData.locations.find(l =>
      l.id === locationIdOrName || l.name === locationIdOrName || l.hierarchicalPath === locationIdOrName
    )
    return location?.hierarchicalPath || location?.name || locationIdOrName
  }

  const getDeviceTypeName = (deviceTypeIdOrName: string | undefined) => {
    if (!deviceTypeIdOrName) return null
    const deviceType = lookupData.deviceTypes.find(dt =>
      dt.id === deviceTypeIdOrName || dt.model === deviceTypeIdOrName || dt.display === deviceTypeIdOrName
    )
    return deviceType?.display || deviceType?.model || deviceTypeIdOrName
  }

  const handleCheckIPs = useCallback(async () => {
    if (!parseResult) return

    setIsCheckingIPs(true)
    setIpCheckResults([])

    const assignedIPs: Array<{device: string, ip: string, assignedTo: string}> = []

    try {
      // Loop through all devices and their interfaces
      for (const device of parseResult.devices) {
        for (const iface of device.interfaces) {
          if (iface.ip_address) {
            // Check if IP is already assigned in Nautobot
            try {
              // Strip netmask from IP address for query (e.g., "192.168.1.1/24" -> "192.168.1.1")
              const ipOnly = iface.ip_address.split('/')[0]
              if (!ipOnly) continue

              const data = await apiCall(
                `nautobot/ipam/ip-addresses/detailed?address=${encodeURIComponent(ipOnly)}&get_address=true&get_name=true&get_primary_ip4_for=true&get_interfaces=false`
              ) as { count: number; ip_addresses: Array<{
                primary_ip4_for?: Array<{ name: string }>
                interfaces?: Array<{ name: string; device: { name: string } }>
              }> }

              if (data.count > 0 && data.ip_addresses && data.ip_addresses.length > 0) {
                const ipData = data.ip_addresses[0]
                if (!ipData) continue

                let assignedDevice: string | null = null

                // Check if IP is assigned as primary to another device
                if (ipData.primary_ip4_for && ipData.primary_ip4_for.length > 0) {
                  assignedDevice = ipData.primary_ip4_for[0]?.name ?? null
                }
                // Also check if IP is assigned to any interface
                else if (ipData.interfaces && ipData.interfaces.length > 0) {
                  assignedDevice = ipData.interfaces[0]?.device?.name ?? null
                }

                // Flag any IP that's already assigned in Nautobot
                if (assignedDevice) {
                  assignedIPs.push({
                    device: device.name,
                    ip: iface.ip_address,
                    assignedTo: assignedDevice
                  })
                }
              }
            } catch (error) {
              // Log but continue checking other IPs
              console.error(`Error checking IP ${iface.ip_address}:`, error)
            }
          }
        }
      }

      setIpCheckResults(assignedIPs)

      // Remove devices with assigned IPs from the parse result
      if (assignedIPs.length > 0 && parseResult) {
        const devicesToRemove = new Set(assignedIPs.map(r => r.device))
        const filteredDevices = parseResult.devices.filter(d => !devicesToRemove.has(d.name))

        // Update parseResult with filtered devices
        parseResult.devices = filteredDevices
      }

    } catch (error) {
      console.error('Error checking IPs:', error)
    } finally {
      setIsCheckingIPs(false)
    }
  }, [parseResult, apiCall])

  const handleCheckConflicts = useCallback(async () => {
    if (!parseResult) return

    setIsCheckingConflicts(true)
    setIpConflicts(new Set())

    const conflicts = new Set<string>()

    try {
      // Loop through all devices and their interfaces
      for (const device of parseResult.devices) {
        for (const iface of device.interfaces) {
          if (iface.ip_address) {
            // Check if IP is already assigned in Nautobot
            try {
              // Strip netmask from IP address for query
              const ipOnly = iface.ip_address.split('/')[0]
              if (!ipOnly) continue

              const data = await apiCall(
                `nautobot/ipam/ip-addresses/detailed?address=${encodeURIComponent(ipOnly)}&get_address=true&get_name=true&get_primary_ip4_for=true&get_interfaces=false`
              ) as { count: number; ip_addresses: Array<{
                primary_ip4_for?: Array<{ name: string }>
                interfaces?: Array<{ name: string; device: { name: string } }>
              }> }

              if (data.count > 0 && data.ip_addresses && data.ip_addresses.length > 0) {
                const ipData = data.ip_addresses[0]
                if (!ipData) continue

                let assignedDevice: string | null = null

                // Check if IP is assigned as primary to another device
                if (ipData.primary_ip4_for && ipData.primary_ip4_for.length > 0) {
                  assignedDevice = ipData.primary_ip4_for[0]?.name ?? null
                }
                // Also check if IP is assigned to any interface
                else if (ipData.interfaces && ipData.interfaces.length > 0) {
                  assignedDevice = ipData.interfaces[0]?.device?.name ?? null
                }

                // Only flag if it's assigned to a DIFFERENT device (conflict)
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
    <Dialog open={showModal} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[900px] sm:!max-w-[900px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              Import Devices from CSV
            </DialogTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowHelp(true)}
              className="h-8 w-8 p-0"
            >
              <HelpCircle className="h-4 w-4" />
            </Button>
          </div>
          <DialogDescription>
            Upload a CSV file to bulk import devices. The first row should contain column headers.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* File Upload Section */}
          {!importSummary && (
            <div className="space-y-3">
              <Label htmlFor="csv-file" className="text-sm font-medium">
                Select CSV File
              </Label>
              <div className="flex items-center gap-3">
                <Input
                  id="csv-file"
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  disabled={isParsing || isImporting}
                  className="flex-1"
                />
                {csvFile && (
                  <span className="text-sm text-muted-foreground">
                    {(csvFile.size / 1024).toFixed(1)} KB
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Parsing Status */}
          {isParsing && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Parsing CSV file...</span>
            </div>
          )}

          {/* Parse Error */}
          {parseError && (
            <Alert className="border-red-200 bg-red-50">
              <XCircle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800">{parseError}</AlertDescription>
            </Alert>
          )}

          {/* Column Mapping Configuration */}
          {showMappingConfig && parseResult && (
            <div className="space-y-3 border rounded-lg p-4 bg-muted/20">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-sm">Column Mapping</h4>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onApplyMappings}
                >
                  Apply & Re-parse
                </Button>
              </div>
              <div className="max-h-60 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-2 font-medium">CSV Column</th>
                      <th className="text-left py-2 px-2 font-medium">Nautobot Property</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parseResult.headers.map(header => (
                      <tr key={header} className="border-b last:border-b-0">
                        <td className="py-2 px-2">
                          <span className="font-mono bg-muted px-2 py-1 rounded">
                            {header}
                          </span>
                        </td>
                        <td className="py-2 px-2">
                          <Select
                            value={columnMappings[header] || 'unmapped'}
                            onValueChange={(value) => onUpdateMapping(header, value)}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue>
                                {getMappingLabel(columnMappings[header] || 'unmapped')}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="unmapped">-- Unmapped --</SelectItem>
                              {/* Show custom field option if header starts with cf_ */}
                              {header.startsWith('cf_') && (
                                <SelectItem value={header}>
                                  {`[Custom] ${header.substring(3)}`}
                                </SelectItem>
                              )}
                              {allNautobotFields.map(field => (
                                <SelectItem key={field.key} value={field.key}>
                                  {field.isInterface ? `[Interface] ${field.label}` : field.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Parse Results */}
          {parseResult && !showMappingConfig && !importSummary && (
            <div className="space-y-3">
              {/* Summary Stats */}
              <div className="flex items-center gap-4 text-sm">
                <span className="font-medium">
                  {parseResult.devices.length} device(s) found
                </span>
                <span className="text-muted-foreground">
                  from {parseResult.rowCount} row(s)
                </span>
                {errorCount > 0 && (
                  <Badge variant="destructive">{errorCount} error(s)</Badge>
                )}
                {warningCount > 0 && (
                  <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                    {warningCount} warning(s)
                  </Badge>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCheckIPs}
                  disabled={isCheckingIPs || isCheckingConflicts || !parseResult}
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
                  disabled={isCheckingIPs || isCheckingConflicts || !parseResult}
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
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onShowMappingConfig(true)}
                >
                  <Settings2 className="h-4 w-4 mr-1" />
                  Configure Mapping
                </Button>
              </div>

              {/* IP Check Results (devices removed) */}
              {ipCheckResults.length > 0 && (
                <Alert className="border-yellow-200 bg-yellow-50">
                  <AlertCircle className="h-4 w-4 text-yellow-600" />
                  <AlertDescription className="text-yellow-800">
                    <div className="space-y-2">
                      <p className="font-semibold">
                        {ipCheckResults.length} device(s) removed due to IP conflicts:
                      </p>
                      <ul className="text-xs space-y-1">
                        {ipCheckResults.map((result) => (
                          <li key={`${result.device}-${result.ip}`}>
                            <strong>{result.device}</strong> - IP {result.ip} is already assigned to <strong>{result.assignedTo}</strong>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              {/* IP Conflicts (devices marked) */}
              {ipConflicts.size > 0 && (
                <Alert className="border-red-200 bg-red-50">
                  <AlertCircle className="h-4 w-4 text-red-600" />
                  <AlertDescription className="text-red-800">
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
                      <li key={`${error.deviceName}-${error.field}-${error.message}`} className="flex items-start gap-2">
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
                          <TableCell>{getRoleName(device.role) || <span className="text-muted-foreground">default</span>}</TableCell>
                          <TableCell>{getLocationName(device.location) || <span className="text-muted-foreground">default</span>}</TableCell>
                          <TableCell>{getDeviceTypeName(device.device_type) || <span className="text-red-500">missing</span>}</TableCell>
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
          )}

          {/* Import Progress */}
          {isImporting && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>
                  Importing devices... ({importProgress.current}/{importProgress.total})
                </span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div
                  className="bg-primary h-2 rounded-full transition-all"
                  style={{ width: `${(importProgress.current / importProgress.total) * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* Import Results */}
          {importSummary && (
            <div className="space-y-3">
              {/* Summary */}
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                  <span className="font-medium">{importSummary.success} succeeded</span>
                </div>
                {importSummary.failed > 0 && (
                  <div className="flex items-center gap-2">
                    <XCircle className="h-5 w-5 text-red-500" />
                    <span className="font-medium">{importSummary.failed} failed</span>
                  </div>
                )}
                {importSummary.skipped > 0 && (
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-5 w-5 text-yellow-500" />
                    <span className="font-medium">{importSummary.skipped} skipped</span>
                  </div>
                )}
              </div>

              {/* Results Table */}
              <div className="border rounded-lg overflow-hidden max-h-60 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Device Name</TableHead>
                      <TableHead className="w-[100px]">Status</TableHead>
                      <TableHead>Message</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {importSummary.results.map((result) => (
                      <TableRow key={result.deviceName}>
                        <TableCell className="font-medium">{result.deviceName}</TableCell>
                        <TableCell>
                          {result.status === 'success' && (
                            <Badge className="bg-green-100 text-green-800">Success</Badge>
                          )}
                          {result.status === 'error' && (
                            <Badge variant="destructive">Failed</Badge>
                          )}
                          {result.status === 'skipped' && (
                            <Badge variant="secondary">Skipped</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">{result.message}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          {importSummary ? (
            <>
              <Button variant="outline" onClick={onReset}>
                Import Another File
              </Button>
              <Button onClick={onClose}>
                Close
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={onClose} disabled={isImporting}>
                Cancel
              </Button>
              <Button
                onClick={onImport}
                disabled={!parseResult || errorCount > 0 || isParsing || isImporting}
              >
                {isImporting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Import {parseResult?.devices.length || 0} Device(s)
                  </>
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>

      {/* Help Dialog */}
      <Dialog open={showHelp} onOpenChange={setShowHelp}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <HelpCircle className="h-5 w-5" />
              CSV File Format Guide
            </DialogTitle>
            <DialogDescription>
              Learn how to format your CSV file for device import
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4 text-sm">
            <div>
              <h4 className="font-semibold mb-2">File Format</h4>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>First row must contain column headers</li>
                <li>Default delimiter: semicolon (;) - configurable in settings</li>
                <li>Multiple rows with the same device name will be merged</li>
                <li>One row per interface for devices with multiple interfaces</li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-2">Required Columns</h4>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li><code className="bg-muted px-1 py-0.5 rounded">name</code> (or device_name, hostname) - Device identifier</li>
                <li><code className="bg-muted px-1 py-0.5 rounded">device_type</code> (or model) - Device type/model</li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-2">Optional Device Columns</h4>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground text-xs">
                <li><code className="bg-muted px-1 py-0.5 rounded">role</code> - Device role</li>
                <li><code className="bg-muted px-1 py-0.5 rounded">location</code> (or site) - Location/site</li>
                <li><code className="bg-muted px-1 py-0.5 rounded">platform</code> (or os) - Platform/OS</li>
                <li><code className="bg-muted px-1 py-0.5 rounded">status</code> - Device status</li>
                <li><code className="bg-muted px-1 py-0.5 rounded">serial</code> - Serial number</li>
                <li><code className="bg-muted px-1 py-0.5 rounded">asset_tag</code> - Asset tag</li>
                <li><code className="bg-muted px-1 py-0.5 rounded">software_version</code> - Software version</li>
                <li><code className="bg-muted px-1 py-0.5 rounded">tags</code> - Comma-separated tags</li>
                <li><code className="bg-muted px-1 py-0.5 rounded">cf_*</code> - Custom fields (e.g., cf_net)</li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-2">Interface Columns (prefix with interface_)</h4>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground text-xs">
                <li><code className="bg-muted px-1 py-0.5 rounded">interface_name</code> - Interface name (required)</li>
                <li><code className="bg-muted px-1 py-0.5 rounded">interface_type</code> - Interface type (required)</li>
                <li><code className="bg-muted px-1 py-0.5 rounded">interface_ip_address</code> - IP with CIDR (e.g., 192.168.1.1/24)</li>
                <li><code className="bg-muted px-1 py-0.5 rounded">interface_description</code> - Interface description</li>
                <li><code className="bg-muted px-1 py-0.5 rounded">set_primary_ipv4</code> - Set as primary IP (true/false)</li>
                <li><code className="bg-muted px-1 py-0.5 rounded">interface_status</code> - Interface status</li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-2">Example CSV</h4>
              <div className="bg-muted p-3 rounded-md overflow-x-auto">
                <pre className="text-xs font-mono whitespace-pre">
{`name;device_type;serial;cf_net;tags;interface_name;interface_ip_address;interface_type;interface_description;set_primary_ipv4
test-1;virtual;12345;testnet;tag-1;eth0;192.168.100.1/24;1000BASE-T (1GE);testdescription-1;false
test-1;virtual;12345;testnet;tag-1;eth1;192.168.100.2/24;1000BASE-T (1GE);testdescription-2;true`}
                </pre>
              </div>
              <p className="text-muted-foreground text-xs mt-2">
                Note: This example shows a device &quot;test-1&quot; with two interfaces. Both rows have the same device_type, serial, etc., but different interface details.
              </p>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="flex gap-2">
                <AlertCircle className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-blue-800">
                  <p className="font-semibold mb-1">Tips:</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Device fields must be identical across all rows for the same device</li>
                    <li>If only one interface, set_primary_ipv4 will auto-set to true</li>
                    <li>Configure column mapping if your headers don&apos;t match the standard names</li>
                    <li>Use the mapping configuration to handle custom column names</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button onClick={() => setShowHelp(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  )
}
