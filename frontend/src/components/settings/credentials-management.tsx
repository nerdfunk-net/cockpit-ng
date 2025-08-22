'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { Badge } from '../ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog'
import { Separator } from '../ui/separator'
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
  Lock
} from 'lucide-react'
import { useApi } from '../../hooks/use-api'

interface Credential {
  id: number
  name: string
  username: string
  type: string
  valid_until?: string
  status: 'active' | 'expiring' | 'expired'
  created_at?: string
  updated_at?: string
}

interface CredentialFormData {
  name: string
  username: string
  type: string
  password: string
  valid_until?: string
}

interface StatusMessage {
  type: 'success' | 'error' | 'info'
  text: string
}

const CREDENTIAL_TYPES = [
  { value: 'ssh', label: 'SSH' },
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
  
  const [formData, setFormData] = useState<CredentialFormData>({
    name: '',
    username: '',
    type: 'ssh',
    password: '',
    valid_until: ''
  })

  const showMessage = (text: string, type: StatusMessage['type'] = 'success') => {
    setMessage({ text, type })
    setTimeout(() => setMessage(null), 4000)
  }

  const loadCredentials = async () => {
    setLoading(true)
    try {
      const response = await apiCall<Credential[]>(`credentials?include_expired=${includeExpired}`)
      setCredentials(response || [])
    } catch (error: any) {
      console.error('Error loading credentials:', error)
      if (error.message?.includes('401') || error.message?.includes('403')) {
        showMessage('Authentication required. Please log in again.', 'error')
      } else {
        showMessage('Failed to load credentials', 'error')
      }
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      username: '',
      type: 'ssh', // Always set to a valid default
      password: '',
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
    
    if (!editingCredential && !formData.password.trim()) {
      return type === 'token' ? 'Token is required' : 'Password is required'
    }
    return null
  }

  const saveCredential = async () => {
    const validationError = validateForm()
    if (validationError) {
      showMessage(validationError, 'error')
      return
    }

    setSaving(true)
    try {
      const payload: any = {
        name: formData.name.trim(),
        username: formData.username.trim(),
        type: formData.type,
        valid_until: formData.valid_until || null
      }

      // Only include password if it's provided
      if (formData.password.trim()) {
        payload.password = formData.password
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
    } catch (error: any) {
      console.error('Error saving credential:', error)
      if (error.message?.includes('401') || error.message?.includes('403')) {
        showMessage('Authentication required. Please log in again.', 'error')
      } else if (error.message?.includes('400')) {
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
    } catch (error: any) {
      console.error('Error deleting credential:', error)
      if (error.message?.includes('401') || error.message?.includes('403')) {
        showMessage('Authentication required. Please log in again.', 'error')
      } else {
        showMessage('Failed to delete credential', 'error')
      }
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
  }, [includeExpired])

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="border-b border-gray-200 pb-4">
          <div className="flex items-center space-x-3">
            <div className="bg-blue-100 p-2 rounded-lg">
              <Key className="h-6 w-6 text-blue-600 animate-pulse" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">Credentials</h1>
              <p className="text-gray-600">Loading stored credentials...</p>
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
    <div className="space-y-2">
      {/* Modern Header */}
      <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 pl-6 pr-4 rounded-lg border shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Key className="h-5 w-5" />
              <div>
                <h1 className="text-lg font-semibold">Credentials Management</h1>
                <p className="text-blue-100 text-xs">Manage stored credentials for device access</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={loadCredentials}
                disabled={loading}
                className="flex items-center gap-2 bg-white/20 text-white border-white/30 hover:bg-white/30"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                Reload
              </Button>
              <Button 
                size="sm"
                onClick={openAddDialog} 
                className="flex items-center gap-2 bg-white text-blue-600 hover:bg-blue-50"
              >
                <Plus className="h-4 w-4" />
                Add Credential
              </Button>
            </div>
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
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              <div>
                <CardTitle>Stored Credentials</CardTitle>
                <CardDescription>
                  Passwords are encrypted and never displayed for security
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="include-expired"
                checked={includeExpired}
                onChange={(e) => setIncludeExpired(e.target.checked)}
                className="rounded border-gray-300"
              />
              <Label htmlFor="include-expired" className="text-sm text-gray-600">
                Include expired
              </Label>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {credentials.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Key className="h-12 w-12 mx-auto text-gray-300 mb-4" />
              <p className="text-lg font-medium">No credentials found</p>
              <p className="text-sm">Add your first credential to get started</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-2 font-medium text-gray-600">Name</th>
                    <th className="text-left py-3 px-2 font-medium text-gray-600">Username</th>
                    <th className="text-left py-3 px-2 font-medium text-gray-600">Type</th>
                    <th className="text-left py-3 px-2 font-medium text-gray-600">Valid Until</th>
                    <th className="text-left py-3 px-2 font-medium text-gray-600">Status</th>
                    <th className="text-left py-3 px-2 font-medium text-gray-600 w-24">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {credentials.map((credential) => (
                    <tr key={credential.id} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-2">
                        <div className="font-medium">{credential.name}</div>
                      </td>
                      <td className="py-3 px-2 text-gray-600">
                        {credential.username}
                      </td>
                      <td className="py-3 px-2">
                        <div className="flex items-center gap-2">
                          {getTypeIcon(credential.type)}
                          <span className="capitalize">{credential.type}</span>
                        </div>
                      </td>
                      <td className="py-3 px-2 text-gray-600">
                        {credential.valid_until || '-'}
                      </td>
                      <td className="py-3 px-2">
                        {getStatusBadge(credential.status)}
                      </td>
                      <td className="py-3 px-2">
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
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingCredential ? 'Edit Credential' : 'New Credential'}
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
              <Button onClick={saveCredential} disabled={saving}>
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
