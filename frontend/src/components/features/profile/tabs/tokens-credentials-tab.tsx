'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import {
  Eye,
  EyeOff,
  Key,
  RefreshCw,
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  Check,
} from 'lucide-react'

export interface PersonalCredential {
  id: string
  name: string
  username: string
  type: 'SSH' | 'SSH_KEY' | 'TACACS' | 'Generic' | 'Token'
  password: string
  isOpen: boolean
  showPassword: boolean
  hasStoredPassword: boolean
  passwordChanged: boolean
  ssh_private_key?: string
  ssh_passphrase?: string
  has_ssh_key?: boolean
  showSshPassphrase?: boolean
  sshKeyChanged?: boolean
}

interface TokensCredentialsTabProps {
  apiKey: string
  personalCredentials: PersonalCredential[]
  onApiKeyChange: (value: string) => void
  onGenerateApiKey: () => void
  onAddCredential: () => void
  onRemoveCredential: (id: string) => void
  onUpdateCredential: (id: string, field: keyof PersonalCredential, value: string | boolean) => void
  onToggleCredentialExpanded: (id: string) => void
  onToggleCredentialPasswordVisibility: (id: string) => void
  onToggleCredentialSshPassphraseVisibility: (id: string) => void
  onSshKeyFileChange: (id: string, event: React.ChangeEvent<HTMLInputElement>) => void
}

