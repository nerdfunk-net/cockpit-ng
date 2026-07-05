import { Shield, FileKey, UserCheck, Key, Lock } from 'lucide-react'

/**
 * Get icon for credential type
 */
export function getTypeIcon(type: string) {
  switch (type) {
    case 'ssh':
      return <Shield className="h-4 w-4 text-primary" />
    case 'ssh_key':
      return <FileKey className="h-4 w-4 text-muted-foreground" />
    case 'tacacs':
      return <UserCheck className="h-4 w-4 text-muted-foreground" />
    case 'token':
      return <Key className="h-4 w-4 text-muted-foreground" />
    default:
      return <Lock className="h-4 w-4 text-muted-foreground" />
  }
}
