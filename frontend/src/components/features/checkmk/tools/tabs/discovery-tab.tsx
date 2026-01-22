'use client'

import { Search, AlertCircle } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'

export function DiscoveryTab() {
  return (
    <div className="space-y-6">
      {/* Info Alert */}
      <Alert className="bg-blue-50 border-blue-200">
        <AlertCircle className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-blue-800">
          Service discovery features will be available soon. This section will allow you to discover and manage services on CheckMK hosts.
        </AlertDescription>
      </Alert>

      {/* Discovery Section */}
      <div className="shadow-lg border-0 p-0 bg-white rounded-lg">
        <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4 flex items-center justify-between rounded-t-lg">
          <div className="flex items-center space-x-2">
            <Search className="h-4 w-4" />
            <span className="text-sm font-medium">Service Discovery</span>
          </div>
          <div className="text-xs text-blue-100">
            Discover and manage CheckMK services
          </div>
        </div>
        <div className="p-6 bg-gradient-to-b from-white to-gray-50">
          <div className="text-center py-12 text-gray-500">
            <p className="text-lg font-medium">Coming Soon</p>
            <p className="text-sm mt-1">Service discovery features will be added in a future update</p>
          </div>
        </div>
      </div>
    </div>
  )
}