export function TokensCredentialsTab({
  apiKey,
  personalCredentials,
  onApiKeyChange,
  onGenerateApiKey,
  onAddCredential,
  onRemoveCredential,
  onUpdateCredential,
  onToggleCredentialExpanded,
  onToggleCredentialPasswordVisibility,
  onToggleCredentialSshPassphraseVisibility,
  onSshKeyFileChange,
}: TokensCredentialsTabProps) {
  return (
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
              value={apiKey}
              onChange={(e) => onApiKeyChange(e.target.value)}
              placeholder="Enter your 42-character API key"
              className="font-mono text-sm"
              maxLength={42}
            />
            <Button
              type="button"
              variant="outline"
              size="default"
              onClick={onGenerateApiKey}
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
            <span
              className={`font-mono ${
                apiKey.length === 0
                  ? 'text-slate-400'
                  : apiKey.length === 42
                    ? 'text-green-600'
                    : 'text-red-600'
              }`}
            >
              {apiKey.length}/42
            </span>
          </div>
          {apiKey.length > 0 && apiKey.length !== 42 && (
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
              onClick={onAddCredential}
              className="flex items-center space-x-2"
            >
              <Plus className="h-4 w-4" />
              <span>Add Credential</span>
            </Button>
          </div>

          {personalCredentials.length === 0 ? (
            <div className="text-center py-8 text-slate-500 bg-slate-50 rounded-lg border-2 border-dashed border-slate-200">
              <Key className="h-8 w-8 mx-auto mb-2 text-slate-400" />
              <p>No personal credentials configured</p>
              <p className="text-sm">Click &ldquo;Add Credential&rdquo; to get started</p>
            </div>
          ) : (
            <div className="space-y-3">
              {personalCredentials.map((credential) => (
                <div key={credential.id} className="border rounded-lg">
                  <Collapsible
                    open={credential.isOpen}
                    onOpenChange={() => onToggleCredentialExpanded(credential.id)}
                  >
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
                            {credential.type === 'SSH_KEY' ? 'SSH Key' : credential.type} •{' '}
                            {credential.username || 'No username'}
                          </div>
                        </div>
                      </CollapsibleTrigger>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => onRemoveCredential(credential.id)}
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
                              onChange={(e) =>
                                onUpdateCredential(credential.id, 'name', e.target.value)
                              }
                              placeholder="Enter credential name"
                            />
                          </div>

                          {/* Credential Type */}
                          <div className="space-y-2">
                            <Label htmlFor={`cred-type-${credential.id}`}>Type</Label>
                            <Select
                              value={credential.type}
                              onValueChange={(value) =>
                                onUpdateCredential(credential.id, 'type', value)
                              }
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select type" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="SSH">SSH</SelectItem>
                                <SelectItem value="SSH_KEY">SSH Key</SelectItem>
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
                              onChange={(e) =>
                                onUpdateCredential(credential.id, 'username', e.target.value)
                              }
                              placeholder="Enter username"
                            />
                          </div>

                          {/* Password/Token - Hidden for SSH Key type */}
                          {credential.type !== 'SSH_KEY' && (
                            <div className="space-y-2">
                              <Label htmlFor={`cred-password-${credential.id}`}>
                                {credential.type === 'Token' ? 'Token' : 'Password'}
                              </Label>
                              <div className="relative">
                                <Input
                                  id={`cred-password-${credential.id}`}
                                  type={credential.showPassword ? 'text' : 'password'}
                                  value={credential.password}
                                  onChange={(e) =>
                                    onUpdateCredential(credential.id, 'password', e.target.value)
                                  }
                                  placeholder={
                                    credential.type === 'Token' ? 'Enter token' : 'Enter password'
                                  }
                                  className="pr-10"
                                  onFocus={() => {
                                    if (credential.password && /^•+$/.test(credential.password)) {
                                      onUpdateCredential(credential.id, 'password', '')
                                    }
                                  }}
                                />
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="absolute right-0 top-0 h-full px-3 py-2"
                                  onClick={() => onToggleCredentialPasswordVisibility(credential.id)}
                                >
                                  {credential.showPassword ? (
                                    <EyeOff className="h-4 w-4" />
                                  ) : (
                                    <Eye className="h-4 w-4" />
                                  )}
                                </Button>
                              </div>
                            </div>
                          )}

                          {/* SSH Key Upload - Only for SSH_KEY type */}
                          {credential.type === 'SSH_KEY' && (
                            <>
                              <div className="space-y-2 md:col-span-2">
                                <Label htmlFor={`cred-ssh-key-${credential.id}`}>SSH Private Key</Label>
                                <div className="flex items-center gap-2">
                                  <Input
                                    id={`cred-ssh-key-${credential.id}`}
                                    type="file"
                                    onChange={(e) => onSshKeyFileChange(credential.id, e)}
                                    className="flex-1"
                                  />
                                  {(credential.ssh_private_key || credential.has_ssh_key) && (
                                    <div className="flex items-center gap-1 text-green-600 text-sm">
                                      <Check className="h-4 w-4" />
                                      <span>
                                        {credential.has_ssh_key && !credential.ssh_private_key
                                          ? 'Key stored'
                                          : 'Key loaded'}
                                      </span>
                                    </div>
                                  )}
                                </div>
                                {credential.has_ssh_key && !credential.ssh_private_key && (
                                  <p className="text-sm text-slate-500">
                                    SSH key is already stored. Upload a new key to replace it.
                                  </p>
                                )}
                              </div>

                              <div className="space-y-2 md:col-span-2">
                                <Label htmlFor={`cred-ssh-passphrase-${credential.id}`}>
                                  SSH Key Passphrase (Optional)
                                </Label>
                                <div className="relative">
                                  <Input
                                    id={`cred-ssh-passphrase-${credential.id}`}
                                    type={credential.showSshPassphrase ? 'text' : 'password'}
                                    value={credential.ssh_passphrase || ''}
                                    onChange={(e) =>
                                      onUpdateCredential(
                                        credential.id,
                                        'ssh_passphrase',
                                        e.target.value,
                                      )
                                    }
                                    placeholder="Enter passphrase if key is encrypted"
                                    className="pr-10"
                                  />
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="absolute right-0 top-0 h-full px-3 py-2"
                                    onClick={() =>
                                      onToggleCredentialSshPassphraseVisibility(credential.id)
                                    }
                                  >
                                    {credential.showSshPassphrase ? (
                                      <EyeOff className="h-4 w-4" />
                                    ) : (
                                      <Eye className="h-4 w-4" />
                                    )}
                                  </Button>
                                </div>
                              </div>
                            </>
                          )}
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
  )
}
