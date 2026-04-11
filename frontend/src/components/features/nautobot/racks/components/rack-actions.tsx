import { Button } from '@/components/ui/button'
import { Save, X } from 'lucide-react'

interface RackActionsProps {
  hasChanges: boolean
  onSave: () => void
  onCancel: () => void
}

export function RackActions({ hasChanges, onSave, onCancel }: RackActionsProps) {
  return (
    <div className="flex items-center justify-end gap-3 pt-4 mt-4 border-t border-slate-200">
      <Button variant="outline" onClick={onCancel} className="gap-2">
        <X className="h-4 w-4" />
        Cancel
      </Button>
      <Button onClick={onSave} disabled={!hasChanges} className="gap-2">
        <Save className="h-4 w-4" />
        Save Rack
      </Button>
    </div>
  )
}
