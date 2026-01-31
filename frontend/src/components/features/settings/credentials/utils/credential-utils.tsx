import { Shield, FileKey, UserCheck, Key, Lock } from 'lucide-react'

/**
 * Get icon for credential type
 */
export function getTypeIcon(type: string) {
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
      return <Lock className="h-4 w-4 text-muted-foreground" />
  }
}
