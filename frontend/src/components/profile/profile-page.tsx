'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAuthStore } from '@/lib/auth-store'
import { useToast } from '@/hooks/use-toast'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { generateAvatarDataUrl } from '@/components/ui/local-avatar'
import { useDebug } from '@/contexts/debug-context'
import { debug, debugFetch } from '@/lib/debug'
import { Eye, EyeOff, Save, User, Mail, Lock, Bug, Key, RefreshCw, Plus, Trash2, ChevronDown, ChevronRight } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'

interface PersonalCredential {
  id: string
  name: string
  username: string
  type: 'SSH' | 'TACACS' | 'Generic' | 'Token'
  password: string
  isOpen: boolean
  showPassword: boolean
  hasStoredPassword: boolean // Track if there's a password stored in backend
  passwordChanged: boolean // Track if password was modified
}

interface ProfileData {
  username: string
  realname: string
  email: string
  debug: boolean
  api_key: string
  personal_credentials: PersonalCredential[]
}

export function ProfilePage() {
  const { user, token } = useAuthStore()
  const { toast } = useToast()
  const { refreshDebugState } = useDebug()
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const [formData, setFormData] = useState<ProfileData>({
    username: '',
    realname: '',
    email: '',
    debug: false,
    api_key: '',
    personal_credentials: []
  })

  const [passwords, setPasswords] = useState({
    newPassword: '',
    confirmPassword: ''
  })

  const [passwordError, setPasswordError] = useState('')

  // Load profile data
  useEffect(() => {
    const loadProfile = async () => {
      if (!user || !token) {
        debug.log('ProfilePage: No user or token, skipping profile load')
        return
      }
      
      debug.log('ProfilePage: Loading profile data for user:', user.username)
      setIsLoading(true)
      try {
        const response = await debugFetch('/api/proxy/profile', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        })

        if (response.ok) {
          const data = await response.json()
          debug.log('ProfilePage: Profile data loaded successfully:', data)
          setFormData({
            username: data.username || user.username,
            realname: data.realname || '',
            email: data.email || '',
            debug: data.debug || false,
            api_key: data.api_key || '',
            personal_credentials: (data.personal_credentials || []).map((cred: {id: string, name: string, username: string, type: string, password?: string}) => {
              // If ID is numeric, it's an existing credential with stored password
              const hasStoredPassword = cred.id && /^\d+$/.test(cred.id)
              return {
                id: cred.id,
                name: cred.name,
                username: cred.username,
                type: cred.type.toUpperCase() as PersonalCredential['type'], // Convert from backend lowercase to frontend uppercase
                password: cred.password || '', // Load actual password from backend
                isOpen: false,
                showPassword: false,
                hasStoredPassword,
                passwordChanged: false
              }
            })
          })
        } else {
          debug.warn('ProfilePage: Profile endpoint not found, using default values')
          // If profile endpoint doesn't exist yet, use default values
          setFormData({
            username: user.username,
            realname: '',
            email: '',
            debug: false,
            api_key: '',
            personal_credentials: []
          })
        }
      } catch (error) {
        console.error('Error loading profile:', error)
        // Use fallback data
        setFormData({
          username: user.username,
          realname: '',
          email: '',
          debug: false,
          api_key: '',
          personal_credentials: []
        })
      } finally {
        setIsLoading(false)
      }
    }

    loadProfile()
  }, [user, token])

  const validatePasswords = () => {
    if (passwords.newPassword || passwords.confirmPassword) {
      if (passwords.newPassword !== passwords.confirmPassword) {
        setPasswordError('Passwords do not match')
        return false
      }
      if (passwords.newPassword.length < 4) {
        setPasswordError('Password must be at least 4 characters long')
        return false
      }
    }
    setPasswordError('')
    return true
  }

  const validateApiKey = (apiKey: string) => {
    // Allow empty API keys (signals no API key configured)
    if (apiKey.length === 0) {
      return ''
    }
    // If API key is provided, it must be exactly 42 characters
    if (apiKey.length !== 42) {
      return 'API key must be exactly 42 characters long'
    }
    return ''
  }

  const generateApiKey = () => {
    // Generate a 42-character API key using alphanumeric characters
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    let result = ''
    for (let i = 0; i < 42; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    setFormData(prev => ({ ...prev, api_key: result }))
  }

  // Personal Credentials Management
  const generateCredentialId = () => {
    return `cred_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  const addPersonalCredential = () => {
    const newCredential: PersonalCredential = {
      id: generateCredentialId(),
      name: '',
      username: '',
      type: 'SSH',
      password: '',
      isOpen: true,
      showPassword: false,
      hasStoredPassword: false,
      passwordChanged: false
    }
    setFormData(prev => ({
      ...prev,
      personal_credentials: [...prev.personal_credentials, newCredential]
    }))
  }

  const removePersonalCredential = (id: string) => {
    setFormData(prev => ({
      ...prev,
      personal_credentials: prev.personal_credentials.filter(cred => cred.id !== id)
    }))
  }

  const updatePersonalCredential = (id: string, field: keyof PersonalCredential, value: string | boolean) => {
    setFormData(prev => ({
      ...prev,
      personal_credentials: prev.personal_credentials.map(cred => {
        if (cred.id === id) {
          const updated = { ...cred, [field]: value }
          // Mark password as changed when it's updated
          if (field === 'password') {
            updated.passwordChanged = true
          }
          return updated
        }
        return cred
      })
    }))
  }

  const toggleCredentialExpanded = (id: string) => {
    updatePersonalCredential(id, 'isOpen', !formData.personal_credentials.find(c => c.id === id)?.isOpen)
  }

  const toggleCredentialPasswordVisibility = (id: string) => {
    updatePersonalCredential(id, 'showPassword', !formData.personal_credentials.find(c => c.id === id)?.showPassword)
  }

  const handleSave = async () => {
    if (!validatePasswords()) {
      debug.warn('ProfilePage: Password validation failed')
      return
    }

    const apiKeyError = validateApiKey(formData.api_key)
    if (apiKeyError) {
      toast({
        title: 'Validation Error',
        description: apiKeyError,
        variant: 'destructive',
      })
      return
    }

    debug.log('ProfilePage: Starting profile save')
    setIsSaving(true)
    try {
      const updateData: {
        realname: string;
        email: string;
        debug: boolean;
        api_key: string;
        personal_credentials: {
          id: string;
          name: string;
          username: string;
          type: string;
          password: string;
        }[];
        password?: string;
      } = {
        realname: formData.realname,
        email: formData.email,
        debug: formData.debug,
        api_key: formData.api_key,
        personal_credentials: formData.personal_credentials.map(cred => ({
          id: cred.id,
          name: cred.name,
          username: cred.username,
          type: cred.type,
          password: cred.passwordChanged || !cred.hasStoredPassword ? cred.password : '' // Only send password if changed or new credential
        }))
      }

      // Only include password if it's being changed
      if (passwords.newPassword) {
        updateData.password = passwords.newPassword
        debug.log('ProfilePage: Including password update in request')
      }

      debug.log('ProfilePage: Sending profile update:', { ...updateData, password: updateData.password ? '[REDACTED]' : undefined })

      const response = await debugFetch('/api/proxy/profile', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updateData)
      })

      if (response.ok) {
        const responseData = await response.json()
        debug.log('ProfilePage: Profile updated successfully', responseData)
        
        // Update form data with response data (includes updated personal credentials with proper IDs)
        if (responseData.personal_credentials) {
          setFormData(prev => ({
            ...prev,
            personal_credentials: responseData.personal_credentials.map((cred: {id: string, name: string, username: string, type: string, password?: string}) => {
              // If ID is numeric, it's an existing credential with stored password
              const hasStoredPassword = cred.id && /^\d+$/.test(cred.id)
              return {
                id: cred.id,
                name: cred.name,
                username: cred.username,
                type: cred.type.toUpperCase() as PersonalCredential['type'], // Convert back to frontend format
                password: cred.password || '', // Load actual password from backend response
                isOpen: false, // Collapse all after save
                showPassword: false, // Hide passwords after save
                hasStoredPassword,
                passwordChanged: false // Reset changed flag after save
              }
            })
          }))
        }
        
        toast({
          title: 'Profile Updated',
          description: 'Your profile has been successfully updated.',
        })
        
        // Clear password fields after successful update
        setPasswords({ newPassword: '', confirmPassword: '' })
        setPasswordError('')
        
        // Refresh debug state if debug mode was changed
        await refreshDebugState()
      } else {
        const errorData = await response.json().catch(() => ({ detail: 'Failed to update profile' }))
        throw new Error(errorData.detail || 'Failed to update profile')
      }
    } catch (error) {
      console.error('Error saving profile:', error)
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update profile',
        variant: 'destructive',
      })
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="container mx-auto py-8">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center space-x-4">
          <Avatar className="h-16 w-16 ring-2 ring-blue-100">
            <AvatarImage 
              src={generateAvatarDataUrl(formData.username, 64)}
              onError={(e) => {
                e.currentTarget.style.display = 'none'
              }}
            />
            <AvatarFallback className="bg-blue-100 text-blue-700 font-semibold text-lg">
              {formData.username.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Profile Settings</h1>
            <p className="text-slate-600">Manage your account settings and preferences</p>
          </div>
        </div>

        {/* Tabbed Profile Form */}
        <Tabs defaultValue="personal" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="personal">Personal Information</TabsTrigger>
            <TabsTrigger value="tokens">Tokens & Credentials</TabsTrigger>
            <TabsTrigger value="password">Change Password</TabsTrigger>
          </TabsList>

          {/* Tab 1: Personal Information */}
          <TabsContent value="personal" className="space-y-4">
            <Card className="overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-3 pl-8 pr-6 -mx-6 -mt-6 mb-6">
                <CardTitle className="flex items-center space-x-2 text-white text-base">
                  <User className="h-5 w-5" />
                  <span>Personal Information</span>
                </CardTitle>
                <CardDescription className="text-blue-100">
                  Update your personal details and account preferences
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Username (read-only) */}
                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    value={formData.username}
                    disabled
                    className="bg-slate-50"
                  />
                  <p className="text-sm text-slate-500">Username cannot be changed</p>
                </div>

                {/* Real Name */}
                <div className="space-y-2">
                  <Label htmlFor="realname">Real Name</Label>
                  <Input
                    id="realname"
                    value={formData.realname}
                    onChange={(e) => setFormData(prev => ({ ...prev, realname: e.target.value }))}
                    placeholder="Enter your full name"
                  />
                </div>

                {/* Email */}
                <div className="space-y-2">
                  <Label htmlFor="email" className="flex items-center space-x-2">
                    <Mail className="h-4 w-4" />
                    <span>Email</span>
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="Enter your email address"
                  />
                </div>

                {/* Debug Mode */}
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="space-y-0.5">
                    <Label className="flex items-center space-x-2 text-base">
                      <Bug className="h-4 w-4" />
                      <span>Debug Mode</span>
                    </Label>
                    <p className="text-sm text-slate-500">
                      Enable enhanced logging and debugging features
                    </p>
                  </div>
                  <Switch
                    checked={formData.debug}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, debug: checked }))}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab 2: Tokens & Credentials */}
          <TabsContent value="tokens" className="space-y-4">
            <Card className="overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-3 pl-8 pr-6 -mx-6 -mt-6 mb-6">
                <CardTitle className="flex items-center space-x-2 text-white text-base">
                  <Key className="h-5 w-5" />
                  <span>Tokens & Credentials</span>
                </CardTitle>
                <CardDescription className="text-blue-100">
                  Manage your API keys and access tokens
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* API Key */}
                <div className="space-y-2">
                  <Label htmlFor="api_key" className="flex items-center space-x-2">
                    <Key className="h-4 w-4" />
                    <span>API Key</span>
                  </Label>
                  <div className="flex space-x-2">
                    <Input
                      id="api_key"
                      type="text"
                      value={formData.api_key}
                      onChange={(e) => setFormData(prev => ({ ...prev, api_key: e.target.value }))}
                      placeholder="Enter your 42-character API key"
                      className="font-mono text-sm"
                      maxLength={42}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="default"
                      onClick={generateApiKey}
                      className="shrink-0 px-3"
                      title="Generate new API key"
                    >
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <p className="text-slate-500">
                      Leave empty for no API key, or enter exactly 42 characters
                    </p>
                    <span className={`font-mono ${
                      formData.api_key.length === 0
                        ? 'text-slate-400'
                        : formData.api_key.length === 42
                          ? 'text-green-600'
                          : 'text-red-600'
                    }`}>
                      {formData.api_key.length}/42
                    </span>
                  </div>
                  {formData.api_key.length > 0 && formData.api_key.length !== 42 && (
                    <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md">
                      API key must be exactly 42 characters long
                    </div>
                  )}
                </div>

                {/* Personal Credentials */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-base font-medium">Personal Credentials</Label>
                      <p className="text-sm text-slate-500">Manage your personal authentication credentials</p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addPersonalCredential}
                      className="flex items-center space-x-2"
                    >
                      <Plus className="h-4 w-4" />
                      <span>Add Credential</span>
                    </Button>
                  </div>

                  {formData.personal_credentials.length === 0 ? (
                    <div className="text-center py-8 text-slate-500 bg-slate-50 rounded-lg border-2 border-dashed border-slate-200">
                      <Key className="h-8 w-8 mx-auto mb-2 text-slate-400" />
                      <p>No personal credentials configured</p>
                      <p className="text-sm">Click &ldquo;Add Credential&rdquo; to get started</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {formData.personal_credentials.map((credential) => (
                        <div key={credential.id} className="border rounded-lg">
                          <Collapsible open={credential.isOpen} onOpenChange={() => toggleCredentialExpanded(credential.id)}>
                            <div className="flex items-center justify-between p-4 hover:bg-slate-50">
                              <CollapsibleTrigger className="flex items-center space-x-3 flex-1 text-left">
                                {credential.isOpen ? (
                                  <ChevronDown className="h-4 w-4 text-slate-400" />
                                ) : (
                                  <ChevronRight className="h-4 w-4 text-slate-400" />
                                )}
                                <div>
                                  <div className="font-medium">
                                    {credential.name || 'Unnamed Credential'}
                                  </div>
                                  <div className="text-sm text-slate-500">
                                    {credential.type} • {credential.username || 'No username'}
                                  </div>
                                </div>
                              </CollapsibleTrigger>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => removePersonalCredential(credential.id)}
                                className="text-red-600 hover:text-red-700 hover:bg-red-50 ml-2"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                            <CollapsibleContent>
                              <div className="px-4 pb-4 space-y-4 border-t bg-slate-50/50">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
                                  {/* Credential Name */}
                                  <div className="space-y-2">
                                    <Label htmlFor={`cred-name-${credential.id}`}>Name</Label>
                                    <Input
                                      id={`cred-name-${credential.id}`}
                                      value={credential.name}
                                      onChange={(e) => updatePersonalCredential(credential.id, 'name', e.target.value)}
                                      placeholder="Enter credential name"
                                    />
                                  </div>

                                  {/* Credential Type */}
                                  <div className="space-y-2">
                                    <Label htmlFor={`cred-type-${credential.id}`}>Type</Label>
                                    <Select
                                      value={credential.type}
                                      onValueChange={(value) => updatePersonalCredential(credential.id, 'type', value)}
                                    >
                                      <SelectTrigger>
                                        <SelectValue placeholder="Select type" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="SSH">SSH</SelectItem>
                                        <SelectItem value="TACACS">TACACS</SelectItem>
                                        <SelectItem value="Generic">Generic</SelectItem>
                                        <SelectItem value="Token">Token</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>

                                  {/* Username */}
                                  <div className="space-y-2">
                                    <Label htmlFor={`cred-username-${credential.id}`}>Username</Label>
                                    <Input
                                      id={`cred-username-${credential.id}`}
                                      value={credential.username}
                                      onChange={(e) => updatePersonalCredential(credential.id, 'username', e.target.value)}
                                      placeholder="Enter username"
                                    />
                                  </div>

                                  {/* Password/Token */}
                                  <div className="space-y-2">
                                    <Label htmlFor={`cred-password-${credential.id}`}>
                                      {credential.type === 'Token' ? 'Token' : 'Password'}
                                    </Label>
                                    <div className="relative">
                                      <Input
                                        id={`cred-password-${credential.id}`}
                                        type={credential.showPassword ? 'text' : 'password'}
                                        value={credential.password}
                                        onChange={(e) => updatePersonalCredential(credential.id, 'password', e.target.value)}
                                        placeholder={credential.type === 'Token' ? 'Enter token' : 'Enter password'}
                                        className="pr-10"
                                      />
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="absolute right-0 top-0 h-full px-3 py-2"
                                        onClick={() => toggleCredentialPasswordVisibility(credential.id)}
                                      >
                                        {credential.showPassword ? (
                                          <EyeOff className="h-4 w-4" />
                                        ) : (
                                          <Eye className="h-4 w-4" />
                                        )}
                                      </Button>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </CollapsibleContent>
                          </Collapsible>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab 3: Change Password */}
          <TabsContent value="password" className="space-y-4">
            <Card className="overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-3 pl-8 pr-6 -mx-6 -mt-6 mb-6">
                <CardTitle className="flex items-center space-x-2 text-white text-base">
                  <Lock className="h-5 w-5" />
                  <span>Change Password</span>
                </CardTitle>
                <CardDescription className="text-blue-100">
                  Update your password (leave empty to keep current password)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* New Password */}
                <div className="space-y-2">
                  <Label htmlFor="newPassword">New Password</Label>
                  <div className="relative">
                    <Input
                      id="newPassword"
                      type={showPassword ? 'text' : 'password'}
                      value={passwords.newPassword}
                      onChange={(e) => {
                        setPasswords(prev => ({ ...prev, newPassword: e.target.value }))
                        setPasswordError('')
                      }}
                      placeholder="Enter new password"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 py-2"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                {/* Confirm Password */}
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm New Password</Label>
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={passwords.confirmPassword}
                      onChange={(e) => {
                        setPasswords(prev => ({ ...prev, confirmPassword: e.target.value }))
                        setPasswordError('')
                      }}
                      placeholder="Confirm new password"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 py-2"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                {/* Password Error */}
                {passwordError && (
                  <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md">
                    {passwordError}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button
            onClick={handleSave}
            disabled={isSaving || !!passwordError || (formData.api_key.length > 0 && formData.api_key.length !== 42)}
            className="min-w-[120px] bg-green-600 hover:bg-green-700 text-white"
          >
            {isSaving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}