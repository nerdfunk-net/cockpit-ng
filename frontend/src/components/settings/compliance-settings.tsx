'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
import { cn } from '@/lib/utils'
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
} from 'lucide-react'

const EMPTY_ARRAY: never[] = []

interface ApiResponse<T> {
  success: boolean
  data?: T
}

interface RegexPattern {
  id: number
  pattern: string
  description?: string
  pattern_type: 'must_match' | 'must_not_match'
  is_active: boolean
  created_at: string
  updated_at: string
}

interface LoginCredential {
  id: number
  username: string
  password: string
  description?: string
  is_active: boolean
  created_at: string
  updated_at: string
}

interface SNMPMapping {
  id: number
  device_type: string
  snmp_version: 'v1' | 'v2c' | 'v3'
  snmp_community?: string
  snmp_v3_user?: string
  snmp_v3_auth_protocol?: string
  snmp_v3_auth_password?: string
  snmp_v3_priv_protocol?: string
  snmp_v3_priv_password?: string
  description?: string
  is_active: boolean
  created_at: string
  updated_at: string
}

type StatusType = 'idle' | 'loading' | 'success' | 'error'

export default function ComplianceSettingsForm() {
  const { apiCall } = useApi()
  const [activeTab, setActiveTab] = useState('configs')
  const [status, setStatus] = useState<StatusType>('idle')
  const [message, setMessage] = useState('')

  // Regex Patterns state
  const [regexPatterns, setRegexPatterns] = useState<RegexPattern[]>(EMPTY_ARRAY)
  const [showRegexDialog, setShowRegexDialog] = useState(false)
  const [editingRegex, setEditingRegex] = useState<RegexPattern | null>(null)
  const [regexForm, setRegexForm] = useState({
    pattern: '',
    description: '',
    pattern_type: 'must_match' as 'must_match' | 'must_not_match',
  })

  // Login Credentials state
  const [loginCredentials, setLoginCredentials] = useState<LoginCredential[]>(EMPTY_ARRAY)
  const [showLoginDialog, setShowLoginDialog] = useState(false)
  const [editingLogin, setEditingLogin] = useState<LoginCredential | null>(null)
  const [loginForm, setLoginForm] = useState({
    username: '',
    password: '',
    description: '',
  })

  // SNMP Mapping state
  const [snmpMappings, setSnmpMappings] = useState<SNMPMapping[]>(EMPTY_ARRAY)
  const [showSnmpDialog, setShowSnmpDialog] = useState(false)
  const [editingSnmp, setEditingSnmp] = useState<SNMPMapping | null>(null)
  const [snmpForm, setSnmpForm] = useState({
    device_type: '',
    snmp_version: 'v2c' as 'v1' | 'v2c' | 'v3',
    snmp_community: '',
    snmp_v3_user: '',
    snmp_v3_auth_protocol: 'SHA',
    snmp_v3_auth_password: '',
    snmp_v3_priv_protocol: 'AES',
    snmp_v3_priv_password: '',
    description: '',
  })

  const showMessage = useCallback((msg: string, type: 'success' | 'error') => {
    setMessage(msg)
    setStatus(type === 'success' ? 'success' : 'error')

    setTimeout(() => {
      setMessage('')
      setStatus('idle')
    }, 5000)
  }, [])

  // ============================================================================
  // Regex Patterns Functions
  // ============================================================================

  const loadRegexPatterns = useCallback(async () => {
    try {
      setStatus('loading')
      const response = await apiCall('settings/compliance/regex-patterns') as ApiResponse<RegexPattern[]>
      if (response?.success && response?.data) {
        setRegexPatterns(response.data)
      }
      setStatus('idle')
    } catch (error) {
      console.error('Error loading regex patterns:', error)
      showMessage('Failed to load regex patterns', 'error')
    }
  }, [apiCall, showMessage])

  const handleAddRegex = useCallback(() => {
    setEditingRegex(null)
    setRegexForm({ pattern: '', description: '', pattern_type: 'must_match' })
    setShowRegexDialog(true)
  }, [])

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
    try {
      setStatus('loading')
      if (editingRegex) {
        // Update
        await apiCall(`settings/compliance/regex-patterns/${editingRegex.id}`, {
          method: 'PUT',
          body: JSON.stringify(regexForm),
        })
        showMessage('Regex pattern updated successfully', 'success')
      } else {
        // Create
        await apiCall('settings/compliance/regex-patterns', {
          method: 'POST',
          body: JSON.stringify({ ...regexForm, is_active: true }),
        })
        showMessage('Regex pattern created successfully', 'success')
      }
      setShowRegexDialog(false)
      await loadRegexPatterns()
    } catch (error) {
      console.error('Error saving regex pattern:', error)
      showMessage('Failed to save regex pattern', 'error')
    }
  }, [apiCall, editingRegex, regexForm, showMessage, loadRegexPatterns])

  const handleDeleteRegex = useCallback(
    async (id: number) => {
      if (!confirm('Are you sure you want to delete this regex pattern?')) return

      try {
        setStatus('loading')
        await apiCall(`settings/compliance/regex-patterns/${id}`, {
          method: 'DELETE',
        })
        showMessage('Regex pattern deleted successfully', 'success')
        await loadRegexPatterns()
      } catch (error) {
        console.error('Error deleting regex pattern:', error)
        showMessage('Failed to delete regex pattern', 'error')
      }
    },
    [apiCall, showMessage, loadRegexPatterns]
  )

  // ============================================================================
  // Login Credentials Functions
  // ============================================================================

  const loadLoginCredentials = useCallback(async () => {
    try {
      setStatus('loading')
      const response = await apiCall('settings/compliance/login-credentials') as ApiResponse<LoginCredential[]>
      if (response?.success && response?.data) {
        setLoginCredentials(response.data)
      }
      setStatus('idle')
    } catch (error) {
      console.error('Error loading login credentials:', error)
      showMessage('Failed to load login credentials', 'error')
    }
  }, [apiCall, showMessage])

  const handleAddLogin = useCallback(() => {
    setEditingLogin(null)
    setLoginForm({ username: '', password: '', description: '' })
    setShowLoginDialog(true)
  }, [])

  const handleEditLogin = useCallback((credential: LoginCredential) => {
    setEditingLogin(credential)
    setLoginForm({
      username: credential.username,
      password: '', // Don't pre-fill password
      description: credential.description || '',
    })
    setShowLoginDialog(true)
  }, [])

  const handleSaveLogin = useCallback(async () => {
    try {
      setStatus('loading')
      const payload = {
        ...loginForm,
        ...(editingLogin && !loginForm.password ? {} : { password: loginForm.password }),
      }

      if (editingLogin) {
        // Update
        await apiCall(`settings/compliance/login-credentials/${editingLogin.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        })
        showMessage('Login credential updated successfully', 'success')
      } else {
        // Create
        await apiCall('settings/compliance/login-credentials', {
          method: 'POST',
          body: JSON.stringify({ ...payload, is_active: true }),
        })
        showMessage('Login credential created successfully', 'success')
      }
      setShowLoginDialog(false)
      await loadLoginCredentials()
    } catch (error) {
      console.error('Error saving login credential:', error)
      showMessage('Failed to save login credential', 'error')
    }
  }, [apiCall, editingLogin, loginForm, showMessage, loadLoginCredentials])

  const handleDeleteLogin = useCallback(
    async (id: number) => {
      if (!confirm('Are you sure you want to delete this login credential?')) return

      try {
        setStatus('loading')
        await apiCall(`settings/compliance/login-credentials/${id}`, {
          method: 'DELETE',
        })
        showMessage('Login credential deleted successfully', 'success')
        await loadLoginCredentials()
      } catch (error) {
        console.error('Error deleting login credential:', error)
        showMessage('Failed to delete login credential', 'error')
      }
    },
    [apiCall, showMessage, loadLoginCredentials]
  )

  // ============================================================================
  // SNMP Mapping Functions
  // ============================================================================

  const loadSnmpMappings = useCallback(async () => {
    try {
      setStatus('loading')
      const response = await apiCall('settings/compliance/snmp-mappings') as ApiResponse<SNMPMapping[]>
      if (response?.success && response?.data) {
        setSnmpMappings(response.data)
      }
      setStatus('idle')
    } catch (error) {
      console.error('Error loading SNMP mappings:', error)
      showMessage('Failed to load SNMP mappings', 'error')
    }
  }, [apiCall, showMessage])

  const handleAddSnmp = useCallback(() => {
    setEditingSnmp(null)
    setSnmpForm({
      device_type: '',
      snmp_version: 'v2c',
      snmp_community: '',
      snmp_v3_user: '',
      snmp_v3_auth_protocol: 'SHA',
      snmp_v3_auth_password: '',
      snmp_v3_priv_protocol: 'AES',
      snmp_v3_priv_password: '',
      description: '',
    })
    setShowSnmpDialog(true)
  }, [])

  const handleEditSnmp = useCallback((mapping: SNMPMapping) => {
    setEditingSnmp(mapping)
    setSnmpForm({
      device_type: mapping.device_type,
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
    try {
      setStatus('loading')
      let payload: Partial<typeof snmpForm> = { ...snmpForm }

      // Remove empty password fields for update
      if (editingSnmp) {
        const { snmp_v3_auth_password, snmp_v3_priv_password, ...rest } = payload
        payload = {
          ...rest,
          ...(snmp_v3_auth_password ? { snmp_v3_auth_password } : {}),
          ...(snmp_v3_priv_password ? { snmp_v3_priv_password } : {}),
        }
      }

      if (editingSnmp) {
        // Update
        await apiCall(`settings/compliance/snmp-mappings/${editingSnmp.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        })
        showMessage('SNMP mapping updated successfully', 'success')
      } else {
        // Create
        await apiCall('settings/compliance/snmp-mappings', {
          method: 'POST',
          body: JSON.stringify({ ...payload, is_active: true }),
        })
        showMessage('SNMP mapping created successfully', 'success')
      }
      setShowSnmpDialog(false)
      await loadSnmpMappings()
    } catch (error) {
      console.error('Error saving SNMP mapping:', error)
      showMessage('Failed to save SNMP mapping', 'error')
    }
  }, [apiCall, editingSnmp, snmpForm, showMessage, loadSnmpMappings])

  const handleDeleteSnmp = useCallback(
    async (id: number) => {
      if (!confirm('Are you sure you want to delete this SNMP mapping?')) return

      try {
        setStatus('loading')
        await apiCall(`settings/compliance/snmp-mappings/${id}`, {
          method: 'DELETE',
        })
        showMessage('SNMP mapping deleted successfully', 'success')
        await loadSnmpMappings()
      } catch (error) {
        console.error('Error deleting SNMP mapping:', error)
        showMessage('Failed to delete SNMP mapping', 'error')
      }
    },
    [apiCall, showMessage, loadSnmpMappings]
  )

  // ============================================================================
  // Load data on mount and tab change
  // ============================================================================

  useEffect(() => {
    const loadData = async () => {
      if (activeTab === 'configs') {
        await loadRegexPatterns()
      } else if (activeTab === 'logins') {
        await loadLoginCredentials()
      } else if (activeTab === 'snmp') {
        await loadSnmpMappings()
      }
    }
    void loadData()
  }, [activeTab, loadRegexPatterns, loadLoginCredentials, loadSnmpMappings])

  // Split patterns by type
  const mustMatchPatterns = useMemo(
    () => regexPatterns.filter((p) => p.pattern_type === 'must_match'),
    [regexPatterns]
  )
  const mustNotMatchPatterns = useMemo(
    () => regexPatterns.filter((p) => p.pattern_type === 'must_not_match'),
    [regexPatterns]
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Compliance Settings</h1>
          <p className="text-muted-foreground">
            Configure compliance check rules and credentials
          </p>
        </div>
      </div>

      {message && (
        <div
          className={cn(
            'flex items-center gap-2 p-4 rounded-md',
            status === 'success'
              ? 'bg-green-50 text-green-800'
              : 'bg-red-50 text-red-800'
          )}
        >
          {status === 'success' ? (
            <CheckCircle className="h-5 w-5" />
          ) : (
            <XCircle className="h-5 w-5" />
          )}
          <span>{message}</span>
        </div>
      )}

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
                <Button onClick={() => {
                  setRegexForm(prev => ({ ...prev, pattern_type: 'must_match' }))
                  handleAddRegex()
                }}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Pattern
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {status === 'loading' && mustMatchPatterns.length === 0 ? (
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
                          <Badge variant={pattern.is_active ? 'default' : 'secondary'}>
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
                    Regular expressions that must NOT match in device configurations
                  </CardDescription>
                </div>
                <Button onClick={() => {
                  setRegexForm(prev => ({ ...prev, pattern_type: 'must_not_match' }))
                  handleAddRegex()
                }}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Pattern
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {status === 'loading' && mustNotMatchPatterns.length === 0 ? (
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
                          <Badge variant={pattern.is_active ? 'default' : 'secondary'}>
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
              {status === 'loading' && loginCredentials.length === 0 ? (
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
                          {credential.username}
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {credential.password}
                        </TableCell>
                        <TableCell>{credential.description || '-'}</TableCell>
                        <TableCell>
                          <Badge
                            variant={credential.is_active ? 'default' : 'secondary'}
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
                  <CardTitle>SNMP Mapping</CardTitle>
                  <CardDescription>
                    Map device types to SNMP credentials
                  </CardDescription>
                </div>
                <Button onClick={handleAddSnmp}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Mapping
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {status === 'loading' && snmpMappings.length === 0 ? (
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
                      <TableHead>Device Type</TableHead>
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
                          {mapping.device_type}
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
                          <Badge variant={mapping.is_active ? 'default' : 'secondary'}>
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

      {/* Regex Pattern Dialog */}
      <Dialog open={showRegexDialog} onOpenChange={setShowRegexDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingRegex ? 'Edit' : 'Add'} Regex Pattern
            </DialogTitle>
            <DialogDescription>
              Configure a regular expression pattern for compliance checking
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="pattern">Pattern *</Label>
              <Input
                id="pattern"
                value={regexForm.pattern}
                onChange={(e) =>
                  setRegexForm({ ...regexForm, pattern: e.target.value })
                }
                placeholder="^logging.*"
                className="font-mono"
              />
            </div>
            <div>
              <Label htmlFor="pattern-type">Type *</Label>
              <Select
                value={regexForm.pattern_type}
                onValueChange={(value: 'must_match' | 'must_not_match') =>
                  setRegexForm({ ...regexForm, pattern_type: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="must_match">Must Match</SelectItem>
                  <SelectItem value="must_not_match">Must Not Match</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="pattern-description">Description</Label>
              <Textarea
                id="pattern-description"
                value={regexForm.description}
                onChange={(e) =>
                  setRegexForm({ ...regexForm, description: e.target.value })
                }
                placeholder="Describe what this pattern checks for"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRegexDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveRegex}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Login Credential Dialog */}
      <Dialog open={showLoginDialog} onOpenChange={setShowLoginDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingLogin ? 'Edit' : 'Add'} Login Credential
            </DialogTitle>
            <DialogDescription>
              Configure a username and password for compliance checks
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="username">Username *</Label>
              <Input
                id="username"
                value={loginForm.username}
                onChange={(e) =>
                  setLoginForm({ ...loginForm, username: e.target.value })
                }
                placeholder="admin"
              />
            </div>
            <div>
              <Label htmlFor="password">
                Password * {editingLogin && '(leave empty to keep current)'}
              </Label>
              <Input
                id="password"
                type="password"
                value={loginForm.password}
                onChange={(e) =>
                  setLoginForm({ ...loginForm, password: e.target.value })
                }
                placeholder={editingLogin ? '(unchanged)' : 'Enter password'}
              />
            </div>
            <div>
              <Label htmlFor="login-description">Description</Label>
              <Textarea
                id="login-description"
                value={loginForm.description}
                onChange={(e) =>
                  setLoginForm({ ...loginForm, description: e.target.value })
                }
                placeholder="Describe this credential"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLoginDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveLogin}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* SNMP Mapping Dialog */}
      <Dialog open={showSnmpDialog} onOpenChange={setShowSnmpDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingSnmp ? 'Edit' : 'Add'} SNMP Mapping</DialogTitle>
            <DialogDescription>
              Map a device type to SNMP credentials
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="device-type">Device Type *</Label>
              <Input
                id="device-type"
                value={snmpForm.device_type}
                onChange={(e) =>
                  setSnmpForm({ ...snmpForm, device_type: e.target.value })
                }
                placeholder="cisco-ios, juniper-junos, etc."
              />
            </div>
            <div>
              <Label htmlFor="snmp-version">SNMP Version *</Label>
              <Select
                value={snmpForm.snmp_version}
                onValueChange={(value: 'v1' | 'v2c' | 'v3') =>
                  setSnmpForm({ ...snmpForm, snmp_version: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="v1">v1</SelectItem>
                  <SelectItem value="v2c">v2c</SelectItem>
                  <SelectItem value="v3">v3</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {(snmpForm.snmp_version === 'v1' || snmpForm.snmp_version === 'v2c') && (
              <div>
                <Label htmlFor="snmp-community">Community String *</Label>
                <Input
                  id="snmp-community"
                  type="password"
                  value={snmpForm.snmp_community}
                  onChange={(e) =>
                    setSnmpForm({ ...snmpForm, snmp_community: e.target.value })
                  }
                  placeholder="public"
                />
              </div>
            )}

            {snmpForm.snmp_version === 'v3' && (
              <>
                <div>
                  <Label htmlFor="snmp-v3-user">SNMPv3 User *</Label>
                  <Input
                    id="snmp-v3-user"
                    value={snmpForm.snmp_v3_user}
                    onChange={(e) =>
                      setSnmpForm({ ...snmpForm, snmp_v3_user: e.target.value })
                    }
                    placeholder="snmpuser"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="auth-protocol">Auth Protocol</Label>
                    <Select
                      value={snmpForm.snmp_v3_auth_protocol}
                      onValueChange={(value) =>
                        setSnmpForm({ ...snmpForm, snmp_v3_auth_protocol: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="MD5">MD5</SelectItem>
                        <SelectItem value="SHA">SHA</SelectItem>
                        <SelectItem value="SHA-224">SHA-224</SelectItem>
                        <SelectItem value="SHA-256">SHA-256</SelectItem>
                        <SelectItem value="SHA-384">SHA-384</SelectItem>
                        <SelectItem value="SHA-512">SHA-512</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="auth-password">Auth Password</Label>
                    <Input
                      id="auth-password"
                      type="password"
                      value={snmpForm.snmp_v3_auth_password}
                      onChange={(e) =>
                        setSnmpForm({
                          ...snmpForm,
                          snmp_v3_auth_password: e.target.value,
                        })
                      }
                      placeholder={editingSnmp ? '(unchanged)' : ''}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="priv-protocol">Priv Protocol</Label>
                    <Select
                      value={snmpForm.snmp_v3_priv_protocol}
                      onValueChange={(value) =>
                        setSnmpForm({ ...snmpForm, snmp_v3_priv_protocol: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="DES">DES</SelectItem>
                        <SelectItem value="AES">AES</SelectItem>
                        <SelectItem value="AES-192">AES-192</SelectItem>
                        <SelectItem value="AES-256">AES-256</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="priv-password">Priv Password</Label>
                    <Input
                      id="priv-password"
                      type="password"
                      value={snmpForm.snmp_v3_priv_password}
                      onChange={(e) =>
                        setSnmpForm({
                          ...snmpForm,
                          snmp_v3_priv_password: e.target.value,
                        })
                      }
                      placeholder={editingSnmp ? '(unchanged)' : ''}
                    />
                  </div>
                </div>
              </>
            )}

            <div>
              <Label htmlFor="snmp-description">Description</Label>
              <Textarea
                id="snmp-description"
                value={snmpForm.description}
                onChange={(e) =>
                  setSnmpForm({ ...snmpForm, description: e.target.value })
                }
                placeholder="Describe this SNMP mapping"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSnmpDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveSnmp}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
