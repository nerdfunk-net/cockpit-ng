import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  Key,
  Network,
  FileText,
  PlayCircle,
  Loader2,
} from 'lucide-react'
import type { DeviceInfo } from '@/components/shared/device-selector'
import { useApi } from '@/hooks/use-api'
import { useToast } from '@/hooks/use-toast'

interface RegexPattern {
  id: number
  pattern: string
  description?: string
  pattern_type: 'must_match' | 'must_not_match'
  is_active: boolean
}

interface LoginCredential {
  id: number
  username: string
  description?: string
  is_active: boolean
}

interface SNMPMapping {
  id: number
  device_type: string
  snmp_version: 'v1' | 'v2c' | 'v3'
  snmp_community?: string
  snmp_v3_user?: string
  description?: string
  is_active: boolean
}

interface SSHCheckResult {
  username: string
  success: boolean
  message: string
  details: {
    username: string
    credential_name?: string
  }
}

interface SNMPCheckResult {
  version: string
  success: boolean
  message: string
  details: {
    version: string
    mapping_name?: string
  }
}

interface PatternCheckResult {
  pattern: string
  pattern_type: string
  success: boolean
  message: string
  details: {
    pattern: string
  }
}

interface ConfigurationCheck {
  total: number
  passed: number
  failed: number
  result: {
    note?: string
    passed: number
    total_patterns: number
    pattern_results: PatternCheckResult[]
  }
}

interface DeviceCheckResult {
  device_id: string
  device_name: string
  device_ip?: string
  message?: string
  status: 'pass' | 'fail' | 'skip'
  checks: {
    ssh_logins: {
      total: number
      passed: number
      failed: number
      results: SSHCheckResult[]
    }
    snmp_credentials: {
      total: number
      passed: number
      failed: number
      results: SNMPCheckResult[]
    }
    configuration: ConfigurationCheck
  }
}

interface ComplianceCheckResponse {
  success: boolean
  message?: string
  summary: {
    devices_passed: number
    devices_failed: number
    devices_skipped: number
  }
  results: DeviceCheckResult[]
}

interface CheckTabProps {
  selectedDevices: DeviceInfo[]
  checkSshLogins: boolean
  checkSnmpCredentials: boolean
  checkConfiguration: boolean
  selectedLoginIds: number[]
  selectedSnmpIds: number[]
  selectedRegexIds: number[]
  loginCredentials: LoginCredential[]
  snmpMappings: SNMPMapping[]
  regexPatterns: RegexPattern[]
}

