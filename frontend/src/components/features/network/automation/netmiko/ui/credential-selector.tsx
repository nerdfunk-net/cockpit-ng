import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { StoredCredential } from '../types'

interface CredentialSelectorProps {
  storedCredentials: StoredCredential[]
  selectedCredentialId: string
  username: string
  password: string
  onCredentialChange: (credId: string) => void
  onUsernameChange: (username: string) => void
  onPasswordChange: (password: string) => void
}

export function CredentialSelector({
  storedCredentials,
  selectedCredentialId,
  username,
  password,
  onCredentialChange,
  onUsernameChange,
  onPasswordChange,
}: CredentialSelectorProps) {
  return (
    <div className="space-y-4">
      {/* Credentials Selection */}
      <div className="space-y-2">
        <Label htmlFor="credential-select">Credentials *</Label>
        <Select value={selectedCredentialId} onValueChange={onCredentialChange}>
          <SelectTrigger className="border-2 border-slate-300 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 shadow-sm">
            <SelectValue placeholder="Select credentials..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="manual">Enter SSH Credentials</SelectItem>
            {storedCredentials.map((cred) => (
              <SelectItem key={cred.id} value={cred.id.toString()}>
                {cred.name} ({cred.username})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Manual Credentials Input */}
      {selectedCredentialId === 'manual' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="username">SSH Username *</Label>
            <Input
              id="username"
              type="text"
              placeholder="Enter SSH username"
              value={username}
              onChange={(e) => onUsernameChange(e.target.value)}
              className="border-2 border-slate-300 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 shadow-sm"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">SSH Password *</Label>
            <Input
              id="password"
              type="password"
              placeholder="Enter SSH password"
              value={password}
              onChange={(e) => onPasswordChange(e.target.value)}
              className="border-2 border-slate-300 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 shadow-sm"
            />
          </div>
        </div>
      )}

      {/* Stored credential info */}
      {selectedCredentialId !== 'manual' && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-md">
          <p className="text-sm text-green-800">
            Using stored credentials: <strong>{storedCredentials.find(c => c.id.toString() === selectedCredentialId)?.name}</strong>
          </p>
        </div>
      )}
    </div>
  )
}
