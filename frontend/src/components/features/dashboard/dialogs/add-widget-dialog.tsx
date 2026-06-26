'use client'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { WIDGET_REGISTRY } from '../registry/widget-registry'
import type { WidgetId } from '../types/dashboard'

interface AddWidgetDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  activeWidgetIds: Set<WidgetId>
  onAdd: (id: WidgetId) => void
}

export function AddWidgetDialog({
  open,
  onOpenChange,
  activeWidgetIds,
  onAdd,
}: AddWidgetDialogProps) {
  const availableWidgets = Object.values(WIDGET_REGISTRY).filter(
    w => !activeWidgetIds.has(w.id)
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Widget</DialogTitle>
          <DialogDescription>
            Choose a widget to add to your dashboard.
          </DialogDescription>
        </DialogHeader>
        {availableWidgets.length === 0 ? (
          <p className="text-sm text-slate-500 py-4 text-center">
            All available widgets are already on your dashboard.
          </p>
        ) : (
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {availableWidgets.map(widget => (
              <div
                key={widget.id}
                className="flex items-center justify-between p-3 rounded-lg border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900">{widget.title}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{widget.description}</p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    onAdd(widget.id)
                    onOpenChange(false)
                  }}
                  className="ml-3 shrink-0"
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Add
                </Button>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
