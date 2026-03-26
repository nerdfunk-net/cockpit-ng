import { Loader2 } from 'lucide-react'

export function SyncLoadingState() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500 mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">Loading metadata...</p>
      </div>
    </div>
  )
}
