'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { 
  Key, 
  Plus, 
  RefreshCw, 
  Edit, 
  Trash2, 
  Shield,
  AlertTriangle,
  CheckCircle,
  Clock,
  UserCheck,
  Lock,
  Upload,
  FileKey
} from 'lucide-react'
import { useApi } from '@/hooks/use-api'

interface Credential {
  id: number
  name: string
  username: string
  type: string
  valid_until?: string
  status: 'active' | 'expiring' | 'expired'
  created_at?: string
  updated_at?: string
  has_ssh_key?: boolean
  has_ssh_passphrase?: boolean
}

interface CredentialFormData {
  name: string
  username: string
  type: string
  password: string
  ssh_private_key: string
  ssh_passphrase: string
  valid_until?: string
}

interface StatusMessage {
  type: 'success' | 'error' | 'info'
  text: string
}

const CREDENTIAL_TYPES = [
  { value: 'ssh', label: 'SSH' },
  { value: 'ssh_key', label: 'SSH Key' },
  { value: 'tacacs', label: 'TACACS' },
  { value: 'generic', label: 'Generic' },
  { value: 'token', label: 'Token' }
]

export default function CredentialsManagement() {
  const { apiCall } = useApi()
  const [credentials, setCredentials] = useState<Credential[]>([])
  const [loading, setLoading] = useState(false)
  const [showDialog, setShowDialog] = useState(false)
  const [editingCredential, setEditingCredential] = useState<Credential | null>(null)
  const [message, setMessage] = useState<StatusMessage | null>(null)
  const [includeExpired, setIncludeExpired] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<number | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const [formData, setFormData] = useState<CredentialFormData>({
    name: '',
    username: '',
    type: 'ssh',
    password: '',
    ssh_private_key: '',
    ssh_passphrase: '',
    valid_until: ''
  })

  const showMessage = useCallback((text: string, type: StatusMessage['type'] = 'success') => {
    setMessage({ text, type })
    setTimeout(() => setMessage(null), 4000)
  }, [])

  const loadCredentials = useCallback(async () => {
    setLoading(true)
    try {
      // Only load general/admin credentials for settings page
      const response = await apiCall<Credential[]>(`credentials?source=general&include_expired=${includeExpired}`)
      setCredentials(response || [])
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error('Error loading credentials:', errorMessage)
      // Show the actual error message (which will be "Admin access required" for 403)
      showMessage(errorMessage, 'error')
    } finally {
      setLoading(false)
    }
  }, [includeExpired, apiCall, showMessage])

  const resetForm = () => {
    setFormData({
      name: '',
      username: '',
      type: 'ssh', // Always set to a valid default
      password: '',
      ssh_private_key: '',
      ssh_passphrase: '',
      valid_until: ''
    })
    setEditingCredential(null)
  }

  const openAddDialog = () => {
    resetForm()
    setShowDialog(true)
  }

  const openEditDialog = (credential: Credential) => {
    setEditingCredential(credential)
    setFormData({
      name: credential.name,
      username: credential.username,
      type: credential.type || 'ssh', // Ensure valid type
      password: '', // Never populate password for security
      ssh_private_key: '', // Never populate SSH key for security
      ssh_passphrase: '', // Never populate passphrase for security
      valid_until: credential.valid_until || ''
    })
    setShowDialog(true)
  }

  const closeDialog = () => {
    setShowDialog(false)
    setEditingCredential(null)
    resetForm()
  }

  const validateForm = (): string | null => {
    if (!formData.name.trim()) return 'Name is required'
    if (!formData.username.trim()) return 'Username is required'
    
    const type = formData.type || 'ssh'
    if (!type || type.trim() === '') return 'Type is required'
    
    // For SSH key type, require the SSH private key (unless editing)
    if (type === 'ssh_key') {
      if (!editingCredential && !formData.ssh_private_key.trim()) {
        return 'SSH private key is required'
      }
    } else {
      // For other types, require password (unless editing)
      if (!editingCredential && !formData.password.trim()) {
        return type === 'token' ? 'Token is required' : 'Password is required'
      }
    }
    return null
  }

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      const content = e.target?.result as string
      setFormData(prev => ({ ...prev, ssh_private_key: content }))
      showMessage('SSH key file loaded successfully', 'success')
    }
    reader.onerror = () => {
      showMessage('Failed to read SSH key file', 'error')
    }
    reader.readAsText(file)
    
    // Reset file input so the same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const saveCredential = async () => {
    const validationError = validateForm()
    if (validationError) {
      showMessage(validationError, 'error')
      return
    }

    setSaving(true)
    try {
      const payload: {
        name: string;
        username: string;
        type: string;
        valid_until: string | null;
        password?: string;
        ssh_private_key?: string;
        ssh_passphrase?: string;
      } = {
        name: formData.name.trim(),
        username: formData.username.trim(),
        type: formData.type,
        valid_until: formData.valid_until || null
      }

      // Include the appropriate credential data based on type
      if (formData.type === 'ssh_key') {
        // For SSH key type, include SSH key and optional passphrase
        if (formData.ssh_private_key.trim()) {
          payload.ssh_private_key = formData.ssh_private_key
        }
        if (formData.ssh_passphrase.trim()) {
          payload.ssh_passphrase = formData.ssh_passphrase
        }
      } else {
        // For other types, include password if provided
        if (formData.password.trim()) {
          payload.password = formData.password
        }
      }

      if (editingCredential) {
        await apiCall(`credentials/${editingCredential.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        })
        showMessage('Credential updated successfully', 'success')
      } else {
        await apiCall('credentials', {
          method: 'POST',
          body: JSON.stringify(payload)
        })
        showMessage('Credential created successfully', 'success')
      }

      closeDialog()
      loadCredentials()
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error('Error saving credential:', errorMessage)
      if (errorMessage.includes('400')) {
        showMessage('Invalid credential data. Please check your inputs.', 'error')
      } else {
        showMessage('Failed to save credential', 'error')
      }
    } finally {
      setSaving(false)
    }
  }

  const deleteCredential = async (credential: Credential) => {
    if (!confirm(`Are you sure you want to delete the credential "${credential.name}"?`)) {
      return
    }

    setDeleting(credential.id)
    try {
      await apiCall(`credentials/${credential.id}`, {
        method: 'DELETE'
      })
      showMessage('Credential deleted successfully', 'success')
      loadCredentials()
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error('Error deleting credential:', errorMessage)
      // Show the actual error message (which will be "Admin access required" for 403)  
      showMessage(errorMessage, 'error')
    } finally {
      setDeleting(null)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'expired':
        return <Badge variant="destructive" className="flex items-center gap-1">
          <AlertTriangle className="h-3 w-3" />
          Expired
        </Badge>
      case 'expiring':
        return <Badge variant="secondary" className="flex items-center gap-1 bg-yellow-100 text-yellow-800">
          <Clock className="h-3 w-3" />
          Expiring
        </Badge>
      default:
        return <Badge variant="default" className="flex items-center gap-1 bg-green-100 text-green-800">
          <CheckCircle className="h-3 w-3" />
          Active
        </Badge>
    }
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'ssh':
        return <Shield className="h-4 w-4 text-blue-600" />
      case 'ssh_key':
        return <FileKey className="h-4 w-4 text-indigo-600" />
      case 'tacacs':
        return <UserCheck className="h-4 w-4 text-purple-600" />
      case 'token':
        return <Key className="h-4 w-4 text-green-600" />
      default:
        return <Lock className="h-4 w-4 text-gray-600" />
    }
  }

  const getPasswordLabel = () => {
    const type = formData.type || 'ssh'
    if (type === 'token') {
      return editingCredential ? 'Token (leave blank to keep current)' : 'Token'
    }
    return editingCredential ? 'Password (leave blank to keep current)' : 'Password'
  }

  const getPasswordPlaceholder = () => {
    const type = formData.type || 'ssh'
    return type === 'token' ? 'Enter token' : 'Enter password'
  }

  useEffect(() => {
    loadCredentials()
  }, [loadCredentials])

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="border-b border-gray-200 pb-4">
          <div className="flex items-center space-x-3">
            <div className="bg-blue-100 p-2 rounded-lg">
              <Key className="h-6 w-6 text-blue-600 animate-pulse" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">System Credentials</h1>
              <p className="text-gray-600">Loading shared system credentials...</p>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="bg-amber-100 p-2 rounded-lg">
            <Key className="h-6 w-6 text-amber-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">System Credentials</h1>
            <p className="text-gray-600 mt-1">Manage shared system credentials for device access</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadCredentials}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Reload
          </Button>
          <Button 
            size="sm"
            onClick={openAddDialog}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Credential
          </Button>
        </div>
      </div>

      {/* Status Message */}
      {message && (
        <div className={`p-4 rounded-md border ${
          message.type === 'success' 
            ? 'bg-green-50 border-green-200 text-green-800' 
            : message.type === 'error'
            ? 'bg-red-50 border-red-200 text-red-800'
            : 'bg-blue-50 border-blue-200 text-blue-800'
        }`}>
          <div className="flex items-center gap-2">
            {message.type === 'success' && <CheckCircle className="h-4 w-4" />}
            {message.type === 'error' && <AlertTriangle className="h-4 w-4" />}
            {message.type === 'info' && <Clock className="h-4 w-4" />}
            {message.text}
          </div>
        </div>
      )}

      {/* Credentials Table */}
      <div className="rounded-xl border shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Lock className="h-4 w-4" />
              <div>
                <h3 className="text-sm font-semibold">System Credentials ({credentials.length})</h3>
                <p className="text-blue-100 text-xs">Shared system credentials. Passwords are encrypted and never displayed.</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="include-expired"
                checked={includeExpired}
                onChange={(e) => setIncludeExpired(e.target.checked)}
                className="rounded border-white/50 bg-white/20"
              />
              <Label htmlFor="include-expired" className="text-sm text-blue-100">
                Include expired
              </Label>
            </div>
          </div>
        </div>
        <div className="bg-white">
          {credentials.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Key className="h-12 w-12 mx-auto text-gray-300 mb-4" />
              <p className="text-lg font-medium">No system credentials found</p>
              <p className="text-sm">Add your first system credential to get started</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Name</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Username</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Type</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Valid Until</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Status</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700 w-24">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {credentials.map((credential) => (
                    <tr key={credential.id} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <div className="font-medium">{credential.name}</div>
                      </td>
                      <td className="py-3 px-4 text-gray-600">
                        {credential.username}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          {getTypeIcon(credential.type)}
                          <span className="capitalize">{credential.type}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-gray-600">
                        {credential.valid_until || '-'}
                      </td>
                      <td className="py-3 px-4">
                        {getStatusBadge(credential.status)}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditDialog(credential)}
                            className="h-8 w-8 p-0"
                            title="Edit"
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteCredential(credential)}
                            disabled={deleting === credential.id}
                            className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                            title="Delete"
                          >
                            {deleting === credential.id ? (
                              <RefreshCw className="h-3 w-3 animate-spin" />
                            ) : (
                              <Trash2 className="h-3 w-3" />
                            )}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingCredential ? 'Edit System Credential' : 'New System Credential'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Enter credential name"
                maxLength={128}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                value={formData.username}
                onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
                placeholder="Enter username"
                maxLength={128}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="type">Type</Label>
              <Select 
                value={formData.type || 'ssh'} 
                onValueChange={(value) => setFormData(prev => ({ ...prev, type: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select credential type" />
                </SelectTrigger>
                <SelectContent>
                  {CREDENTIAL_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      <div className="flex items-center gap-2">
                        {getTypeIcon(type.value)}
                        {type.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Conditional fields based on credential type */}
            {formData.type === 'ssh_key' ? (
              <>
                {/* SSH Key Upload Section */}
                <div className="space-y-2">
                  <Label htmlFor="ssh_private_key">
                    SSH Private Key
                    {!editingCredential && <span className="text-red-500 ml-1">*</span>}
                  </Label>
                  <div className="space-y-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      onChange={handleFileUpload}
                      className="hidden"
                      id="ssh-key-upload"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full"
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Upload SSH Key File
                    </Button>
                    <Textarea
                      id="ssh_private_key"
                      value={formData.ssh_private_key}
                      onChange={(e) => setFormData(prev => ({ ...prev, ssh_private_key: e.target.value }))}
                      placeholder={editingCredential ? 'Leave blank to keep current key' : 'Paste SSH private key or upload file above'}
                      rows={6}
                      className="font-mono text-xs"
                    />
                    {formData.ssh_private_key && (
                      <p className="text-xs text-green-600 flex items-center gap-1">
                        <CheckCircle className="h-3 w-3" />
                        SSH key loaded ({formData.ssh_private_key.length} characters)
                      </p>
                    )}
                  </div>
                </div>

                {/* SSH Passphrase */}
                <div className="space-y-2">
                  <Label htmlFor="ssh_passphrase">
                    SSH Key Passphrase (optional)
                  </Label>
                  <Input
                    id="ssh_passphrase"
                    type="password"
                    value={formData.ssh_passphrase}
                    onChange={(e) => setFormData(prev => ({ ...prev, ssh_passphrase: e.target.value }))}
                    placeholder={editingCredential ? 'Leave blank to keep current passphrase' : 'Enter passphrase if key is encrypted'}
                    autoComplete="new-password"
                  />
                  <p className="text-xs text-muted-foreground">
                    Only required if your SSH key is protected with a passphrase
                  </p>
                </div>
              </>
            ) : (
              /* Password field for non-SSH key types */
              <div className="space-y-2">
                <Label htmlFor="password">
                  {getPasswordLabel()}
                  {!editingCredential && <span className="text-red-500 ml-1">*</span>}
                </Label>
                <Input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                  placeholder={getPasswordPlaceholder()}
                  autoComplete="new-password"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="valid_until">Valid Until (optional)</Label>
              <Input
                id="valid_until"
                type="date"
                value={formData.valid_until}
                onChange={(e) => setFormData(prev => ({ ...prev, valid_until: e.target.value }))}
              />
            </div>

            <Separator />

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={closeDialog}>
                Cancel
              </Button>
              <Button onClick={saveCredential} disabled={saving} className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700">
                {saving ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
