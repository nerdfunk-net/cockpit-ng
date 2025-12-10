import { useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Key, Network, FileText, Info, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

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

interface SettingsTabProps {
  checkSshLogins: boolean
  setCheckSshLogins: (value: boolean) => void
  checkSnmpCredentials: boolean
  setCheckSnmpCredentials: (value: boolean) => void
  checkConfiguration: boolean
  setCheckConfiguration: (value: boolean) => void
  selectedLoginIds: number[]
  setSelectedLoginIds: (ids: number[]) => void
  selectedSnmpIds: number[]
  setSelectedSnmpIds: (ids: number[]) => void
  selectedRegexIds: number[]
  setSelectedRegexIds: (ids: number[]) => void
  loginCredentials: LoginCredential[]
  snmpMappings: SNMPMapping[]
  regexPatterns: RegexPattern[]
  isLoading: boolean
  loadSettings: () => Promise<void>
}

export function SettingsTab({
  checkSshLogins,
  setCheckSshLogins,
  checkSnmpCredentials,
  setCheckSnmpCredentials,
  checkConfiguration,
  setCheckConfiguration,
  selectedLoginIds,
  setSelectedLoginIds,
  selectedSnmpIds,
  setSelectedSnmpIds,
  selectedRegexIds,
  setSelectedRegexIds,
  loginCredentials,
  snmpMappings,
  regexPatterns,
  isLoading,
  loadSettings,
}: SettingsTabProps) {
  useEffect(() => {
    void loadSettings()
  }, [loadSettings])

  const handleLoginToggle = (id: number, checked: boolean) => {
    if (checked) {
      setSelectedLoginIds([...selectedLoginIds, id])
    } else {
      setSelectedLoginIds(selectedLoginIds.filter(loginId => loginId !== id))
    }
  }

  const handleSnmpToggle = (id: number, checked: boolean) => {
    if (checked) {
      setSelectedSnmpIds([...selectedSnmpIds, id])
    } else {
      setSelectedSnmpIds(selectedSnmpIds.filter(snmpId => snmpId !== id))
    }
  }

  const handleRegexToggle = (id: number, checked: boolean) => {
    if (checked) {
      setSelectedRegexIds([...selectedRegexIds, id])
    } else {
      setSelectedRegexIds(selectedRegexIds.filter(regexId => regexId !== id))
    }
  }

  const handleSelectAllLogins = () => {
    setSelectedLoginIds(loginCredentials.filter(c => c.is_active).map(c => c.id))
  }

  const handleDeselectAllLogins = () => {
    setSelectedLoginIds([])
  }

  const handleSelectAllSnmp = () => {
    setSelectedSnmpIds(snmpMappings.filter(m => m.is_active).map(m => m.id))
  }

  const handleDeselectAllSnmp = () => {
    setSelectedSnmpIds([])
  }

  const handleSelectAllRegex = () => {
    setSelectedRegexIds(regexPatterns.filter(p => p.is_active).map(p => p.id))
  }

  const handleDeselectAllRegex = () => {
    setSelectedRegexIds([])
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Compliance Check Settings</CardTitle>
          <CardDescription>
            Configure which compliance checks to perform and select credentials
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Check Type Toggles */}
      <Card>
        <CardHeader>
          <CardTitle>Check Types</CardTitle>
          <CardDescription>
            Enable or disable specific compliance check categories
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="check-ssh"
              checked={checkSshLogins}
              onCheckedChange={setCheckSshLogins}
            />
            <Label htmlFor="check-ssh" className="flex items-center gap-2 cursor-pointer">
              <Key className="h-4 w-4" />
              Check SSH Logins
            </Label>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="check-snmp"
              checked={checkSnmpCredentials}
              onCheckedChange={setCheckSnmpCredentials}
            />
            <Label htmlFor="check-snmp" className="flex items-center gap-2 cursor-pointer">
              <Network className="h-4 w-4" />
              Check SNMP Credentials
            </Label>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="check-config"
              checked={checkConfiguration}
              onCheckedChange={setCheckConfiguration}
            />
            <Label htmlFor="check-config" className="flex items-center gap-2 cursor-pointer">
              <FileText className="h-4 w-4" />
              Check Configuration
            </Label>
          </div>
        </CardContent>
      </Card>

      {/* SSH Logins Selection */}
      {checkSshLogins && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Key className="h-5 w-5" />
                  SSH Login Credentials
                </CardTitle>
                <CardDescription>
                  Select which login credentials to test during compliance checks
                </CardDescription>
              </div>
              <Link href="/settings/compliance">
                <Button variant="outline" size="sm">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Manage
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : loginCredentials.length === 0 ? (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  No login credentials configured. Go to Settings / Compliance to add credentials.
                </AlertDescription>
              </Alert>
            ) : (
              <div className="space-y-4">
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSelectAllLogins}
                  >
                    Select All
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDeselectAllLogins}
                  >
                    Deselect All
                  </Button>
                  <div className="ml-auto text-sm text-gray-500">
                    {selectedLoginIds.length} of {loginCredentials.filter(c => c.is_active).length} selected
                  </div>
                </div>
                <div className="space-y-2">
                  {loginCredentials
                    .filter(c => c.is_active)
                    .map(credential => (
                      <div key={credential.id} className="flex items-center space-x-2 p-2 rounded hover:bg-gray-50">
                        <Checkbox
                          id={`login-${credential.id}`}
                          checked={selectedLoginIds.includes(credential.id)}
                          onCheckedChange={(checked) => handleLoginToggle(credential.id, checked as boolean)}
                        />
                        <Label
                          htmlFor={`login-${credential.id}`}
                          className="flex-1 cursor-pointer"
                        >
                          <div className="font-medium">{credential.username}</div>
                          {credential.description && (
                            <div className="text-sm text-gray-500">{credential.description}</div>
                          )}
                        </Label>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* SNMP Credentials Selection */}
      {checkSnmpCredentials && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Network className="h-5 w-5" />
                  SNMP Credentials
                </CardTitle>
                <CardDescription>
                  Select which SNMP mappings to test during compliance checks
                </CardDescription>
              </div>
              <Link href="/settings/compliance">
                <Button variant="outline" size="sm">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Manage
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : snmpMappings.length === 0 ? (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  No SNMP mappings configured. Go to Settings / Compliance to add SNMP credentials.
                </AlertDescription>
              </Alert>
            ) : (
              <div className="space-y-4">
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSelectAllSnmp}
                  >
                    Select All
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDeselectAllSnmp}
                  >
                    Deselect All
                  </Button>
                  <div className="ml-auto text-sm text-gray-500">
                    {selectedSnmpIds.length} of {snmpMappings.filter(m => m.is_active).length} selected
                  </div>
                </div>
                <div className="space-y-2">
                  {snmpMappings
                    .filter(m => m.is_active)
                    .map(mapping => (
                      <div key={mapping.id} className="flex items-center space-x-2 p-2 rounded hover:bg-gray-50">
                        <Checkbox
                          id={`snmp-${mapping.id}`}
                          checked={selectedSnmpIds.includes(mapping.id)}
                          onCheckedChange={(checked) => handleSnmpToggle(mapping.id, checked as boolean)}
                        />
                        <Label
                          htmlFor={`snmp-${mapping.id}`}
                          className="flex-1 cursor-pointer"
                        >
                          <div className="font-medium">{mapping.device_type}</div>
                          <div className="text-sm text-gray-500">
                            {mapping.snmp_version} - {mapping.snmp_version === 'v3' ? mapping.snmp_v3_user : mapping.snmp_community}
                            {mapping.description && ` - ${mapping.description}`}
                          </div>
                        </Label>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Configuration Patterns Selection */}
      {checkConfiguration && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Configuration Patterns
                </CardTitle>
                <CardDescription>
                  Select which regex patterns to check against device configurations
                </CardDescription>
              </div>
              <Link href="/settings/compliance">
                <Button variant="outline" size="sm">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Manage
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : regexPatterns.length === 0 ? (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  No regex patterns configured. Go to Settings / Compliance to add patterns.
                </AlertDescription>
              </Alert>
            ) : (
              <div className="space-y-4">
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSelectAllRegex}
                  >
                    Select All
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDeselectAllRegex}
                  >
                    Deselect All
                  </Button>
                  <div className="ml-auto text-sm text-gray-500">
                    {selectedRegexIds.length} of {regexPatterns.filter(p => p.is_active).length} selected
                  </div>
                </div>
                <div className="space-y-2">
                  {regexPatterns
                    .filter(p => p.is_active)
                    .map(pattern => (
                      <div key={pattern.id} className="flex items-center space-x-2 p-2 rounded hover:bg-gray-50">
                        <Checkbox
                          id={`regex-${pattern.id}`}
                          checked={selectedRegexIds.includes(pattern.id)}
                          onCheckedChange={(checked) => handleRegexToggle(pattern.id, checked as boolean)}
                        />
                        <Label
                          htmlFor={`regex-${pattern.id}`}
                          className="flex-1 cursor-pointer"
                        >
                          <div className="font-medium font-mono text-sm">{pattern.pattern}</div>
                          <div className="text-sm text-gray-500">
                            {pattern.pattern_type === 'must_match' ? '✓ Must Match' : '✗ Must Not Match'}
                            {pattern.description && ` - ${pattern.description}`}
                          </div>
                        </Label>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {!checkSshLogins && !checkSnmpCredentials && !checkConfiguration && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            Please enable at least one check type above to configure compliance checks.
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}
