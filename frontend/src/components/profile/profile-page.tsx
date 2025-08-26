'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { useAuthStore } from '@/lib/auth-store'
import { useToast } from '@/hooks/use-toast'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { generateAvatarDataUrl } from '@/components/ui/local-avatar'
import { useDebug } from '@/contexts/debug-context'
import { debug, debugFetch } from '@/lib/debug'
import { Eye, EyeOff, Save, User, Mail, Lock, Bug } from 'lucide-react'

interface ProfileData {
  username: string
  realname: string
  email: string
  debug: boolean
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
    debug: false
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
            debug: data.debug || false
          })
        } else {
          debug.warn('ProfilePage: Profile endpoint not found, using default values')
          // If profile endpoint doesn't exist yet, use default values
          setFormData({
            username: user.username,
            realname: '',
            email: '',
            debug: false
          })
        }
      } catch (error) {
        console.error('Error loading profile:', error)
        // Use fallback data
        setFormData({
          username: user.username,
          realname: '',
          email: '',
          debug: false
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

  const handleSave = async () => {
    if (!validatePasswords()) {
      debug.warn('ProfilePage: Password validation failed')
      return
    }

    debug.log('ProfilePage: Starting profile save')
    setIsSaving(true)
    try {
      const updateData: any = {
        realname: formData.realname,
        email: formData.email,
        debug: formData.debug
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
        debug.log('ProfilePage: Profile updated successfully')
        
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

        {/* Profile Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <User className="h-5 w-5" />
              <span>Personal Information</span>
            </CardTitle>
            <CardDescription>
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

        {/* Password Change */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Lock className="h-5 w-5" />
              <span>Change Password</span>
            </CardTitle>
            <CardDescription>
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

        {/* Save Button */}
        <div className="flex justify-end">
          <Button
            onClick={handleSave}
            disabled={isSaving || !!passwordError}
            className="min-w-[120px]"
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