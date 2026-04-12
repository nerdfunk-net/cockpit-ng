import { Button } from '@/components/ui/button'
import { Loader2, Save, Upload, X } from 'lucide-react'

interface RackActionsProps {
  hasChanges: boolean
  onSave: () => void
  onCancel: () => void
  isSaving?: boolean
  onImportPositions?: () => void
}

export function RackActions({
  hasChanges,
  onSave,
  onCancel,
  isSaving = false,
  onImportPositions,
}: RackActionsProps) {
  return (
    <div className="flex items-center justify-between pt-4 mt-4 border-t border-slate-200">
      <div>
        {onImportPositions && (
          <Button
            variant="outline"
            onClick={onImportPositions}
            disabled={isSaving}
            className="gap-2"
          >
            <Upload className="h-4 w-4" />
            Import Positions
          </Button>
        )}
      </div>
      <div className="flex items-center gap-3">
        <Button variant="outline" onClick={onCancel} disabled={isSaving} className="gap-2">
          <X className="h-4 w-4" />
          Cancel
        </Button>
        <Button onClick={onSave} disabled={!hasChanges || isSaving} className="gap-2">
          {isSaving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          {isSaving ? 'Saving…' : 'Save Rack'}
        </Button>
      </div>
    </div>
  )
}
