'use client'

import React from 'react'
import { useAuthStore } from '@/lib/auth-store'
import { useSessionManager } from '@/hooks/use-session-manager'
import { Badge } from '@/components/ui/badge'
import { Clock, Activity, RefreshCw } from 'lucide-react'

interface SessionStatusProps {
  showDetails?: boolean
  className?: string
}

export function SessionStatus({ showDetails = false, className = '' }: SessionStatusProps) {
  const { token, user } = useAuthStore()
  const { isUserActive, getTimeSinceActivity, refreshToken } = useSessionManager()

  // Don't show anything if not authenticated
  if (!token || !user) {
    return null
  }

  // Parse token to get expiry
  const getTokenExpiry = (token: string): Date | null => {
    try {
      const base64Url = token.split('.')[1]
      if (!base64Url) return null
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      )
      const decoded = JSON.parse(jsonPayload)
      return decoded.exp ? new Date(decoded.exp * 1000) : null
    } catch {
      return null
    }
  }

  const tokenExpiry = getTokenExpiry(token)
  const now = new Date()
  const timeUntilExpiry = tokenExpiry ? tokenExpiry.getTime() - now.getTime() : 0
  const minutesUntilExpiry = Math.floor(timeUntilExpiry / (1000 * 60))

  // Format time since activity
  const formatTimeSince = (ms: number): string => {
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)

    if (hours > 0) return `${hours}h ${minutes % 60}m`
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`
    return `${seconds}s`
  }

  if (!showDetails) {
    // Simple status badge
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <Badge variant={isUserActive() ? 'default' : 'secondary'} className="text-xs">
          <Activity className="h-3 w-3 mr-1" />
          {isUserActive() ? 'Active' : 'Idle'}
        </Badge>
        
        {tokenExpiry && (
          <Badge 
            variant={minutesUntilExpiry < 3 ? 'destructive' : minutesUntilExpiry < 5 ? 'secondary' : 'outline'} 
            className="text-xs"
          >
            <Clock className="h-3 w-3 mr-1" />
            {minutesUntilExpiry}m
          </Badge>
        )}
      </div>
    )
  }

  // Detailed session information
  return (
    <div className={`bg-white border border-slate-200 rounded-lg p-4 shadow-sm ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-slate-900">Session Status</h3>
        <button
          onClick={() => refreshToken()}
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
        
        {tokenExpiry && (
          <>
            <div className="flex justify-between">
              <span>Token Expires:</span>
              <span>{tokenExpiry.toLocaleTimeString()}</span>
            </div>
            
            <div className="flex justify-between">
              <span>Time Remaining:</span>
              <Badge 
                variant={minutesUntilExpiry < 3 ? 'destructive' : minutesUntilExpiry < 5 ? 'secondary' : 'outline'} 
                className="text-xs"
              >
                <Clock className="h-3 w-3 mr-1" />
                {minutesUntilExpiry > 0 ? `${minutesUntilExpiry}m` : 'Expired'}
              </Badge>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
