/**
 * Inventory Page - Main Component
 * Uses shared DeviceSelector component for building and managing device inventories
 */

'use client'

import { useState, useEffect } from 'react'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { List } from 'lucide-react'
import { useAuthStore } from '@/lib/auth-store'

// Import shared DeviceSelector
import { DeviceSelector } from '@/components/shared/device-selector'

export default function AnsibleInventoryPage() {
  const { isAuthenticated, token } = useAuthStore()

  // Authentication state
  const [authReady, setAuthReady] = useState(false)

  // Authentication effect
  useEffect(() => {
    if (isAuthenticated && token && !authReady) {
      setAuthReady(true)
    }
  }, [isAuthenticated, token, authReady])

  // Loading state
  if (!authReady) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500" />
              Loading Inventory Builder
            </CardTitle>
            <CardDescription>
              Establishing authentication and initializing inventory tools...
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="bg-blue-100 p-2 rounded-lg">
            <List className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Inventory Builder</h1>
            <p className="text-muted-foreground mt-2">Build dynamic device inventories using logical operations</p>
          </div>
        </div>
      </div>

      {/* Device Selector */}
      <DeviceSelector
        showActions={true}
        showSaveLoad={true}
        enableSelection={false}
      />
    </div>
  )
}
