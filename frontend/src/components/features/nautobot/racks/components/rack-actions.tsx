import { Button } from '@/components/ui/button'
import { Loader2, Save, X } from 'lucide-react'

interface RackActionsProps {
  hasChanges: boolean
  onSave: () => void
  onCancel: () => void
  isSaving?: boolean
}

export function RackActions({ hasChanges, onSave, onCancel, isSaving = false }: RackActionsProps) {
  return (
    <div className="flex items-center justify-end gap-3 pt-4 mt-4 border-t border-slate-200">
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
  )
}
