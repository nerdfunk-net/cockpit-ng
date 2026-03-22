'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { generateAvatarDataUrl } from '@/components/ui/local-avatar'
import { Save } from 'lucide-react'
import { useAuthStore } from '@/lib/auth-store'
import { useToast } from '@/hooks/use-toast'
import { PersonalInformationTab } from '../tabs/personal-information-tab'
import { TokensCredentialsTab } from '../tabs/tokens-credentials-tab'
import type { PersonalCredential } from '../tabs/tokens-credentials-tab'
import { ChangePasswordTab } from '../tabs/change-password-tab'

interface ProfileData {
  username: string
  realname: string
  email: string
  api_key: string
  personal_credentials: PersonalCredential[]
}

export function ProfilePage() {
  const { user, token } = useAuthStore()
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const [formData, setFormData] = useState<ProfileData>({
    username: '',
    realname: '',
    email: '',
    api_key: '',
    personal_credentials: [],
  })

  const [passwords, setPasswords] = useState({
    newPassword: '',
    confirmPassword: '',
  })

  const [passwordError, setPasswordError] = useState('')

  // Load profile data
  useEffect(() => {
    const loadProfile = async () => {
      if (!user || !token) {
        return
      }

      setIsLoading(true)
      try {
        const response = await fetch('/api/proxy/profile', {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        })

        if (response.ok) {
          const data = await response.json()
          setFormData({
            username: data.username || user.username,
            realname: data.realname || '',
            email: data.email || '',
            api_key: data.api_key || '',
            personal_credentials: (data.personal_credentials || []).map(
              (cred: {
                id: string
                name: string
                username: string
                type: string
                password?: string
                has_ssh_key?: boolean
              }) => {
                const hasStoredPassword = cred.id && /^\d+$/.test(cred.id)
                const isPasswordToken = cred.password && /^•+$/.test(cred.password)
                const credType = cred.type.toUpperCase() as PersonalCredential['type']
                return {
                  id: cred.id,
                  name: cred.name,
                  username: cred.username,
                  type: credType,
                  password: isPasswordToken ? cred.password : cred.password || '',
                  isOpen: false,
                  showPassword: false,
                  hasStoredPassword,
                  passwordChanged: false,
                  has_ssh_key: cred.has_ssh_key || false,
                  ssh_private_key: '',
                  ssh_passphrase: '',
                  showSshPassphrase: false,
                  sshKeyChanged: false,
                }
              },
            ),
          })
        } else {
          setFormData({
            username: user.username,
            realname: '',
            email: '',
            api_key: '',
            personal_credentials: [],
          })
        }
      } catch (error) {
        console.error('Error loading profile:', error)
        setFormData({
          username: user.username,
          realname: '',
          email: '',
          api_key: '',
          personal_credentials: [],
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
    if (apiKey.length === 0) {
      return ''
    }
    if (apiKey.length !== 42) {
      return 'API key must be exactly 42 characters long'
    }
    return ''
  }

  const generateApiKey = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    let result = ''
    for (let i = 0; i < 42; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    setFormData((prev) => ({ ...prev, api_key: result }))
  }

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
      passwordChanged: false,
    }
    setFormData((prev) => ({
      ...prev,
      personal_credentials: [...prev.personal_credentials, newCredential],
    }))
  }

  const removePersonalCredential = (id: string) => {
    setFormData((prev) => ({
      ...prev,
      personal_credentials: prev.personal_credentials.filter((cred) => cred.id !== id),
    }))
  }

  const updatePersonalCredential = (
    id: string,
    field: keyof PersonalCredential,
    value: string | boolean,
  ) => {
    setFormData((prev) => ({
      ...prev,
      personal_credentials: prev.personal_credentials.map((cred) => {
        if (cred.id === id) {
          const updated = { ...cred, [field]: value }
          if (field === 'password') {
            updated.passwordChanged = true
          }
          if (field === 'ssh_private_key' || field === 'ssh_passphrase') {
            updated.sshKeyChanged = true
          }
          if (field === 'type' && value !== 'SSH_KEY') {
            updated.ssh_private_key = ''
            updated.ssh_passphrase = ''
            updated.has_ssh_key = false
            updated.sshKeyChanged = false
          }
          return updated
        }
        return cred
      }),
    }))
  }

  const toggleCredentialExpanded = (id: string) => {
    updatePersonalCredential(
      id,
      'isOpen',
      !formData.personal_credentials.find((c) => c.id === id)?.isOpen,
    )
  }

  const toggleCredentialPasswordVisibility = (id: string) => {
    updatePersonalCredential(
      id,
      'showPassword',
      !formData.personal_credentials.find((c) => c.id === id)?.showPassword,
    )
  }

  const toggleCredentialSshPassphraseVisibility = (id: string) => {
    const cred = formData.personal_credentials.find((c) => c.id === id)
    updatePersonalCredential(id, 'showSshPassphrase', !cred?.showSshPassphrase)
  }

  const handleSshKeyFileChange = (id: string, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      const content = e.target?.result as string
      updatePersonalCredential(id, 'ssh_private_key', content)
    }
    reader.readAsText(file)
  }

  const handleSave = async () => {
    if (!validatePasswords()) {
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

    setIsSaving(true)
    try {
      const updateData: {
        realname: string
        email: string
        api_key: string
        personal_credentials: {
          id: string
          name: string
          username: string
          type: string
          password: string
          ssh_private_key?: string
          ssh_passphrase?: string
        }[]
        password?: string
      } = {
        realname: formData.realname,
        email: formData.email,
        api_key: formData.api_key,
        personal_credentials: formData.personal_credentials.map((cred) => {
          const baseCredential = {
            id: cred.id,
            name: cred.name,
            username: cred.username,
            type: cred.type,
            password: '',
          }

          if (cred.type === 'SSH_KEY') {
            return {
              ...baseCredential,
              ssh_private_key: cred.sshKeyChanged ? cred.ssh_private_key || '' : '',
              ssh_passphrase: cred.sshKeyChanged ? cred.ssh_passphrase || '' : '',
            }
          } else {
            return {
              ...baseCredential,
              password:
                (cred.passwordChanged || !cred.hasStoredPassword) &&
                !/^•+$/.test(cred.password)
                  ? cred.password
                  : '',
            }
          }
        }),
      }

      if (passwords.newPassword) {
        updateData.password = passwords.newPassword
      }

      const response = await fetch('/api/proxy/profile', {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      })

      if (response.ok) {
        const responseData = await response.json()

        if (responseData.personal_credentials) {
          setFormData((prev) => ({
            ...prev,
            personal_credentials: responseData.personal_credentials.map(
              (cred: {
                id: string
                name: string
                username: string
                type: string
                password?: string
                has_ssh_key?: boolean
              }) => {
                const hasStoredPassword = cred.id && /^\d+$/.test(cred.id)
                const isPasswordToken = cred.password && /^•+$/.test(cred.password)
                const credType = cred.type.toUpperCase() as PersonalCredential['type']
                return {
                  id: cred.id,
                  name: cred.name,
                  username: cred.username,
                  type: credType,
                  password: isPasswordToken ? cred.password : cred.password || '',
                  isOpen: false,
                  showPassword: false,
                  hasStoredPassword,
                  passwordChanged: false,
                  has_ssh_key: cred.has_ssh_key || false,
                  ssh_private_key: '',
                  ssh_passphrase: '',
                  showSshPassphrase: false,
                  sshKeyChanged: false,
                }
              },
            ),
          }))
        }

        toast({
          title: 'Profile Updated',
          description: 'Your profile has been successfully updated.',
        })

        setPasswords({ newPassword: '', confirmPassword: '' })
        setPasswordError('')
      } else {
        const errorData = await response
          .json()
          .catch(() => ({ detail: 'Failed to update profile' }))
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

          <TabsContent value="personal" className="space-y-4">
            <PersonalInformationTab
              username={formData.username}
              realname={formData.realname}
              email={formData.email}
              onRealnameChange={(value) => setFormData((prev) => ({ ...prev, realname: value }))}
              onEmailChange={(value) => setFormData((prev) => ({ ...prev, email: value }))}
            />
          </TabsContent>

          <TabsContent value="tokens" className="space-y-4">
            <TokensCredentialsTab
              apiKey={formData.api_key}
              personalCredentials={formData.personal_credentials}
              onApiKeyChange={(value) => setFormData((prev) => ({ ...prev, api_key: value }))}
              onGenerateApiKey={generateApiKey}
              onAddCredential={addPersonalCredential}
              onRemoveCredential={removePersonalCredential}
              onUpdateCredential={updatePersonalCredential}
              onToggleCredentialExpanded={toggleCredentialExpanded}
              onToggleCredentialPasswordVisibility={toggleCredentialPasswordVisibility}
              onToggleCredentialSshPassphraseVisibility={toggleCredentialSshPassphraseVisibility}
              onSshKeyFileChange={handleSshKeyFileChange}
            />
          </TabsContent>

          <TabsContent value="password" className="space-y-4">
            <ChangePasswordTab
              passwords={passwords}
              passwordError={passwordError}
              showPassword={showPassword}
              showConfirmPassword={showConfirmPassword}
              onPasswordsChange={setPasswords}
              onPasswordErrorChange={setPasswordError}
              onShowPasswordToggle={() => setShowPassword((prev) => !prev)}
              onShowConfirmPasswordToggle={() => setShowConfirmPassword((prev) => !prev)}
            />
          </TabsContent>
        </Tabs>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button
            onClick={handleSave}
            disabled={
              isSaving ||
              !!passwordError ||
              (formData.api_key.length > 0 && formData.api_key.length !== 42)
            }
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
