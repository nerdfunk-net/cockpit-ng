'use client'

import { useState, useCallback, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { useApi } from '@/hooks/use-api'
import { useToast } from '@/hooks/use-toast'
import {
  Loader2,
  CheckCircle,
  XCircle,
  Plus,
  Trash2,
  Edit,
  FileText,
  Key,
  Network,
  Download,
} from 'lucide-react'

// Hooks
import { useRegexPatternsQuery } from './hooks/use-regex-patterns-query'
import { useRegexPatternsMutations } from './hooks/use-regex-patterns-mutations'
import { useLoginCredentialsQuery } from './hooks/use-login-credentials-query'
import { useLoginCredentialsMutations } from './hooks/use-login-credentials-mutations'
import { useSnmpMappingsQuery } from './hooks/use-snmp-mappings-query'
import { useSnmpMappingsMutations } from './hooks/use-snmp-mappings-mutations'

// Dialogs
import { RegexPatternDialog } from './dialogs/regex-pattern-dialog'
import { LoginCredentialDialog } from './dialogs/login-credential-dialog'
import { SNMPMappingDialog } from './dialogs/snmp-mapping-dialog'
import { SNMPImportDialog } from './dialogs/snmp-import-dialog'

// Types and constants
import type {
  RegexPattern,
  LoginCredential,
  SNMPMapping,
  RegexPatternFormData,
  LoginCredentialFormData,
  SNMPMappingFormData,
} from './types'
import {
  DEFAULT_REGEX_FORM,
  DEFAULT_LOGIN_FORM,
  DEFAULT_SNMP_FORM,
  EMPTY_REGEX_PATTERNS,
  EMPTY_LOGIN_CREDENTIALS,
  EMPTY_SNMP_MAPPINGS,
} from './utils/constants'

export default function ComplianceSettingsForm() {
  const { apiCall } = useApi()
  const { toast } = useToast()
  const [activeTab, setActiveTab] = useState('configs')

  // ============================================================================
  // Query Hooks (TanStack Query - automatic caching and refetching)
  // ============================================================================

  const {
    data: regexPatterns = EMPTY_REGEX_PATTERNS,
    isLoading: regexPatternsLoading,
  } = useRegexPatternsQuery({ enabled: activeTab === 'configs' })

  const {
    data: loginCredentials = EMPTY_LOGIN_CREDENTIALS,
    isLoading: loginCredentialsLoading,
  } = useLoginCredentialsQuery({ enabled: activeTab === 'logins' })

  const {
    data: snmpMappings = EMPTY_SNMP_MAPPINGS,
    isLoading: snmpMappingsLoading,
  } = useSnmpMappingsQuery({ enabled: activeTab === 'snmp' })

  // ============================================================================
  // Mutation Hooks (TanStack Query - automatic cache invalidation)
  // ============================================================================

  const { createPattern, updatePattern, deletePattern } =
    useRegexPatternsMutations()
  const { createCredential, updateCredential, deleteCredential } =
    useLoginCredentialsMutations()
  const { createMapping, updateMapping, deleteMapping, importFromYaml } =
    useSnmpMappingsMutations()

  // ============================================================================
  // Regex Patterns State and Handlers
  // ============================================================================

  const [showRegexDialog, setShowRegexDialog] = useState(false)
  const [editingRegex, setEditingRegex] = useState<RegexPattern | null>(null)
  const [regexForm, setRegexForm] =
    useState<RegexPatternFormData>(DEFAULT_REGEX_FORM)

  const handleAddRegex = useCallback(
    (patternType: 'must_match' | 'must_not_match') => {
      setEditingRegex(null)
      setRegexForm({ ...DEFAULT_REGEX_FORM, pattern_type: patternType })
      setShowRegexDialog(true)
    },
    []
  )

  const handleEditRegex = useCallback((pattern: RegexPattern) => {
    setEditingRegex(pattern)
    setRegexForm({
      pattern: pattern.pattern,
      description: pattern.description || '',
      pattern_type: pattern.pattern_type,
    })
    setShowRegexDialog(true)
  }, [])

  const handleSaveRegex = useCallback(async () => {
    if (editingRegex) {
      await updatePattern.mutateAsync({ id: editingRegex.id, data: regexForm })
    } else {
      await createPattern.mutateAsync(regexForm)
    }
    setShowRegexDialog(false)
  }, [editingRegex, regexForm, updatePattern, createPattern])

  const handleDeleteRegex = useCallback(
    async (id: number) => {
      if (!confirm('Are you sure you want to delete this regex pattern?')) return
      await deletePattern.mutateAsync(id)
    },
    [deletePattern]
  )

  // ============================================================================
  // Login Credentials State and Handlers
  // ============================================================================

  const [showLoginDialog, setShowLoginDialog] = useState(false)
  const [editingLogin, setEditingLogin] = useState<LoginCredential | null>(null)
  const [loginForm, setLoginForm] =
    useState<LoginCredentialFormData>(DEFAULT_LOGIN_FORM)

  const handleAddLogin = useCallback(() => {
    setEditingLogin(null)
    setLoginForm(DEFAULT_LOGIN_FORM)
    setShowLoginDialog(true)
  }, [])

  const handleEditLogin = useCallback((credential: LoginCredential) => {
    setEditingLogin(credential)
    setLoginForm({
      name: credential.name || '',
      username: credential.username,
      password: '', // Don't pre-fill password
      description: credential.description || '',
    })
    setShowLoginDialog(true)
  }, [])

  const handleSaveLogin = useCallback(async () => {
    if (editingLogin) {
      await updateCredential.mutateAsync({
        id: editingLogin.id,
        data: loginForm,
      })
    } else {
      await createCredential.mutateAsync(loginForm)
    }
    setShowLoginDialog(false)
  }, [editingLogin, loginForm, updateCredential, createCredential])

  const handleDeleteLogin = useCallback(
    async (id: number) => {
      if (!confirm('Are you sure you want to delete this login credential?'))
        return
      await deleteCredential.mutateAsync(id)
    },
    [deleteCredential]
  )

  // ============================================================================
  // SNMP Mappings State and Handlers
  // ============================================================================

  const [showSnmpDialog, setShowSnmpDialog] = useState(false)
  const [editingSnmp, setEditingSnmp] = useState<SNMPMapping | null>(null)
  const [snmpForm, setSnmpForm] =
    useState<SNMPMappingFormData>(DEFAULT_SNMP_FORM)
  const [showImportDialog, setShowImportDialog] = useState(false)
  const [isImporting, setIsImporting] = useState(false)

  const handleAddSnmp = useCallback(() => {
    setEditingSnmp(null)
    setSnmpForm(DEFAULT_SNMP_FORM)
    setShowSnmpDialog(true)
  }, [])

  const handleEditSnmp = useCallback((mapping: SNMPMapping) => {
    setEditingSnmp(mapping)
    setSnmpForm({
      name: mapping.name || '',
      snmp_version: mapping.snmp_version,
      snmp_community: mapping.snmp_community || '',
      snmp_v3_user: mapping.snmp_v3_user || '',
      snmp_v3_auth_protocol: mapping.snmp_v3_auth_protocol || 'SHA',
      snmp_v3_auth_password: '', // Don't pre-fill password
      snmp_v3_priv_protocol: mapping.snmp_v3_priv_protocol || 'AES',
      snmp_v3_priv_password: '', // Don't pre-fill password
      description: mapping.description || '',
    })
    setShowSnmpDialog(true)
  }, [])

  const handleSaveSnmp = useCallback(async () => {
    if (editingSnmp) {
      await updateMapping.mutateAsync({ id: editingSnmp.id, data: snmpForm })
    } else {
      await createMapping.mutateAsync(snmpForm)
    }
    setShowSnmpDialog(false)
  }, [editingSnmp, snmpForm, updateMapping, createMapping])

  const handleDeleteSnmp = useCallback(
    async (id: number) => {
      if (!confirm('Are you sure you want to delete this SNMP mapping?')) return
      await deleteMapping.mutateAsync(id)
    },
    [deleteMapping]
  )

  const handleImportFromCheckMK = useCallback(async () => {
    try {
      setIsImporting(true)
      // Load the CheckMK SNMP mapping YAML file
      const yamlResponse = (await apiCall('config/snmp_mapping.yaml')) as {
        success?: boolean
        data?: string
      }

      if (!yamlResponse.success || !yamlResponse.data) {
        toast({
          title: 'Error',
          description: 'Failed to load CheckMK SNMP mapping file',
          variant: 'destructive',
        })
        return
      }

      // Import using mutation hook
      await importFromYaml.mutateAsync(yamlResponse.data)
    } catch {
      toast({
        title: 'Error',
        description: 'Error importing from CheckMK',
        variant: 'destructive',
      })
    } finally {
      setIsImporting(false)
    }
  }, [apiCall, toast, importFromYaml])

  const handleImportFromYAML = useCallback(() => {
    setShowImportDialog(true)
  }, [])

  const handleImportFile = useCallback(
    async (file: File) => {
      try {
        setIsImporting(true)
        const fileContent = await file.text()
        await importFromYaml.mutateAsync(fileContent)
        setShowImportDialog(false)
      } catch {
        toast({
          title: 'Error',
          description: 'Error importing YAML file',
          variant: 'destructive',
        })
      } finally {
        setIsImporting(false)
      }
    },
    [importFromYaml, toast]
  )

  // ============================================================================
  // Split patterns by type for display
  // ============================================================================

  const mustMatchPatterns = useMemo(
    () => regexPatterns.filter((p) => p.pattern_type === 'must_match'),
    [regexPatterns]
  )

  const mustNotMatchPatterns = useMemo(
    () => regexPatterns.filter((p) => p.pattern_type === 'must_not_match'),
    [regexPatterns]
  )

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="bg-green-100 p-2 rounded-lg">
            <CheckCircle className="h-6 w-6 text-green-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Compliance Settings</h1>
            <p className="text-muted-foreground">
              Configure compliance check rules and credentials
            </p>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="configs" className="flex items-center space-x-2">
            <FileText className="h-4 w-4" />
            <span>Configs</span>
          </TabsTrigger>
          <TabsTrigger value="logins" className="flex items-center space-x-2">
            <Key className="h-4 w-4" />
            <span>Logins</span>
          </TabsTrigger>
          <TabsTrigger value="snmp" className="flex items-center space-x-2">
            <Network className="h-4 w-4" />
            <span>SNMP</span>
          </TabsTrigger>
        </TabsList>

        {/* Configs Tab */}
        <TabsContent value="configs" className="space-y-6">
          {/* Must Match Patterns */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    Must Match
                  </CardTitle>
                  <CardDescription>
                    Regular expressions that must match in device configurations
                  </CardDescription>
                </div>
                <Button onClick={() => handleAddRegex('must_match')}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Pattern
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {regexPatternsLoading && mustMatchPatterns.length === 0 ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : mustMatchPatterns.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No patterns configured
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Pattern</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mustMatchPatterns.map((pattern) => (
                      <TableRow key={pattern.id}>
                        <TableCell className="font-mono text-sm">
                          {pattern.pattern}
                        </TableCell>
                        <TableCell>{pattern.description || '-'}</TableCell>
                        <TableCell>
                          <Badge
                            variant={pattern.is_active ? 'default' : 'secondary'}
                          >
                            {pattern.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditRegex(pattern)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteRegex(pattern.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Must NOT Match Patterns */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <XCircle className="h-5 w-5 text-red-600" />
                    Must Not Match
                  </CardTitle>
                  <CardDescription>
                    Regular expressions that must NOT match in device
                    configurations
                  </CardDescription>
                </div>
                <Button onClick={() => handleAddRegex('must_not_match')}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Pattern
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {regexPatternsLoading && mustNotMatchPatterns.length === 0 ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : mustNotMatchPatterns.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No patterns configured
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Pattern</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mustNotMatchPatterns.map((pattern) => (
                      <TableRow key={pattern.id}>
                        <TableCell className="font-mono text-sm">
                          {pattern.pattern}
                        </TableCell>
                        <TableCell>{pattern.description || '-'}</TableCell>
                        <TableCell>
                          <Badge
                            variant={pattern.is_active ? 'default' : 'secondary'}
                          >
                            {pattern.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditRegex(pattern)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteRegex(pattern.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Logins Tab */}
        <TabsContent value="logins">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Login Credentials</CardTitle>
                  <CardDescription>
                    Username and password combinations for compliance checks
                  </CardDescription>
                </div>
                <Button onClick={handleAddLogin}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Credential
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loginCredentialsLoading && loginCredentials.length === 0 ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : loginCredentials.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No credentials configured
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Username</TableHead>
                      <TableHead>Password</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loginCredentials.map((credential) => (
                      <TableRow key={credential.id}>
                        <TableCell className="font-medium">
                          {credential.name || credential.username}
                        </TableCell>
                        <TableCell>{credential.username}</TableCell>
                        <TableCell className="font-mono text-sm">
                          {credential.password}
                        </TableCell>
                        <TableCell>{credential.description || '-'}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              credential.is_active ? 'default' : 'secondary'
                            }
                          >
                            {credential.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditLogin(credential)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteLogin(credential.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* SNMP Tab */}
        <TabsContent value="snmp">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>SNMP Credentials</CardTitle>
                  <CardDescription>
                    Configure SNMP credentials for compliance checks
                    (device-type independent)
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={handleImportFromCheckMK}
                    disabled={isImporting}
                  >
                    {isImporting ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4 mr-2" />
                    )}
                    Import from CheckMK
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleImportFromYAML}
                    disabled={isImporting}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Import from YAML
                  </Button>
                  <Button onClick={handleAddSnmp}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Mapping
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {snmpMappingsLoading && snmpMappings.length === 0 ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : snmpMappings.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No SNMP mappings configured
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>SNMP Version</TableHead>
                      <TableHead>Community/User</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {snmpMappings.map((mapping) => (
                      <TableRow key={mapping.id}>
                        <TableCell className="font-medium">
                          {mapping.name}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{mapping.snmp_version}</Badge>
                        </TableCell>
                        <TableCell>
                          {mapping.snmp_version === 'v3'
                            ? mapping.snmp_v3_user
                            : mapping.snmp_community}
                        </TableCell>
                        <TableCell>{mapping.description || '-'}</TableCell>
                        <TableCell>
                          <Badge
                            variant={mapping.is_active ? 'default' : 'secondary'}
                          >
                            {mapping.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditSnmp(mapping)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteSnmp(mapping.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <RegexPatternDialog
        open={showRegexDialog}
        onOpenChange={setShowRegexDialog}
        pattern={editingRegex}
        formData={regexForm}
        onFormChange={setRegexForm}
        onSave={handleSaveRegex}
        isSaving={
          editingRegex ? updatePattern.isPending : createPattern.isPending
        }
      />

      <LoginCredentialDialog
        open={showLoginDialog}
        onOpenChange={setShowLoginDialog}
        credential={editingLogin}
        formData={loginForm}
        onFormChange={setLoginForm}
        onSave={handleSaveLogin}
        isSaving={
          editingLogin ? updateCredential.isPending : createCredential.isPending
        }
      />

      <SNMPMappingDialog
        open={showSnmpDialog}
        onOpenChange={setShowSnmpDialog}
        mapping={editingSnmp}
        formData={snmpForm}
        onFormChange={setSnmpForm}
        onSave={handleSaveSnmp}
        isSaving={
          editingSnmp ? updateMapping.isPending : createMapping.isPending
        }
      />

      <SNMPImportDialog
        open={showImportDialog}
        onOpenChange={setShowImportDialog}
        onImport={handleImportFile}
        isImporting={isImporting}
      />
    </div>
  )
}
