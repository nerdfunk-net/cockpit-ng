'use client'

import { Server } from 'lucide-react'

export function ServerPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="bg-blue-100 p-2 rounded-lg">
            <Server className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Server</h1>
            <p className="text-muted-foreground mt-2">Server management — coming soon.</p>
          </div>
        </div>
      </div>

      <div className="shadow-lg border-0 p-0 bg-white rounded-lg">
        <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4 flex items-center justify-between rounded-t-lg">
          <div className="flex items-center space-x-2">
            <Server className="h-4 w-4" />
            <span className="text-sm font-medium">Server Overview</span>
          </div>
        </div>
        <div className="p-6 bg-gradient-to-b from-white to-gray-50">
          <div className="text-center py-12 text-gray-500">
            <p className="text-lg font-medium">Server management is not yet available</p>
            <p className="text-sm mt-1">This feature is under development and will be available in a future release.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
