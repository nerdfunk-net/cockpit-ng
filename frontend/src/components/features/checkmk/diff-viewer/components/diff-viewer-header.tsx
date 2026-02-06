import { ArrowLeftRight, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface DiffViewerHeaderProps {
  loading: boolean
  onRunDiff: () => void
}

export function DiffViewerHeader({ loading, onRunDiff }: DiffViewerHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center space-x-3">
        <div className="bg-orange-100 p-2 rounded-lg">
          <ArrowLeftRight className="h-6 w-6 text-orange-600" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Diff Viewer</h1>
          <p className="text-gray-600 mt-1">
            Compare device inventories between Nautobot and CheckMK
          </p>
        </div>
      </div>

      <div className="flex items-center space-x-2">
        <Button onClick={onRunDiff} variant="outline" disabled={loading}>
          {loading ? (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500 mr-2" />
          ) : (
            <RotateCcw className="h-4 w-4 mr-2" />
          )}
          {loading ? 'Running...' : 'Run Diff'}
        </Button>
      </div>
    </div>
  )
}
