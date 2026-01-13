import { RefreshCw, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface LiveUpdateHeaderProps {
  loading: boolean
  onReloadDevices: () => void
}

export function LiveUpdateHeader({
  loading,
  onReloadDevices
}: LiveUpdateHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center space-x-3">
        <div className="bg-green-100 p-2 rounded-lg">
          <RefreshCw className="h-6 w-6 text-green-600" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Live Update</h1>
          <p className="text-gray-600 mt-1">Monitor and sync device configurations in real-time</p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="flex items-center space-x-2">
        <Button
          onClick={onReloadDevices}
          variant="outline"
          disabled={loading}
        >
          {loading ? (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500 mr-2" />
          ) : (
            <RotateCcw className="h-4 w-4 mr-2" />
          )}
          Refresh
        </Button>
      </div>
    </div>
  )
}
