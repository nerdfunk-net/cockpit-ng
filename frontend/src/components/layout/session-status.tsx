'use client'

import { useAuthStore } from '@/lib/auth-store'
import { useSessionManager } from '@/hooks/use-session-manager'
import { Badge } from '@/components/ui/badge'
import { Activity, RefreshCw } from 'lucide-react'

interface SessionStatusProps {
  showDetails?: boolean
  className?: string
}

export function SessionStatus({
  showDetails = false,
  className = '',
}: SessionStatusProps) {
  const { user, isAuthenticated } = useAuthStore()
  const { isUserActive, getTimeSinceActivity, refreshSession } = useSessionManager()

  if (!isAuthenticated || !user) {
    return null
  }

  const formatTimeSince = (ms: number): string => {
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)

    if (hours > 0) return `${hours}h ${minutes % 60}m`
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`
    return `${seconds}s`
  }

  if (!showDetails) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <Badge variant={isUserActive() ? 'default' : 'secondary'} className="text-xs">
          <Activity className="h-3 w-3 mr-1" />
          {isUserActive() ? 'Active' : 'Idle'}
        </Badge>
      </div>
    )
  }

  return (
    <div
      className={`bg-white border border-slate-200 rounded-lg p-4 shadow-sm ${className}`}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-slate-900">Session Status</h3>
        <button
          onClick={() => refreshSession()}
          className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
        >
          <RefreshCw className="h-3 w-3" />
          Refresh
        </button>
      </div>

      <div className="space-y-2 text-xs text-slate-600">
        <div className="flex justify-between">
          <span>User:</span>
          <span className="font-medium">{user.username}</span>
        </div>

        <div className="flex justify-between">
          <span>Status:</span>
          <Badge variant={isUserActive() ? 'default' : 'secondary'} className="text-xs">
            <Activity className="h-3 w-3 mr-1" />
            {isUserActive() ? 'Active' : 'Idle'}
          </Badge>
        </div>

        <div className="flex justify-between">
          <span>Last Activity:</span>
          <span>{formatTimeSince(getTimeSinceActivity())} ago</span>
        </div>
      </div>
    </div>
  )
}
