'use client'

import { useState, useEffect } from 'react'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Terminal, Play, AlertCircle, CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import { DeviceSelector, type DeviceInfo, type LogicalCondition } from '@/components/shared/device-selector'
import { useApi } from '@/hooks/use-api'

interface StoredCredential {
  id: number
  name: string
  username: string
  type: string
  valid_until?: string
}

interface CommandResult {
  device: string
  success: boolean
  output: string
  error?: string
}

export default function NetmikoPage() {
  const { apiCall } = useApi()

  // Device selection state
  const [previewDevices, setPreviewDevices] = useState<DeviceInfo[]>([])
  const [deviceConditions, setDeviceConditions] = useState<LogicalCondition[]>([])
  const [selectedDeviceIds, setSelectedDeviceIds] = useState<string[]>([])
  const [selectedDevices, setSelectedDevices] = useState<DeviceInfo[]>([])

  // Credentials state
  const [storedCredentials, setStoredCredentials] = useState<StoredCredential[]>([])
  const [selectedCredentialId, setSelectedCredentialId] = useState<string>('manual')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  // Commands state
  const [commands, setCommands] = useState('')
  const [enableMode, setEnableMode] = useState(false)
  const [writeConfig, setWriteConfig] = useState(false)

  // Execution state
  const [isExecuting, setIsExecuting] = useState(false)
  const [isCancelling, setIsCancelling] = useState(false)
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
  const [executionResults, setExecutionResults] = useState<CommandResult[]>([])
  const [showResults, setShowResults] = useState(false)
  const [expandedDevices, setExpandedDevices] = useState<Set<string>>(new Set())
  const [executionSummary, setExecutionSummary] = useState<{
    total: number
    successful: number
    failed: number
    cancelled: number
  } | null>(null)

  const handleDevicesSelected = (devices: DeviceInfo[], conditions: LogicalCondition[]) => {
    setPreviewDevices(devices)
    setDeviceConditions(conditions)
    // Auto-select all devices when preview is generated
    const deviceIds = devices.map(d => d.id)
    setSelectedDeviceIds(deviceIds)
    setSelectedDevices(devices)
    setShowResults(false)
    setExecutionResults([])
    setExecutionSummary(null)
  }

  const handleSelectionChange = (selectedIds: string[], devices: DeviceInfo[]) => {
    setSelectedDeviceIds(selectedIds)
    setSelectedDevices(devices)
  }

  // Load stored SSH credentials on mount
  useEffect(() => {
    loadStoredCredentials()
  }, [])

  const loadStoredCredentials = async () => {
    try {
      const response = await apiCall<StoredCredential[]>('credentials?include_expired=false')
      // Filter for SSH credentials only
      const sshCredentials = response.filter(cred => cred.type === 'ssh')
      setStoredCredentials(sshCredentials)
    } catch (error) {
      console.error('Error loading credentials:', error)
      setStoredCredentials([])
    }
  }

  const handleCredentialChange = async (credId: string) => {
    setSelectedCredentialId(credId)

    if (credId === 'manual') {
      // Manual entry - clear fields
      setUsername('')
      setPassword('')
    } else {
      // Find the selected credential and fetch the password
      const credential = storedCredentials.find(c => c.id.toString() === credId)
      if (credential) {
        setUsername(credential.username)
        // Note: We need to fetch the actual password from the backend
        // For security reasons, passwords are not returned in the list
        try {
          const response = await apiCall<{password: string}>(`credentials/${credId}/password`)
          setPassword(response.password)
        } catch (error) {
          console.error('Error fetching credential password:', error)
          alert('Error loading credential password. Please try manual entry.')
          setSelectedCredentialId('manual')
        }
      }
    }
  }

  const handleExecuteCommands = async () => {
    if (selectedDevices.length === 0) {
      alert('Please select devices first using the Devices tab.')
      return
    }

    if (!commands.trim()) {
      alert('Please enter at least one command.')
      return
    }

    if (!username.trim() || !password.trim()) {
      alert('Please enter username and password.')
      return
    }

    // Generate session ID upfront so Cancel button is available
    const sessionId = crypto.randomUUID()
    setCurrentSessionId(sessionId)
    setIsExecuting(true)
    setShowResults(false)
    setExecutionResults([])

    try {
      // Parse commands (split by newline, filter empty lines)
      const commandList = commands
        .split('\n')
        .map(cmd => cmd.trim())
        .filter(cmd => cmd.length > 0)

      if (commandList.length === 0) {
        alert('Please enter valid commands.')
        setIsExecuting(false)
        setCurrentSessionId(null)
        return
      }

      // Prepare device list for backend
      const devices = selectedDevices.map(device => ({
        ip: device.primary_ip4 || '',
        name: device.name,
        platform: device.platform || 'cisco_ios'
      }))

      // Prepare request body based on credential source
      const requestBody: any = {
        devices,
        commands: commandList,
        enable_mode: enableMode,
        write_config: writeConfig,
        session_id: sessionId  // Send session ID to backend
      }

      if (selectedCredentialId === 'manual') {
        // Use manual credentials
        requestBody.username = username
        requestBody.password = password
      } else {
        // Use stored credential
        requestBody.credential_id = parseInt(selectedCredentialId)
      }

      const response = await apiCall<{
        session_id: string
        results: CommandResult[]
        total_devices: number
        successful: number
        failed: number
        cancelled: number
      }>('netmiko/execute-commands', {
        method: 'POST',
        body: requestBody
      })

      setExecutionResults(response.results)
      setExecutionSummary({
        total: response.total_devices,
        successful: response.successful,
        failed: response.failed,
        cancelled: response.cancelled
      })
      setShowResults(true)
    } catch (error) {
      console.error('Error executing commands:', error)
      alert('Error executing commands: ' + (error as Error).message)
    } finally {
      setIsExecuting(false)
      setCurrentSessionId(null)
      setIsCancelling(false)
    }
  }

  const handleCancelExecution = async () => {
    if (!currentSessionId) {
      return
    }

    setIsCancelling(true)
    try {
      await apiCall(`netmiko/cancel/${currentSessionId}`, {
        method: 'POST'
      })
      // Note: The execution will continue but remaining devices will be cancelled
    } catch (error) {
      console.error('Error cancelling execution:', error)
      alert('Error cancelling execution: ' + (error as Error).message)
    }
  }

  const toggleDeviceDetails = (deviceName: string) => {
    const newExpanded = new Set(expandedDevices)
    if (newExpanded.has(deviceName)) {
      newExpanded.delete(deviceName)
    } else {
      newExpanded.add(deviceName)
    }
    setExpandedDevices(newExpanded)
  }

  const getResultIcon = (success: boolean) => {
    if (success) {
      return <CheckCircle2 className="h-5 w-5 text-green-600" />
    }
    return <XCircle className="h-5 w-5 text-red-600" />
  }

  const getResultBadge = (success: boolean) => {
    if (success) {
      return <Badge className="bg-green-100 text-green-800">Success</Badge>
    }
    return <Badge className="bg-red-100 text-red-800">Failed</Badge>
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Netmiko Command Execution</h1>
          <p className="text-gray-600">Execute commands on network devices using Netmiko</p>
        </div>
      </div>

      {/* Main Tabs */}
      <Tabs defaultValue="devices" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="devices">Devices</TabsTrigger>
          <TabsTrigger value="commands">Commands</TabsTrigger>
        </TabsList>

        {/* Devices Tab */}
        <TabsContent value="devices" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Select Devices</CardTitle>
              <CardDescription>
                Use logical operations to filter and select devices for command execution
              </CardDescription>
            </CardHeader>
          </Card>

          <DeviceSelector
            onDevicesSelected={handleDevicesSelected}
            showActions={true}
            showSaveLoad={true}
            compact={false}
            initialConditions={deviceConditions}
            initialDevices={previewDevices}
            enableSelection={true}
            selectedDeviceIds={selectedDeviceIds}
            onSelectionChange={handleSelectionChange}
          />

          {selectedDevices.length > 0 && (
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>
                <strong>{selectedDevices.length}</strong> device{selectedDevices.length !== 1 ? 's' : ''} selected.
                Switch to the <strong>Commands</strong> tab to execute commands.
              </AlertDescription>
            </Alert>
          )}
        </TabsContent>

        {/* Commands Tab */}
        <TabsContent value="commands" className="space-y-6">
          {/* Command Input Section */}
          <div className="shadow-lg border-0 p-0 bg-white rounded-lg">
            <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4 flex items-center justify-between rounded-t-lg">
              <div className="flex items-center space-x-2">
                <Terminal className="h-4 w-4" />
                <span className="text-sm font-medium">Command Configuration</span>
              </div>
              <div className="text-xs text-blue-100">
                Enter commands to execute on selected devices
              </div>
            </div>
            <div className="p-6 bg-gradient-to-b from-white to-gray-50">
              {selectedDevices.length === 0 && (
                <Alert className="mb-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    No devices selected. Please select devices in the <strong>Devices</strong> tab first.
                  </AlertDescription>
                </Alert>
              )}

              {selectedDevices.length > 0 && (
                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
                  <p className="text-sm text-blue-800">
                    <strong>{selectedDevices.length}</strong> device{selectedDevices.length !== 1 ? 's' : ''} selected
                  </p>
                </div>
              )}

              <div className="space-y-4">
                {/* Credentials Selection */}
                <div className="space-y-2">
                  <Label htmlFor="credential-select">Credentials *</Label>
                  <Select value={selectedCredentialId} onValueChange={handleCredentialChange}>
                    <SelectTrigger className="border-2 border-slate-300 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 shadow-sm">
                      <SelectValue placeholder="Select credentials..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="manual">Enter SSH Credentials</SelectItem>
                      {storedCredentials.map((cred) => (
                        <SelectItem key={cred.id} value={cred.id.toString()}>
                          {cred.name} ({cred.username})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Manual Credentials Input - Only shown when "Enter SSH Credentials" is selected */}
                {selectedCredentialId === 'manual' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="username">SSH Username *</Label>
                      <Input
                        id="username"
                        type="text"
                        placeholder="Enter SSH username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className="border-2 border-slate-300 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 shadow-sm"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="password">SSH Password *</Label>
                      <Input
                        id="password"
                        type="password"
                        placeholder="Enter SSH password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="border-2 border-slate-300 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 shadow-sm"
                      />
                    </div>
                  </div>
                )}

                {/* Show credential info when stored credential is selected */}
                {selectedCredentialId !== 'manual' && (
                  <div className="p-3 bg-green-50 border border-green-200 rounded-md">
                    <p className="text-sm text-green-800">
                      Using stored credentials: <strong>{storedCredentials.find(c => c.id.toString() === selectedCredentialId)?.name}</strong>
                    </p>
                  </div>
                )}

                {/* Commands Input */}
                <div className="space-y-2">
                  <Label htmlFor="commands">Commands (one per line) *</Label>
                  <Textarea
                    id="commands"
                    placeholder="Enter commands, one per line. Example:&#10;show version&#10;show ip interface brief&#10;show running-config"
                    value={commands}
                    onChange={(e) => setCommands(e.target.value)}
                    rows={8}
                    className="font-mono text-sm border-2 border-slate-300 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 shadow-sm"
                  />
                  <p className="text-xs text-gray-500">
                    Tip: Enter one command per line. Commands will be executed in sequence.
                  </p>
                </div>

                {/* Enable Mode Toggle */}
                <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-md">
                  <Switch
                    id="enable-mode"
                    checked={enableMode}
                    onCheckedChange={setEnableMode}
                  />
                  <div className="flex-1">
                    <Label htmlFor="enable-mode" className="font-medium cursor-pointer">
                      Enable configure mode after login
                    </Label>
                    <p className="text-xs text-gray-600 mt-1">
                      When enabled, commands will be executed in configuration mode
                    </p>
                  </div>
                </div>

                {/* Write Config Toggle */}
                <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-md">
                  <Switch
                    id="write-config"
                    checked={writeConfig}
                    onCheckedChange={setWriteConfig}
                  />
                  <div className="flex-1">
                    <Label htmlFor="write-config" className="font-medium cursor-pointer">
                      Write config at the end (when no errors occurred)
                    </Label>
                    <p className="text-xs text-gray-600 mt-1">
                      When enabled, runs &quot;copy running-config startup-config&quot; after successful command execution
                    </p>
                  </div>
                </div>

                {/* Execute and Cancel Buttons */}
                <div className="flex justify-start gap-3 pt-2">
                  <Button
                    onClick={handleExecuteCommands}
                    disabled={isExecuting || selectedDevices.length === 0 || !commands.trim() || !username.trim() || !password.trim()}
                    className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white border-0 px-6"
                    size="lg"
                  >
                    {isExecuting ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin" />
                        <span>Executing...</span>
                      </>
                    ) : (
                      <>
                        <Play className="h-5 w-5" />
                        <span>Run Commands</span>
                      </>
                    )}
                  </Button>

                  {isExecuting && currentSessionId && (
                    <Button
                      onClick={handleCancelExecution}
                      disabled={isCancelling}
                      className="flex items-center space-x-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white border-0 px-6"
                      size="lg"
                    >
                      <XCircle className="h-5 w-5" />
                      <span>{isCancelling ? 'Cancelling...' : 'Cancel'}</span>
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Execution Results */}
          {showResults && executionSummary && (
            <div className="shadow-lg border-0 p-0 bg-white rounded-lg">
              <div className="bg-gradient-to-r from-green-400/80 to-green-500/80 text-white py-2 px-4 flex items-center justify-between rounded-t-lg">
                <div className="flex items-center space-x-2">
                  <Terminal className="h-4 w-4" />
                  <span className="text-sm font-medium">Execution Results</span>
                </div>
                <div className="text-xs text-green-100">
                  {executionSummary.successful} successful, {executionSummary.failed} failed of {executionSummary.total} devices
                </div>
              </div>
              <div className="p-6 bg-gradient-to-b from-white to-gray-50">
                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                  <Card className="border-2 border-blue-200 bg-blue-50">
                    <CardHeader className="pb-3">
                      <CardDescription className="text-xs text-blue-600">Total Devices</CardDescription>
                      <CardTitle className="text-2xl text-blue-800">{executionSummary.total}</CardTitle>
                    </CardHeader>
                  </Card>
                  <Card className="border-2 border-green-200 bg-green-50">
                    <CardHeader className="pb-3">
                      <CardDescription className="text-xs text-green-600">Successful</CardDescription>
                      <CardTitle className="text-2xl text-green-800">{executionSummary.successful}</CardTitle>
                    </CardHeader>
                  </Card>
                  <Card className="border-2 border-red-200 bg-red-50">
                    <CardHeader className="pb-3">
                      <CardDescription className="text-xs text-red-600">Failed</CardDescription>
                      <CardTitle className="text-2xl text-red-800">{executionSummary.failed}</CardTitle>
                    </CardHeader>
                  </Card>
                  {executionSummary.cancelled > 0 && (
                    <Card className="border-2 border-orange-200 bg-orange-50">
                      <CardHeader className="pb-3">
                        <CardDescription className="text-xs text-orange-600">Cancelled</CardDescription>
                        <CardTitle className="text-2xl text-orange-800">{executionSummary.cancelled}</CardTitle>
                      </CardHeader>
                    </Card>
                  )}
                </div>

                {/* Results Table */}
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12"></TableHead>
                        <TableHead>Device</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Message</TableHead>
                        <TableHead className="w-32 text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {executionResults.map((result, index) => (
                        <>
                          <TableRow key={`${result.device}-${index}`} className="hover:bg-gray-50">
                            <TableCell>
                              {getResultIcon(result.success)}
                            </TableCell>
                            <TableCell className="font-medium">
                              {result.device}
                            </TableCell>
                            <TableCell>
                              {getResultBadge(result.success)}
                            </TableCell>
                            <TableCell className="max-w-md">
                              {result.error ? (
                                <span className="text-sm text-red-600">{result.error}</span>
                              ) : (
                                <span className="text-sm text-gray-600">Command executed successfully</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              {result.output && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => toggleDeviceDetails(result.device)}
                                  className="text-xs"
                                >
                                  {expandedDevices.has(result.device) ? 'Hide Details' : 'Show Details'}
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                          {expandedDevices.has(result.device) && result.output && (
                            <TableRow key={`${result.device}-details-${index}`}>
                              <TableCell colSpan={5} className="p-0">
                                <div className="bg-gray-900 p-4 border-t border-gray-700">
                                  <div className="mb-2 text-xs text-gray-400 font-medium">
                                    Output for {result.device}:
                                  </div>
                                  <pre className="text-xs text-green-400 font-mono whitespace-pre-wrap overflow-x-auto max-h-96 overflow-y-auto">
                                    {result.output}
                                  </pre>
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
