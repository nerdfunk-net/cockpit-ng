'use client'

import { useState, useEffect, Fragment } from 'react'
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
import { Terminal, Play, AlertCircle, CheckCircle2, XCircle, Loader2, Plus, Trash2 } from 'lucide-react'
import { DeviceSelector, type DeviceInfo, type LogicalCondition } from '@/components/shared/device-selector'
import { useApi } from '@/hooks/use-api'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

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

interface TemplateVariable {
  id: string
  name: string
  value: string
}

interface Template {
  id: number
  name: string
  category: string
  content: string
  scope: 'global' | 'private'
  created_by?: string
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

  // Variables & Templates state
  const [variables, setVariables] = useState<TemplateVariable[]>([
    { id: crypto.randomUUID(), name: '', value: '' }
  ])
  const [useNautobotContext, setUseNautobotContext] = useState(true)
  const [templates, setTemplates] = useState<Template[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('none')
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null)
  const [testDeviceId, setTestDeviceId] = useState<string>('')
  const [isTestingTemplate, setIsTestingTemplate] = useState(false)
  const [showTestResultDialog, setShowTestResultDialog] = useState(false)
  const [testResult, setTestResult] = useState<string>('')
  const [showNautobotDataDialog, setShowNautobotDataDialog] = useState(false)
  const [nautobotData, setNautobotData] = useState<any>(null)
  const [isLoadingNautobotData, setIsLoadingNautobotData] = useState(false)
  const [editedTemplateContent, setEditedTemplateContent] = useState<string>('')
  const [isSavingTemplate, setIsSavingTemplate] = useState(false)
  const [showErrorDialog, setShowErrorDialog] = useState(false)
  const [errorDetails, setErrorDetails] = useState<{
    title: string
    message: string
    details?: string[]
  } | null>(null)

  // Commands state
  const [commands, setCommands] = useState('')
  const [enableMode, setEnableMode] = useState(false)
  const [writeConfig, setWriteConfig] = useState(false)
  const [dryRun, setDryRun] = useState(false)

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

