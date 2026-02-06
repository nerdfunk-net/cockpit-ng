import { ArrowLeftRight } from 'lucide-react'

export function DiffViewerHeader() {
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
    </div>
  )
}