export function CheckTab({
  selectedDevices,
  checkSshLogins,
  checkSnmpCredentials,
  checkConfiguration,
  selectedLoginIds,
  selectedSnmpIds,
  selectedRegexIds,
  loginCredentials,
  snmpMappings,
  regexPatterns,
}: CheckTabProps) {
  const [isChecking, setIsChecking] = useState(false)
  const [checkResults, setCheckResults] = useState<ComplianceCheckResponse | null>(null)
  const { apiCall } = useApi()
  const { toast } = useToast()

  const selectedLogins = loginCredentials.filter(c => selectedLoginIds.includes(c.id))
  const selectedSnmp = snmpMappings.filter(m => selectedSnmpIds.includes(m.id))
  const selectedRegex = regexPatterns.filter(p => selectedRegexIds.includes(p.id))

  const hasDevices = selectedDevices.length > 0
  const hasChecks = checkSshLogins || checkSnmpCredentials || checkConfiguration
  const hasCredentials =
    (checkSshLogins ? selectedLoginIds.length > 0 : true) &&
    (checkSnmpCredentials ? selectedSnmpIds.length > 0 : true) &&
    (checkConfiguration ? selectedRegexIds.length > 0 : true)

  const canRunCheck = hasDevices && hasChecks && hasCredentials

  const handleCheckCompliance = async () => {
    if (!canRunCheck) return

    setIsChecking(true)
    setCheckResults(null)

    try {
      // Prepare device data for API call
      const devices = selectedDevices.map(d => ({
        id: d.id,
        name: d.name,
        primary_ip4: typeof d.primary_ip4 === 'object' && d.primary_ip4?.address
          ? d.primary_ip4.address.split('/')[0]
          : (d.primary_ip4 as string) || '',
        device_type: typeof d.device_type === 'object' && d.device_type?.name
          ? d.device_type.name
          : (d.device_type as string) || '',
        platform: typeof d.platform === 'object' && d.platform?.name
          ? d.platform.name
          : (d.platform as string) || '',
      }))

      // Call backend API
      const response = await apiCall('compliance/check', {
        method: 'POST',
        body: JSON.stringify({
          devices,
          check_ssh_logins: checkSshLogins,
          check_snmp_credentials: checkSnmpCredentials,
          check_configuration: checkConfiguration,
          selected_login_ids: selectedLoginIds,
          selected_snmp_ids: selectedSnmpIds,
          selected_regex_ids: selectedRegexIds,
        }),
      }) as ComplianceCheckResponse

      if (response.success) {
        setCheckResults(response)
        toast({
          title: 'Compliance Check Complete',
          description: `${response.summary.devices_passed} passed, ${response.summary.devices_failed} failed`,
        })
      } else {
        toast({
          title: 'Compliance Check Failed',
          description: response.message || 'An error occurred',
          variant: 'destructive',
        })
      }
    } catch (error) {
      console.error('Compliance check error:', error)
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to check compliance',
        variant: 'destructive',
      })
    } finally {
      setIsChecking(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Compliance Check Summary</CardTitle>
          <CardDescription>
            Review your compliance check configuration and execute the check
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Validation Warnings */}
      {!hasDevices && (
        <Alert className="border-red-500 bg-red-50 text-red-900">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            No devices selected. Please go to the <strong>Devices</strong> tab to select devices.
          </AlertDescription>
        </Alert>
      )}

      {!hasChecks && (
        <Alert className="border-red-500 bg-red-50 text-red-900">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            No check types enabled. Please go to the <strong>Settings</strong> tab to enable at least one check type.
          </AlertDescription>
        </Alert>
      )}

      {hasChecks && !hasCredentials && (
        <Alert className="border-red-500 bg-red-50 text-red-900">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            No credentials selected for enabled checks. Please go to the <strong>Settings</strong> tab to select credentials.
          </AlertDescription>
        </Alert>
      )}

      {/* Compliance Check Summary Table */}
      {hasDevices && (
        <Card>
          <CardHeader>
            <CardTitle>Compliance Check Summary</CardTitle>
            <CardDescription>
              Overview of checks that will be performed on each device
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-semibold">Device</th>
                    <th className="text-center py-3 px-4 font-semibold">
                      <div className="flex items-center justify-center gap-2">
                        <Key className="h-4 w-4" />
                        SSH
                      </div>
                    </th>
                    <th className="text-center py-3 px-4 font-semibold">
                      <div className="flex items-center justify-center gap-2">
                        <Network className="h-4 w-4" />
                        SNMP
                      </div>
                    </th>
                    <th className="text-center py-3 px-4 font-semibold">
                      <div className="flex items-center justify-center gap-2">
                        <FileText className="h-4 w-4" />
                        Config
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {selectedDevices.map(device => (
                    <tr key={device.id} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <div className="font-medium">{device.name}</div>
                        <div className="text-sm text-gray-500">
                          {typeof device.primary_ip4 === 'object' && device.primary_ip4?.address
                            ? device.primary_ip4.address.split('/')[0]
                            : (device.primary_ip4 as string) || 'No IP'}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        {checkSshLogins && selectedLogins.length > 0 ? (
                          <div className="flex items-center justify-center gap-1">
                            <CheckCircle2 className="h-5 w-5 text-green-600" />
                            <span className="text-sm text-gray-600">({selectedLogins.length})</span>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center">
                            <span className="text-red-600 text-xl">✗</span>
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {checkSnmpCredentials && selectedSnmp.length > 0 ? (
                          <div className="flex items-center justify-center gap-1">
                            <CheckCircle2 className="h-5 w-5 text-green-600" />
                            <span className="text-sm text-gray-600">({selectedSnmp.length})</span>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center">
                            <span className="text-red-600 text-xl">✗</span>
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {checkConfiguration && selectedRegex.length > 0 ? (
                          <div className="flex items-center justify-center gap-1">
                            <CheckCircle2 className="h-5 w-5 text-green-600" />
                            <span className="text-sm text-gray-600">({selectedRegex.length})</span>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center">
                            <span className="text-red-600 text-xl">✗</span>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 text-sm text-gray-600">
              Total: {selectedDevices.length} device{selectedDevices.length !== 1 ? 's' : ''} will be checked
              {checkSshLogins && selectedLogins.length > 0 && ` • ${selectedLogins.length} SSH credential${selectedLogins.length !== 1 ? 's' : ''}`}
              {checkSnmpCredentials && selectedSnmp.length > 0 && ` • ${selectedSnmp.length} SNMP mapping${selectedSnmp.length !== 1 ? 's' : ''}`}
              {checkConfiguration && selectedRegex.length > 0 && ` • ${selectedRegex.length} regex pattern${selectedRegex.length !== 1 ? 's' : ''}`}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Action Button */}
      <Card>
        <CardContent className="pt-6">
          {canRunCheck ? (
            <div className="space-y-4">
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  Ready to check compliance for <strong>{selectedDevices.length}</strong> device
                  {selectedDevices.length !== 1 ? 's' : ''}.
                  This will verify SSH logins{checkSshLogins ? ` (${selectedLogins.length})` : ''},
                  SNMP credentials{checkSnmpCredentials ? ` (${selectedSnmp.length})` : ''},
                  and configuration patterns{checkConfiguration ? ` (${selectedRegex.length})` : ''}.
                </AlertDescription>
              </Alert>
              <Button
                size="lg"
                onClick={handleCheckCompliance}
                disabled={isChecking}
                className="w-full"
              >
                {isChecking ? (
                  <>
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    Checking Compliance...
                  </>
                ) : (
                  <>
                    <PlayCircle className="h-5 w-5 mr-2" />
                    Check Compliance
                  </>
                )}
              </Button>
            </div>
          ) : (
            <Alert className="border-red-500 bg-red-50 text-red-900">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Please configure all required settings before running compliance check.
                Go to the <strong>Devices</strong> and <strong>Settings</strong> tabs.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Results Display */}
      {checkResults && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {checkResults.summary.devices_failed === 0 ? (
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-red-600" />
              )}
              Compliance Check Results
            </CardTitle>
            <CardDescription>
              {checkResults.summary.devices_passed} passed, {checkResults.summary.devices_failed} failed, {checkResults.summary.devices_skipped} skipped
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {checkResults.results.map((result: DeviceCheckResult) => (
                <Card key={result.device_id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {result.status === 'pass' ? (
                          <CheckCircle2 className="h-5 w-5 text-green-600" />
                        ) : result.status === 'fail' ? (
                          <AlertTriangle className="h-5 w-5 text-red-600" />
                        ) : (
                          <Info className="h-5 w-5 text-gray-400" />
                        )}
                        <div>
                          <CardTitle className="text-lg">{result.device_name}</CardTitle>
                          <CardDescription>{result.device_ip || 'No IP'}</CardDescription>
                        </div>
                      </div>
                      <Badge variant={result.status === 'pass' ? 'default' : result.status === 'fail' ? 'destructive' : 'secondary'}>
                        {result.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {result.message && (
                      <div className="mb-4 text-sm text-gray-600">{result.message}</div>
                    )}

                    {result.checks.ssh_logins && (
                      <div className="mb-4">
                        <h4 className="font-semibold mb-2 flex items-center gap-2">
                          <Key className="h-4 w-4" />
                          SSH Login Checks ({result.checks.ssh_logins.passed}/{result.checks.ssh_logins.total})
                        </h4>
                        <div className="space-y-2 pl-6">
                          {result.checks.ssh_logins.results.map((ssh: SSHCheckResult) => (
                            <div key={`ssh-${result.device_id}-${ssh.username}`} className="flex items-start gap-2 text-sm">
                              {ssh.success ? (
                                <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5" />
                              ) : (
                                <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5" />
                              )}
                              <div>
                                <div className="font-medium">
                                  {ssh.details.credential_name || ssh.details.username}
                                  {ssh.details.credential_name && ssh.details.credential_name !== ssh.details.username && (
                                    <span className="text-gray-500 font-normal ml-2">({ssh.details.username})</span>
                                  )}
                                </div>
                                <div className="text-gray-600">{ssh.message}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {result.checks.snmp_credentials && (
                      <div className="mb-4">
                        <h4 className="font-semibold mb-2 flex items-center gap-2">
                          <Network className="h-4 w-4" />
                          SNMP Credential Checks ({result.checks.snmp_credentials.passed}/{result.checks.snmp_credentials.total})
                        </h4>
                        <div className="space-y-2 pl-6">
                          {result.checks.snmp_credentials.results.map((snmp: SNMPCheckResult) => (
                            <div key={`snmp-${result.device_id}-${snmp.version}`} className="flex items-start gap-2 text-sm">
                              {snmp.success ? (
                                <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5" />
                              ) : (
                                <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5" />
                              )}
                              <div>
                                <div className="font-medium">
                                  {snmp.details.mapping_name || snmp.details.version}
                                  <span className="text-gray-500 font-normal ml-2">({snmp.details.version})</span>
                                </div>
                                <div className="text-gray-600">{snmp.message}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {result.checks.configuration && (
                      <div>
                        <h4 className="font-semibold mb-2 flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          Configuration Checks ({result.checks.configuration.result.passed}/{result.checks.configuration.result.total_patterns})
                        </h4>
                        {result.checks.configuration.result.note && (
                          <div className="mb-2 text-sm text-amber-600 pl-6">
                            {result.checks.configuration.result.note}
                          </div>
                        )}
                        <div className="space-y-2 pl-6">
                          {result.checks.configuration.result.pattern_results.map((pattern: PatternCheckResult) => (
                            <div key={`pattern-${result.device_id}-${pattern.pattern}`} className="flex items-start gap-2 text-sm">
                              {pattern.success ? (
                                <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5" />
                              ) : (
                                <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5" />
                              )}
                              <div>
                                <div className="font-mono text-xs">{pattern.details.pattern}</div>
                                <div className="text-gray-600">{pattern.message}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