  // Load stored SSH credentials and templates on mount
  useEffect(() => {
    loadStoredCredentials()
    loadTemplates()
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

  const loadTemplates = async () => {
    try {
      // Try lowercase first (standard)
      let response = await apiCall<{ templates: Template[]; total: number }>('templates?category=netmiko')
      console.log('Loaded templates with category=netmiko:', response.templates)

      // If no templates found, try with capital N (in case user created it manually)
      if (!response.templates || response.templates.length === 0) {
        const responseCapital = await apiCall<{ templates: Template[]; total: number }>('templates?category=Netmiko')
        console.log('Loaded templates with category=Netmiko:', responseCapital.templates)
        setTemplates(responseCapital.templates || [])
      } else {
        setTemplates(response.templates || [])
      }
    } catch (error) {
      console.error('Error loading templates:', error)
      setTemplates([])
    }
  }

  // Variable management functions
  const addVariable = () => {
    setVariables([...variables, { id: crypto.randomUUID(), name: '', value: '' }])
  }

  const removeVariable = (id: string) => {
    if (variables.length > 1) {
      setVariables(variables.filter(v => v.id !== id))
    }
  }

  const updateVariable = (id: string, field: 'name' | 'value', value: string) => {
    setVariables(variables.map(v =>
      v.id === id ? { ...v, [field]: value } : v
    ))
  }

  const validateVariableName = (name: string): boolean => {
    // Jinja2 variable names: alphanumeric and underscore, cannot start with a number
    const validPattern = /^[a-zA-Z_][a-zA-Z0-9_]*$/
    return validPattern.test(name)
  }

  const handleTemplateChange = async (templateId: string) => {
    setSelectedTemplateId(templateId)
    if (templateId === 'none') {
      setSelectedTemplate(null)
      setEditedTemplateContent('')
      return
    }

    const template = templates.find(t => t.id.toString() === templateId)
    if (template) {
      setSelectedTemplate(template)
      setEditedTemplateContent(template.content)
    }
  }

  const handleSaveTemplate = async () => {
    if (!selectedTemplate || selectedTemplate.scope !== 'private') {
      return
    }

    setIsSavingTemplate(true)
    try {
      await apiCall(`templates/${selectedTemplate.id}`, {
        method: 'PUT',
        body: {
          content: editedTemplateContent
        }
      })

      // Update the local template list
      setTemplates(templates.map(t =>
        t.id === selectedTemplate.id ? { ...t, content: editedTemplateContent } : t
      ))
      setSelectedTemplate({ ...selectedTemplate, content: editedTemplateContent })

      alert('Template saved successfully!')
    } catch (error) {
      console.error('Error saving template:', error)
      alert('Failed to save template')
    } finally {
      setIsSavingTemplate(false)
    }
  }

  const handleTestTemplate = async () => {
    if (!selectedTemplate || !testDeviceId) {
      return
    }

    setIsTestingTemplate(true)
    try {
      // Find the selected device
      const device = selectedDevices.find(d => d.id === testDeviceId)
      if (!device) {
        alert('Selected device not found')
        return
      }

      // Prepare variables object
      const varsObject: Record<string, string> = {}
      variables.forEach(v => {
        if (v.name && validateVariableName(v.name)) {
          varsObject[v.name] = v.value
        }
      })

      // Call backend to render template using the new endpoint
      // For private templates, use edited content if it has been modified
      const useEditedContent = selectedTemplate.scope === 'private' && editedTemplateContent !== selectedTemplate.content

      const response = await apiCall<{
        rendered_content: string
        variables_used: string[]
        warnings?: string[]
      }>('templates/render', {
        method: 'POST',
        body: useEditedContent ? {
          template_content: editedTemplateContent,
          category: 'netmiko',
          device_id: device.id,
          user_variables: varsObject,
          use_nautobot_context: useNautobotContext
        } : {
          template_id: selectedTemplate.id,
          category: 'netmiko',
          device_id: device.id,  // Pass UUID directly
          user_variables: varsObject,
          use_nautobot_context: useNautobotContext
        }
      })

      setTestResult(response.rendered_content)
      setShowTestResultDialog(true)

      // Log warnings if any
      if (response.warnings && response.warnings.length > 0) {
        console.warn('Template rendering warnings:', response.warnings)
      }
    } catch (error: any) {
      console.error('Error testing template:', error)

      // Parse error message to extract details
      const errorMessage = error?.message || 'Unknown error'
      const details: string[] = []

      // Check if it's a 400 Bad Request with template rendering error
      if (errorMessage.includes('400') && errorMessage.includes('detail')) {
        try {
          // Extract the detail from the error message
          const detailMatch = errorMessage.match(/"detail":"([^"]+)"/)
          if (detailMatch && detailMatch[1]) {
            const detailMessage = detailMatch[1]

            // Parse the detail message for available variables
            const availableVarsMatch = detailMessage.match(/Available variables: (.+)$/)
            const errorDescMatch = detailMessage.match(/^([^.]+)/)

            if (errorDescMatch) {
              details.push(`Error: ${errorDescMatch[1]}`)
            }

            if (availableVarsMatch) {
              details.push(`Available variables: ${availableVarsMatch[1]}`)
            }

            // Add user-provided variables
            const userVars = Object.keys(varsObject)
            if (userVars.length > 0) {
              details.push(`User-provided variables: ${userVars.join(', ')}`)
            } else {
              details.push('User-provided variables: (none)')
            }

            // Add Nautobot context status
            details.push(`Nautobot context enabled: ${useNautobotContext ? 'Yes' : 'No'}`)
            if (useNautobotContext) {
              details.push(`Selected device: ${device.name}`)
            }
          }
        } catch (parseError) {
          details.push(`Error message: ${errorMessage}`)
        }
      } else {
        details.push(`Error message: ${errorMessage}`)
      }

      setErrorDetails({
        title: 'Template Rendering Failed',
        message: 'The template could not be rendered. Please check the details below:',
        details
      })
      setShowErrorDialog(true)
    } finally {
      setIsTestingTemplate(false)
    }
  }

  const handleShowNautobotData = async () => {
    if (!testDeviceId) {
      return
    }

    setIsLoadingNautobotData(true)
    try {
      // Find the selected device
      const device = selectedDevices.find(d => d.id === testDeviceId)
      if (!device) {
        alert('Selected device not found')
        return
      }

      // Fetch detailed Nautobot data
      const response = await apiCall<any>(`nautobot/devices/${device.id}/details`)
      setNautobotData(response)
      setShowNautobotDataDialog(true)
    } catch (error) {
      console.error('Error fetching Nautobot data:', error)
      alert('Error fetching Nautobot data: ' + (error as Error).message)
    } finally {
      setIsLoadingNautobotData(false)
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

    // Check if using template or commands
    const usingTemplate = selectedTemplateId !== 'none'

    if (!usingTemplate) {
      // Command mode validation
      if (!commands.trim()) {
        alert('Please enter at least one command.')
        return
      }
    }

    // Validate credentials (not required for dry run with template)
    if (!usingTemplate || !dryRun) {
      if (!username.trim() || !password.trim()) {
        alert('Please enter username and password.')
        return
      }
    }

    // Generate session ID upfront so Cancel button is available
    const sessionId = crypto.randomUUID()
    setCurrentSessionId(sessionId)
    setIsExecuting(true)
    setShowResults(false)
    setExecutionResults([])

    try {
      if (usingTemplate) {
        // Template execution mode
        const varsObject: Record<string, string> = {}
        variables.forEach(v => {
          if (v.name && validateVariableName(v.name)) {
            varsObject[v.name] = v.value
          }
        })

        // Determine if we should send template_id or template_content
        const useEditedContent = selectedTemplate && editedTemplateContent !== selectedTemplate.content

        const requestBody: any = {
          device_ids: selectedDevices.map(d => d.id),
          user_variables: varsObject,
          use_nautobot_context: useNautobotContext,
          dry_run: dryRun,
          enable_mode: enableMode,
          write_config: writeConfig,
          session_id: sessionId
        }

        if (useEditedContent) {
          requestBody.template_content = editedTemplateContent
        } else {
          requestBody.template_id = selectedTemplate?.id
        }

        if (selectedCredentialId === 'manual') {
          requestBody.username = username
          requestBody.password = password
        } else if (selectedCredentialId !== 'manual') {
          requestBody.credential_id = parseInt(selectedCredentialId)
        }

        const response = await apiCall<{
          session_id: string
          results: Array<{
            device_id: string
            device_name: string
            success: boolean
            rendered_content?: string
            output?: string
            error?: string
          }>
          summary: Record<string, number>
        }>('netmiko/execute-template', {
          method: 'POST',
          body: requestBody
        })

        // Convert template results to command results format for display
        const convertedResults: CommandResult[] = response.results.map(r => ({
          device: r.device_name,
          success: r.success,
          output: dryRun
            ? `[DRY RUN - Rendered Commands]\n\n${r.rendered_content || ''}`
            : r.output || r.rendered_content || '',
          error: r.error
        }))

        setExecutionResults(convertedResults)
        setExecutionSummary({
          total: response.summary.total,
          successful: dryRun ? response.summary.rendered_successfully : (response.summary.executed_successfully || 0),
          failed: response.summary.failed,
          cancelled: response.summary.cancelled || 0
        })
        setShowResults(true)
      } else {
        // Command execution mode (original logic)
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

        const devices = selectedDevices.map(device => ({
          ip: device.primary_ip4 || '',
          name: device.name,
          platform: device.platform || 'cisco_ios'
        }))

        const requestBody: any = {
          devices,
          commands: commandList,
          enable_mode: enableMode,
          write_config: writeConfig,
          session_id: sessionId
        }

        if (selectedCredentialId === 'manual') {
          requestBody.username = username
          requestBody.password = password
        } else {
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
      }
    } catch (error) {
      console.error('Error executing:', error)
      alert('Error executing: ' + (error as Error).message)
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
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="devices">Devices</TabsTrigger>
          <TabsTrigger value="variables">Variables & Templates</TabsTrigger>
          <TabsTrigger value="commands">Execute</TabsTrigger>
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
                Switch to the <strong>Variables & Templates</strong> tab to configure templates, or <strong>Commands</strong> tab to execute commands.
              </AlertDescription>
            </Alert>
          )}
        </TabsContent>

        {/* Variables & Templates Tab */}
        <TabsContent value="variables" className="space-y-6">
          {/* Panel 1: Variables */}
          <Card>
            <CardHeader>
              <CardTitle>Template Variables</CardTitle>
              <CardDescription>
                Define variables that will be used in your Jinja2 template
              </CardDescription>
            </CardHeader>
            <div className="p-6 space-y-4">
              {/* Nautobot Context Checkbox */}
              <div className="flex items-center space-x-3 p-3 bg-blue-50 border border-blue-200 rounded-md">
                <Switch
                  id="use-nautobot-context"
                  checked={useNautobotContext}
                  onCheckedChange={setUseNautobotContext}
                />
                <div className="flex-1">
                  <Label htmlFor="use-nautobot-context" className="font-medium cursor-pointer">
                    Use Nautobot data & context
                  </Label>
                  <p className="text-xs text-gray-600 mt-1">
                    When enabled, Nautobot device data will be available in the template context
                  </p>
                </div>
              </div>

              {/* Variables List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Custom Variables</Label>
                  <Button
                    onClick={addVariable}
                    size="sm"
                    variant="outline"
                    className="flex items-center gap-1"
                  >
                    <Plus className="h-4 w-4" />
                    Add Variable
                  </Button>
                </div>

                {variables.map((variable, index) => (
                  <div key={variable.id} className="flex items-start gap-2">
                    <div className="flex-1 grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Input
                          placeholder="Variable name (e.g., hostname)"
                          value={variable.name}
                          onChange={(e) => updateVariable(variable.id, 'name', e.target.value)}
                          className={`border-2 ${
                            variable.name && !validateVariableName(variable.name)
                              ? 'border-red-500 focus:border-red-500'
                              : 'border-slate-300 focus:border-blue-500'
                          } bg-white`}
                        />
                        {variable.name && !validateVariableName(variable.name) && (
                          <p className="text-xs text-red-600">
                            Invalid name. Use letters, numbers, underscore. Must start with letter or underscore.
                          </p>
                        )}
                      </div>
                      <Input
                        placeholder="Value"
                        value={variable.value}
                        onChange={(e) => updateVariable(variable.id, 'value', e.target.value)}
                        className="border-2 border-slate-300 bg-white focus:border-blue-500"
                      />
                    </div>
                    <Button
                      onClick={() => removeVariable(variable.id)}
                      size="icon"
                      variant="ghost"
                      className="h-10 w-10 text-red-600 hover:text-red-700 hover:bg-red-50"
                      disabled={variables.length === 1}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          {/* Panel 2: Template Selection */}
          <Card>
            <CardHeader>
              <CardTitle>Template Selection</CardTitle>
              <CardDescription>
                Choose a Jinja2 template to generate commands for your devices
              </CardDescription>
            </CardHeader>
            <div className="p-6 space-y-4">
              {/* Template Selection Dropdown */}
              <div className="space-y-2">
                <Label htmlFor="template-select">Template</Label>
                <Select value={selectedTemplateId} onValueChange={handleTemplateChange}>
                  <SelectTrigger className="border-2 border-slate-300 bg-white focus:border-blue-500">
                    <SelectValue placeholder="Select a template..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Template</SelectItem>
                    {templates.map((template) => (
                      <SelectItem key={template.id} value={template.id.toString()}>
                        {template.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Template Preview */}
              {selectedTemplate && (
                <>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Template Preview</Label>
                      {selectedTemplate.scope === 'private' && (
                        <Badge variant="outline" className="text-xs">
                          Editable (Private)
                        </Badge>
                      )}
                    </div>
                    <Textarea
                      value={editedTemplateContent}
                      onChange={(e) => setEditedTemplateContent(e.target.value)}
                      readOnly={selectedTemplate.scope !== 'private'}
                      rows={12}
                      className={`font-mono text-sm border-2 resize-none ${
                        selectedTemplate.scope === 'private'
                          ? 'border-blue-300 bg-white'
                          : 'border-slate-300 bg-gray-50'
                      }`}
                      placeholder={selectedTemplate.scope === 'private' ? 'Edit your private template...' : ''}
                    />
                    {selectedTemplate.scope === 'private' && (
                      <div className="flex justify-end">
                        <Button
                          onClick={handleSaveTemplate}
                          disabled={isSavingTemplate || editedTemplateContent === selectedTemplate.content}
                          size="sm"
                          className="gap-2"
                        >
                          {isSavingTemplate ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Saving...
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="h-4 w-4" />
                              Save Template
                            </>
                          )}
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Test Template Section */}
                  <div className="space-y-3 p-4 bg-gray-50 rounded-md border border-gray-200">
                    <Label className="text-sm font-medium">Test Template Rendering</Label>

                    {selectedDevices.length === 0 ? (
                      <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          Please select devices in the <strong>Devices</strong> tab first to test the template.
                        </AlertDescription>
                      </Alert>
                    ) : (
                      <div className="space-y-3">
                        <div className="flex items-end gap-2">
                          <div className="flex-1 space-y-2">
                            <Label htmlFor="test-device-select" className="text-sm">
                              Select Device for Testing
                            </Label>
                            <Select value={testDeviceId} onValueChange={setTestDeviceId}>
                              <SelectTrigger className="border-2 border-slate-300 bg-white focus:border-blue-500">
                                <SelectValue placeholder="Choose a device..." />
                              </SelectTrigger>
                              <SelectContent>
                                {selectedDevices.map((device) => (
                                  <SelectItem key={device.id} value={device.id}>
                                    {device.name} ({device.primary_ip4 || 'No IP'})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <Button
                            onClick={handleTestTemplate}
                            disabled={!testDeviceId || isTestingTemplate}
                            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400"
                          >
                            {isTestingTemplate ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Testing...
                              </>
                            ) : (
                              'Test Template'
                            )}
                          </Button>
                          <Button
                            onClick={handleShowNautobotData}
                            disabled={!testDeviceId || isLoadingNautobotData}
                            variant="outline"
                            className="border-2 border-slate-300"
                          >
                            {isLoadingNautobotData ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Loading...
                              </>
                            ) : (
                              'Show Nautobot Data'
                            )}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </Card>
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

                {/* Commands Input or Template Info */}
                {selectedTemplateId === 'none' ? (
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
                ) : (
                  <div className="p-4 bg-blue-50 border-2 border-blue-300 rounded-md space-y-2">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-blue-600" />
                      <Label className="text-blue-900 font-semibold">Using Template</Label>
                    </div>
                    <p className="text-sm text-blue-800">
                      Commands will be generated from the selected template: <strong>{selectedTemplate?.name}</strong>
                    </p>
                    <p className="text-xs text-blue-700">
                      The template will be rendered for each device using Nautobot context and your defined variables.
                    </p>
                  </div>
                )}

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

                {/* Dry Run Toggle (only for templates) */}
                {selectedTemplateId !== 'none' && (
                  <div className="flex items-center space-x-3 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                    <Switch
                      id="dry-run"
                      checked={dryRun}
                      onCheckedChange={setDryRun}
                    />
                    <div className="flex-1">
                      <Label htmlFor="dry-run" className="font-medium cursor-pointer text-yellow-900">
                        Dry Run (render only, do not execute)
                      </Label>
                      <p className="text-xs text-yellow-800 mt-1">
                        When enabled, the template will be rendered for each device but NOT executed. Use this to preview generated commands.
                      </p>
                    </div>
                  </div>
                )}

                {/* Execute and Cancel Buttons */}
                <div className="flex justify-start gap-3 pt-2">
                  <Button
                    onClick={handleExecuteCommands}
                    disabled={
                      isExecuting ||
                      selectedDevices.length === 0 ||
                      (selectedTemplateId === 'none' && !commands.trim()) ||
                      (selectedTemplateId === 'none' && (!username.trim() || !password.trim())) ||
                      (selectedTemplateId !== 'none' && !dryRun && (!username.trim() || !password.trim()))
                    }
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
                        <span>
                          {selectedTemplateId !== 'none'
                            ? (dryRun ? 'Render Template (Dry Run)' : 'Execute Template')
                            : 'Run Commands'}
                        </span>
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
                        <Fragment key={`${result.device}-${index}`}>
                          <TableRow className="hover:bg-gray-50">
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
                            <TableRow>
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
                        </Fragment>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Test Template Result Dialog */}
      <Dialog open={showTestResultDialog} onOpenChange={setShowTestResultDialog}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Template Test Result</DialogTitle>
            <DialogDescription>
              Rendered template output for the selected device
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Rendered Commands</Label>
              <Textarea
                value={testResult}
                readOnly
                rows={20}
                className="font-mono text-sm border-2 border-slate-300 bg-gray-50 resize-none"
              />
            </div>
            <div className="flex justify-end">
              <Button onClick={() => setShowTestResultDialog(false)}>
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Nautobot Data Dialog */}
      <Dialog open={showNautobotDataDialog} onOpenChange={setShowNautobotDataDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Nautobot Device Details</DialogTitle>
            <DialogDescription>
              Complete device information from Nautobot
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto">
            {nautobotData && (
              <div className="space-y-4">
                {/* Device Overview */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
                      <Label className="text-xs text-blue-600 font-semibold">Device Name</Label>
                      <p className="text-sm font-medium mt-1">{nautobotData.name || 'N/A'}</p>
                    </div>
                    {nautobotData.primary_ip4 && (
                      <div className="p-3 bg-green-50 border border-green-200 rounded-md">
                        <Label className="text-xs text-green-600 font-semibold">Primary IPv4</Label>
                        <p className="text-sm font-medium mt-1">{nautobotData.primary_ip4.address || 'N/A'}</p>
                      </div>
                    )}
                    {nautobotData.role && (
                      <div className="p-3 bg-purple-50 border border-purple-200 rounded-md">
                        <Label className="text-xs text-purple-600 font-semibold">Role</Label>
                        <p className="text-sm font-medium mt-1">{nautobotData.role.name || 'N/A'}</p>
                      </div>
                    )}
                  </div>
                  <div className="space-y-3">
                    {nautobotData.device_type && (
                      <div className="p-3 bg-orange-50 border border-orange-200 rounded-md">
                        <Label className="text-xs text-orange-600 font-semibold">Device Type</Label>
                        <p className="text-sm font-medium mt-1">{nautobotData.device_type.model || 'N/A'}</p>
                        {nautobotData.device_type.manufacturer && (
                          <p className="text-xs text-gray-600 mt-1">{nautobotData.device_type.manufacturer.name}</p>
                        )}
                      </div>
                    )}
                    {nautobotData.platform && (
                      <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-md">
                        <Label className="text-xs text-indigo-600 font-semibold">Platform</Label>
                        <p className="text-sm font-medium mt-1">{nautobotData.platform.name || 'N/A'}</p>
                      </div>
                    )}
                    {nautobotData.status && (
                      <div className="p-3 bg-teal-50 border border-teal-200 rounded-md">
                        <Label className="text-xs text-teal-600 font-semibold">Status</Label>
                        <p className="text-sm font-medium mt-1">{nautobotData.status.name || 'N/A'}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Location */}
                {nautobotData.location && (
                  <div className="p-3 bg-gray-50 border border-gray-200 rounded-md">
                    <Label className="text-xs text-gray-600 font-semibold">Location</Label>
                    <p className="text-sm font-medium mt-1">
                      {nautobotData.location.name}
                      {nautobotData.location.parent && ` (${nautobotData.location.parent.name})`}
                    </p>
                  </div>
                )}

                {/* Serial & Asset Tag */}
                {(nautobotData.serial || nautobotData.asset_tag) && (
                  <div className="grid grid-cols-2 gap-4">
                    {nautobotData.serial && (
                      <div className="p-3 bg-gray-50 border border-gray-200 rounded-md">
                        <Label className="text-xs text-gray-600 font-semibold">Serial Number</Label>
                        <p className="text-sm font-medium mt-1">{nautobotData.serial}</p>
                      </div>
                    )}
                    {nautobotData.asset_tag && (
                      <div className="p-3 bg-gray-50 border border-gray-200 rounded-md">
                        <Label className="text-xs text-gray-600 font-semibold">Asset Tag</Label>
                        <p className="text-sm font-medium mt-1">{nautobotData.asset_tag}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Config Context */}
                {nautobotData.config_context && Object.keys(nautobotData.config_context).length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Config Context</Label>
                    <pre className="p-3 bg-gray-900 text-green-400 text-xs font-mono rounded-md overflow-x-auto max-h-60 overflow-y-auto">
                      {JSON.stringify(nautobotData.config_context, null, 2)}
                    </pre>
                  </div>
                )}

                {/* Tags */}
                {nautobotData.tags && nautobotData.tags.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Tags</Label>
                    <div className="flex flex-wrap gap-2">
                      {nautobotData.tags.map((tag: any) => (
                        <Badge key={tag.id} variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                          {tag.name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Full JSON Data */}
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Full Device Data (JSON)</Label>
                  <pre className="p-3 bg-gray-900 text-green-400 text-xs font-mono rounded-md overflow-x-auto max-h-96 overflow-y-auto">
                    {JSON.stringify(nautobotData, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </div>
          <div className="flex justify-end pt-4 border-t">
            <Button onClick={() => setShowNautobotDataDialog(false)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Error Dialog */}
      <Dialog open={showErrorDialog} onOpenChange={setShowErrorDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <XCircle className="h-5 w-5" />
              {errorDetails?.title || 'Error'}
            </DialogTitle>
            <DialogDescription>
              {errorDetails?.message}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {errorDetails?.details && errorDetails.details.length > 0 && (
              <div className="space-y-2 p-4 bg-red-50 border border-red-200 rounded-md">
                <Label className="text-sm font-semibold text-red-900">Details:</Label>
                <ul className="space-y-1 text-sm text-red-800">
                  {errorDetails.details.map((detail, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <span className="text-red-600 mt-0.5">•</span>
                      <span className="flex-1 font-mono">{detail}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
              <p className="text-sm text-blue-900">
                <strong>Tip:</strong> Make sure all variables used in the template are either:
              </p>
              <ul className="mt-2 space-y-1 text-sm text-blue-800 ml-4">
                <li>• Provided in the "Variables" section above</li>
                <li>• Available from Nautobot context (enable "Use Nautobot Context")</li>
                <li>• Part of the standard variables (user_variables, nautobot)</li>
              </ul>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowErrorDialog(false)
                  console.log('Full error details:', errorDetails)
                }}
              >
                View in Console
              </Button>
              <Button onClick={() => setShowErrorDialog(false)}>
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
