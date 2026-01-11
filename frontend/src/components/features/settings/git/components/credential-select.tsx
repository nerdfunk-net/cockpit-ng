// Credential Select Component with Filtering

import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { filterCredentialsByAuthType, getCredentialLabel, getCredentialPlaceholder } from '../utils'
import type { GitCredential } from '../types'

interface CredentialSelectProps {
  authType: string
  credentials: GitCredential[]
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}

export function CredentialSelect({
  authType,
  credentials,
  value,
  onChange,
  disabled = false,
}: CredentialSelectProps) {
  const filteredCredentials = filterCredentialsByAuthType(credentials, authType)

  return (
    <div className="space-y-2">
      <Label htmlFor="credential" className="text-sm font-semibold text-gray-800">
        {getCredentialLabel(authType)}
      </Label>
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger
          id="credential"
          className="border-2 border-gray-300 bg-white shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200"
        >
          <SelectValue placeholder={getCredentialPlaceholder(authType)} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">No credential selected</SelectItem>
          {filteredCredentials.map((cred, index) => {
            // Use ID in value to ensure uniqueness for RadixUI Select internal keys
            const credValue = cred.id ? `${cred.id}:${cred.name}` : `${cred.name}-${cred.source || 'general'}-${index}`
            const key = `cred-${cred.id || `${cred.name}-${cred.username}`}-${cred.type}-${cred.source || 'general'}-${index}`
            return (
              <SelectItem key={key} value={credValue}>
                {cred.name} ({cred.username}){cred.source === 'private' ? ' [private]' : ''}
              </SelectItem>
            )
          })}
        </SelectContent>
      </Select>
      <p className="text-xs text-gray-600">
        {authType === 'ssh_key'
          ? 'Select an SSH key credential for authentication'
          : authType === 'generic'
          ? 'Select a generic credential (username/password) for authentication'
          : 'Select a token credential for authentication'}
      </p>
    </div>
  )
}
