'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useApi } from '@/hooks/use-api'
import { cn } from '@/lib/utils'
import { Loader2, CheckCircle, RotateCcw, Network, AlertCircle, Settings } from 'lucide-react'

export default function CommonSettingsForm() {
  const { apiCall } = useApi()

  // YAML content state
  const [snmpMappingYaml, setSnmpMappingYaml] = useState('')
  const [yamlLoading, setYamlLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('snmp-mapping')
  const [validating, setValidating] = useState(false)
  const [validationError, setValidationError] = useState<{
    message: string
    error?: string
    line?: number
    column?: number
  } | null>(null)
  const [showValidationDialog, setShowValidationDialog] = useState(false)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState<'success' | 'error'>('success')

  const showMessage = useCallback((msg: string, type: 'success' | 'error') => {
    setMessage(msg)
    setMessageType(type)

    setTimeout(() => {
      setMessage('')
    }, 5000)
  }, [])

  const loadYamlFiles = useCallback(async () => {
    try {
      setYamlLoading(true)
      const snmpResponse = await apiCall('config/snmp_mapping.yaml') as { success?: boolean; data?: string }

      if (snmpResponse.success && snmpResponse.data) {
        setSnmpMappingYaml(snmpResponse.data)
      }
    } catch (error) {
      console.error('Error loading YAML files:', error)
      showMessage('Failed to load YAML files', 'error')
    } finally {
      setYamlLoading(false)
    }
  }, [apiCall, showMessage])

  const validateYaml = useCallback(async (content: string, filename: string) => {
    try {
      setValidating(true)
      setValidationError(null)

      const response = await apiCall('config/validate', {
        method: 'POST',
        body: JSON.stringify({ content }),
      }) as {
        success?: boolean
        valid?: boolean
        message?: string
        error?: string
        line?: number
        column?: number
      }

      if (response.success && response.valid) {
        showMessage(`${filename} is valid YAML`, 'success')
      } else {
        setValidationError({
          message: response.message || 'Invalid YAML',
          error: response.error,
          line: response.line,
          column: response.column,
        })
        setShowValidationDialog(true)
      }
    } catch (error) {
      console.error('Error validating YAML:', error)
      showMessage('Failed to validate YAML', 'error')
    } finally {
      setValidating(false)
    }
  }, [apiCall, showMessage])

  const saveYamlFile = useCallback(async (filename: string, content: string) => {
    try {
      setYamlLoading(true)

      const response = await apiCall(`config/${filename}`, {
        method: 'POST',
        body: JSON.stringify({ content }),
      }) as { success?: boolean; message?: string }

      if (response.success) {
        showMessage(`${filename} saved successfully`, 'success')
      } else {
        showMessage(`Failed to save ${filename}`, 'error')
      }
    } catch (error) {
      console.error(`Error saving ${filename}:`, error)
      showMessage(`Failed to save ${filename}`, 'error')
    } finally {
      setYamlLoading(false)
    }
  }, [apiCall, showMessage])

  useEffect(() => {
    loadYamlFiles()
  }, [loadYamlFiles])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="bg-blue-100 p-2 rounded-lg">
            <Settings className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Common Settings</h1>
            <p className="text-muted-foreground">
              Manage common settings used across multiple applications
            </p>
          </div>
        </div>
      </div>

      {/* Success/Error Message */}
      {message && (
        <div
          className={cn(
            'flex items-center gap-2 p-4 rounded-md',
            messageType === 'success'
              ? 'bg-green-50 text-green-800'
              : 'bg-red-50 text-red-800'
          )}
        >
          {messageType === 'success' ? (
            <CheckCircle className="h-5 w-5" />
          ) : (
            <AlertCircle className="h-5 w-5" />
          )}
          <span>{message}</span>
        </div>
      )}

      {/* Validation Error Dialog */}
      <Dialog open={showValidationDialog} onOpenChange={setShowValidationDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2 text-red-600">
              <AlertCircle className="h-5 w-5" />
              <span>YAML Validation Error</span>
            </DialogTitle>
            <DialogDescription>
              <div className="space-y-2 mt-4">
                <p className="font-semibold">{validationError?.message}</p>
                {validationError?.error && (
                  <p className="text-sm text-gray-600">{validationError.error}</p>
                )}
                {validationError?.line && (
                  <p className="text-sm text-gray-600">
                    Line {validationError.line}
                    {validationError.column && `, Column ${validationError.column}`}
                  </p>
                )}
                <p className="text-sm text-gray-500 mt-4">
                  Common YAML syntax issues:
                </p>
                <ul className="text-sm text-gray-500 list-disc list-inside">
                  <li>Incorrect indentation (use spaces, not tabs)</li>
                  <li>Missing quotes around special characters</li>
                  <li>Invalid key-value pair format</li>
                  <li>Unclosed brackets or braces</li>
                </ul>
              </div>
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid grid-cols-1 w-full max-w-xs">
          <TabsTrigger value="snmp-mapping" className="flex items-center space-x-2">
            <Network className="h-4 w-4" />
            <span>SNMP Mapping</span>
          </TabsTrigger>
        </TabsList>

        {/* SNMP Mapping Tab */}
        <TabsContent value="snmp-mapping" className="space-y-6">
          <Card className="shadow-lg border-0 overflow-hidden p-0">
            <CardHeader className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white border-b-0 rounded-none m-0 py-2 px-4">
              <CardTitle className="flex items-center space-x-2 text-sm font-medium">
                <Network className="h-4 w-4" />
                <span>SNMP Mapping Configuration (snmp_mapping.yaml)</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 bg-gradient-to-b from-white to-gray-50 space-y-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700">SNMP Mapping Content</Label>
                <Textarea
                  value={snmpMappingYaml}
                  onChange={(e) => setSnmpMappingYaml(e.target.value)}
                  placeholder="YAML content will be loaded here..."
                  className="w-full h-96 font-mono text-sm border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500">
                  Edit the SNMP mapping configuration YAML file. This defines SNMP credentials and mapping for different devices.
                </p>
              </div>

              <div className="flex justify-end space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={loadYamlFiles}
                  disabled={yamlLoading || validating}
                  className="flex items-center space-x-2"
                >
                  {yamlLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RotateCcw className="h-4 w-4" />
                  )}
                  <span>Reload</span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => validateYaml(snmpMappingYaml, 'snmp_mapping.yaml')}
                  disabled={yamlLoading || validating || !snmpMappingYaml}
                  className="flex items-center space-x-2"
                >
                  {validating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle className="h-4 w-4" />
                  )}
                  <span>Check YAML</span>
                </Button>
                <Button
                  type="button"
                  onClick={() => saveYamlFile('snmp_mapping.yaml', snmpMappingYaml)}
                  disabled={yamlLoading || validating}
                  className="flex items-center space-x-2 bg-green-600 hover:bg-green-700 text-white"
                >
                  {yamlLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Network className="h-4 w-4" />
                  )}
                  <span>Save Mapping</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
