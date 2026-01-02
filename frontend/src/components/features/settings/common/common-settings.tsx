'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { useApi } from '@/hooks/use-api'
import { useAuthStore } from '@/lib/auth-store'
import { cn } from '@/lib/utils'
import { Loader2, CheckCircle, RotateCcw, Network, AlertCircle, Settings, Download, GitPullRequest, FileText, HelpCircle } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

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

  // Import from Git state
  const [showImportDialog, setShowImportDialog] = useState(false)
  const [gitRepos, setGitRepos] = useState<Array<{id: number; name: string; category: string; is_active: boolean; last_sync?: string | null}>>([])
  const [selectedRepoId, setSelectedRepoId] = useState<number | null>(null)
  const [repoStatus, setRepoStatus] = useState<{ahead_count: number; behind_count: number; is_clean: boolean; is_synced?: boolean} | null>(null)
  const [repoFiles, setRepoFiles] = useState<Array<{name: string; path: string; directory: string}>>([])
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [fileFilter, setFileFilter] = useState('')
  const [importLoading, setImportLoading] = useState(false)
  const [importStep, setImportStep] = useState<'select-repo' | 'check-sync' | 'select-file'>('select-repo')
  const [showHelpDialog, setShowHelpDialog] = useState(false)

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

  const loadGitRepos = useCallback(async () => {
    try {
      const response = await apiCall('git-repositories/') as { 
        repositories?: Array<{id: number; name: string; category: string; is_active: boolean; last_sync?: string | null}>
        total?: number
      }
      
      if (response.repositories) {
        // Filter for cockpit_configs category (case-insensitive)
        const cockpitRepos = response.repositories.filter(repo => 
          repo.category?.toLowerCase() === 'cockpit_configs' && repo.is_active
        )
        
        setGitRepos(cockpitRepos)
      }
    } catch (error) {
      console.error('Error loading git repositories:', error)
      showMessage('Failed to load git repositories', 'error')
    }
  }, [apiCall, showMessage])

  const loadRepoFiles = useCallback(async (repoId: number) => {
    try {
      const response = await apiCall(`git/${repoId}/files/search?query=&limit=5000`) as {
        success?: boolean
        data?: {
          files: Array<{name: string; path: string; directory: string}>
          total_count?: number
          has_more?: boolean
        }
      }
      
      if (response.success && response.data?.files) {
        setRepoFiles(response.data.files)
        
        if (response.data.has_more) {
          showMessage(`Warning: Repository has more than ${response.data.files.length} files. Only showing first ${response.data.files.length}. Use the filter to narrow results.`, 'error')
        }
      }
    } catch (error) {
      console.error('Error loading repository files:', error)
      showMessage('Failed to load repository files', 'error')
    }
  }, [apiCall, showMessage])

  const checkRepoStatus = useCallback(async (repoId: number) => {
    try {
      setImportLoading(true)
      
      // First check if repo has been synced before
      const repoInfo = gitRepos.find(r => r.id === repoId)
      const hasBeenSynced = repoInfo && 'last_sync' in repoInfo && (repoInfo.last_sync as string | null) !== null
      
      if (!hasBeenSynced) {
        // Repo never synced, needs initial clone
        setRepoStatus({ ahead_count: 0, behind_count: 1, is_clean: true })
        setImportStep('check-sync')
        setImportLoading(false)
        return
      }
      
      const response = await apiCall(`git/${repoId}/status`) as {
        success?: boolean
        data?: {ahead_count: number; behind_count: number; is_clean: boolean; is_synced: boolean}
      }
      
      if (response.success && response.data) {
        setRepoStatus(response.data)
        
        // If repo is behind, stay on sync check step
        if (response.data.behind_count > 0) {
          setImportStep('check-sync')
        } else {
          // Load files if already synced
          await loadRepoFiles(repoId)
          setImportStep('select-file')
        }
      }
    } catch (error) {
      console.error('Error checking repo status:', error)
      // If status check fails, it likely means repo doesn't exist locally
      setRepoStatus({ ahead_count: 0, behind_count: 1, is_clean: true })
      setImportStep('check-sync')
    } finally {
      setImportLoading(false)
    }
  }, [apiCall, gitRepos, loadRepoFiles])

  const syncRepo = useCallback(async (repoId: number) => {
    try {
      setImportLoading(true)
      const response = await apiCall(`git/${repoId}/sync`, {
        method: 'POST',
      }) as { success?: boolean; message?: string }
      
      if (response.success) {
        showMessage('Repository synced successfully', 'success')
        // Reload status and files
        await checkRepoStatus(repoId)
      } else {
        showMessage(response.message || 'Failed to sync repository', 'error')
      }
    } catch (error) {
      console.error('Error syncing repository:', error)
      showMessage('Failed to sync repository', 'error')
    } finally {
      setImportLoading(false)
    }
  }, [apiCall, showMessage, checkRepoStatus])

  const importFileFromGit = useCallback(async () => {
    if (!selectedRepoId || !selectedFile) return
    
    try {
      setImportLoading(true)
      
      // Get auth token
      const token = useAuthStore.getState().token
      if (!token) {
        showMessage('Not authenticated', 'error')
        return
      }
      
      // Read file content directly from git repo using the file-content endpoint
      const fileResponse = await fetch(`/api/proxy/git/${selectedRepoId}/file-content?path=${encodeURIComponent(selectedFile)}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      
      if (!fileResponse.ok) {
        const errorText = await fileResponse.text()
        console.error('Failed to read file:', errorText)
        showMessage('Failed to read file content from repository', 'error')
        return
      }
      
      const fileContent = await fileResponse.text()
      
      // Check if content is double-encoded JSON string
      let processedContent = fileContent
      try {
        // If content starts with a quote, it might be a JSON string
        if (fileContent.startsWith('"') && fileContent.endsWith('"')) {
          processedContent = JSON.parse(fileContent)
        }
      } catch {
        // Not JSON, use as-is
      }
      
      // Load content into the editor
      setSnmpMappingYaml(processedContent)
      
      // Close dialog
      setShowImportDialog(false)
      
      // Reset state
      setSelectedRepoId(null)
      setSelectedFile(null)
      setFileFilter('')
      setRepoStatus(null)
      setRepoFiles([])
      setImportStep('select-repo')
      
      showMessage(`File "${selectedFile}" imported successfully. Click "Save Mapping" to persist changes.`, 'success')
    } catch {
      console.error('Error importing file from repository')
      showMessage('Failed to import file from repository', 'error')
    } finally {
      setImportLoading(false)
    }
  }, [selectedRepoId, selectedFile, showMessage])

  const handleOpenImportDialog = useCallback(async () => {
    setShowImportDialog(true)
    setImportStep('select-repo')
    await loadGitRepos()
  }, [loadGitRepos])

  const handleRepoSelect = useCallback(async (repoId: number) => {
    setSelectedRepoId(repoId)
    await checkRepoStatus(repoId)
  }, [checkRepoStatus])

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

      {/* SNMP Help Dialog */}
      <Dialog open={showHelpDialog} onOpenChange={setShowHelpDialog}>
        <DialogContent className="max-w-[54rem] !max-w-[54rem] w-[85vw] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <HelpCircle className="h-5 w-5 text-blue-600" />
              <span>SNMP Mapping Configuration Help</span>
            </DialogTitle>
            <DialogDescription>
              Examples and guidelines for configuring SNMP credentials
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-gray-900">Overview</h3>
              <p className="text-sm text-gray-600">
                The SNMP mapping configuration defines credentials for accessing network devices via SNMP.
                Each entry is identified by a unique ID and contains authentication details based on the SNMP version.
              </p>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-900">Configuration Examples</h3>

              {/* Example 1: SNMPv3 with Auth and Privacy */}
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-blue-700">Example 1: SNMPv3 with Authentication and Privacy</h4>
                <p className="text-xs text-gray-600">
                  Most secure option - requires both authentication and encryption
                </p>
                <pre className="bg-gray-50 border border-gray-200 rounded-md p-3 text-xs font-mono overflow-x-auto">
{`snmp-id-1:
  version: v3
  type: v3_auth_privacy
  username: snmp_username
  group: snmp_group
  auth_protocol_long: SHA-2-256
  auth_protocol: SHA-2-256
  auth_password: snmp_password
  privacy_protocol_long: AES-256
  privacy_protocol: AES
  privacy_password: snmp_password
  privacy_option: 256`}
                </pre>
                <ul className="text-xs text-gray-600 list-disc list-inside space-y-1">
                  <li><code className="bg-gray-100 px-1 rounded">version: v3</code> - Uses SNMP version 3</li>
                  <li><code className="bg-gray-100 px-1 rounded">type: v3_auth_privacy</code> - Requires both authentication and privacy (encryption)</li>
                  <li><code className="bg-gray-100 px-1 rounded">auth_protocol</code> - Authentication algorithm (SHA-2-256, MD5, etc.)</li>
                  <li><code className="bg-gray-100 px-1 rounded">privacy_protocol</code> - Encryption algorithm (AES, DES, etc.)</li>
                  <li><code className="bg-gray-100 px-1 rounded">privacy_option</code> - Key size for encryption (128, 192, 256)</li>
                </ul>
              </div>

              {/* Example 2: SNMPv3 with Auth only */}
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-blue-700">Example 2: SNMPv3 with Authentication Only</h4>
                <p className="text-xs text-gray-600">
                  Provides authentication without encryption - less secure than auth_privacy
                </p>
                <pre className="bg-gray-50 border border-gray-200 rounded-md p-3 text-xs font-mono overflow-x-auto">
{`snmp-id-2:
  version: v3
  type: v3_auth_no_privacy
  username: snmp_username
  group: snmp_group
  auth_protocol_long: MD5-96
  auth_protocol: MD5
  auth_password: snmp_password`}
                </pre>
                <ul className="text-xs text-gray-600 list-disc list-inside space-y-1">
                  <li><code className="bg-gray-100 px-1 rounded">type: v3_auth_no_privacy</code> - Authentication only, no encryption</li>
                  <li>Privacy-related fields are omitted as encryption is not used</li>
                  <li>More secure than SNMPv2c but less secure than v3_auth_privacy</li>
                </ul>
              </div>

              {/* Example 3: SNMPv2c */}
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-blue-700">Example 3: SNMPv2c with Community String</h4>
                <p className="text-xs text-gray-600">
                  Legacy version - simple community-based authentication only
                </p>
                <pre className="bg-gray-50 border border-gray-200 rounded-md p-3 text-xs font-mono overflow-x-auto">
{`snmp-id-3:
  version: v2
  community: snmp_community`}
                </pre>
                <ul className="text-xs text-gray-600 list-disc list-inside space-y-1">
                  <li><code className="bg-gray-100 px-1 rounded">version: v2</code> - Uses SNMP version 2c</li>
                  <li><code className="bg-gray-100 px-1 rounded">community</code> - Community string (acts as password)</li>
                  <li>Simplest configuration but least secure - no encryption or strong authentication</li>
                  <li>Recommended only for legacy devices or isolated networks</li>
                </ul>
              </div>
            </div>

            <div className="space-y-2 border-t pt-4">
              <h3 className="text-sm font-semibold text-gray-900">Best Practices</h3>
              <ul className="text-sm text-gray-600 list-disc list-inside space-y-1">
                <li>Use SNMPv3 with auth_privacy whenever possible for maximum security</li>
                <li>Use strong, unique passwords for auth_password and privacy_password</li>
                <li>Each SNMP ID should have a unique identifier (e.g., snmp-id-1, snmp-id-2)</li>
                <li>Maintain consistent indentation (2 spaces) throughout the YAML file</li>
                <li>Test your configuration using the &quot;Check YAML&quot; button before saving</li>
              </ul>
            </div>
          </div>

          <DialogFooter>
            <Button onClick={() => setShowHelpDialog(false)}>Close</Button>
          </DialogFooter>
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
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center space-x-2 text-sm font-medium">
                  <Network className="h-4 w-4" />
                  <span>SNMP Mapping Configuration (snmp_mapping.yaml)</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowHelpDialog(true)}
                  className="h-7 w-7 p-0 text-white hover:bg-white/20 hover:text-white"
                  title="Show help and examples"
                >
                  <HelpCircle className="h-4 w-4" />
                </Button>
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
                  onClick={handleOpenImportDialog}
                  disabled={yamlLoading || validating}
                  className="flex items-center space-x-2"
                >
                  <Download className="h-4 w-4" />
                  <span>Import from Git</span>
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

      {/* Import from Git Dialog */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Download className="h-5 w-5" />
              <span>Import SNMP Mapping from Git</span>
            </DialogTitle>
            <DialogDescription>
              {importStep === 'select-repo' && 'Select a Cockpit Configs repository to import from'}
              {importStep === 'check-sync' && 'Check repository synchronization status'}
              {importStep === 'select-file' && 'Select a file to import'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Step 1: Select Repository */}
            {importStep === 'select-repo' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Cockpit Configs Repository</Label>
                  {gitRepos.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No Cockpit Configs repositories found. Please add a repository with category &quot;Cockpit Configs&quot; first.
                    </p>
                  ) : (
                    <Select
                      value={selectedRepoId?.toString()}
                      onValueChange={(value) => handleRepoSelect(parseInt(value))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a repository" />
                      </SelectTrigger>
                      <SelectContent>
                        {gitRepos.map((repo) => (
                          <SelectItem key={repo.id} value={repo.id.toString()}>
                            {repo.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>
            )}

            {/* Step 2: Check Sync Status */}
            {importStep === 'check-sync' && repoStatus && (
              <div className="space-y-4">
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="flex items-start space-x-3">
                    <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
                    <div className="flex-1">
                      <h4 className="font-semibold text-yellow-900">Repository Not Synced</h4>
                      <p className="text-sm text-yellow-800 mt-1">
                        This repository is {repoStatus.behind_count} commit(s) behind the remote.
                        Please sync the repository to get the latest files.
                      </p>
                      <Button
                        onClick={() => selectedRepoId && syncRepo(selectedRepoId)}
                        disabled={importLoading}
                        className="mt-3 flex items-center space-x-2"
                      >
                        {importLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <GitPullRequest className="h-4 w-4" />
                        )}
                        <span>Sync Repository (Git Pull)</span>
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Select File */}
            {importStep === 'select-file' && (
              <div className="space-y-4">
                {repoStatus && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <div className="flex items-center space-x-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span className="text-sm text-green-800">
                        Repository is up to date
                      </span>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Select File to Import</Label>
                  {repoFiles.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No files found in this repository.
                    </p>
                  ) : (
                    <>
                      <Input
                        type="text"
                        placeholder="Filter files..."
                        value={fileFilter}
                        onChange={(e) => setFileFilter(e.target.value)}
                        className="mb-2"
                      />
                      <Select
                        value={selectedFile || ''}
                        onValueChange={setSelectedFile}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select a file" />
                        </SelectTrigger>
                        <SelectContent className="max-h-[300px]">
                          {repoFiles
                            .filter(file => 
                              fileFilter === '' || 
                              file.path.toLowerCase().includes(fileFilter.toLowerCase())
                            )
                            .map((file) => (
                            <SelectItem key={file.path} value={file.path}>
                              <div className="flex items-center space-x-2">
                                <FileText className="h-4 w-4" />
                                <span>{file.path}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {fileFilter && (
                        <p className="text-xs text-muted-foreground">
                          Showing {repoFiles.filter(file => file.path.toLowerCase().includes(fileFilter.toLowerCase())).length} of {repoFiles.length} files
                        </p>
                      )}
                    </>
                  )}
                  <p className="text-xs text-muted-foreground">
                    The selected file content will be loaded into the editor.
                    You must click &quot;Save Mapping&quot; to persist the changes.
                  </p>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowImportDialog(false)
                setSelectedRepoId(null)
                setSelectedFile(null)
                setFileFilter('')
                setRepoStatus(null)
                setRepoFiles([])
                setImportStep('select-repo')
              }}
            >
              Cancel
            </Button>
            {importStep === 'select-file' && selectedFile && (
              <Button
                onClick={importFileFromGit}
                disabled={importLoading || !selectedFile}
                className="flex items-center space-x-2"
              >
                {importLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                <span>Import File</span>
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
