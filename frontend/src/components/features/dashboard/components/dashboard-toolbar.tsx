'use client'

import { Button } from '@/components/ui/button'
import { Settings2, Check, Plus, RotateCcw, RefreshCw } from 'lucide-react'

interface DashboardToolbarProps {
  isEditing: boolean
  isSaving: boolean
  onToggleEdit: () => void
  onDone: () => void
  onAddWidget: () => void
  onReset: () => void
  onRefresh: () => void
}

export function DashboardToolbar({
  isEditing,
  isSaving,
  onToggleEdit,
  onDone,
  onAddWidget,
  onReset,
  onRefresh,
}: DashboardToolbarProps) {
  return (
    <div className="flex items-center justify-between">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold text-slate-900">Cockpit Dashboard</h1>
        <p className="text-slate-600">
          Network infrastructure overview and real-time statistics
        </p>
      </div>
      <div className="flex items-center gap-2">
        {isEditing ? (
          <>
            <Button variant="outline" size="sm" onClick={onReset}>
              <RotateCcw className="h-4 w-4 mr-1.5" />
              Reset to default
            </Button>
            <Button variant="outline" size="sm" onClick={onAddWidget}>
              <Plus className="h-4 w-4 mr-1.5" />
              Add card
            </Button>
            <Button size="sm" onClick={onDone} disabled={isSaving}>
              {isSaving ? (
                <RefreshCw className="h-4 w-4 mr-1.5 animate-spin" />
              ) : (
                <Check className="h-4 w-4 mr-1.5" />
              )}
              Done
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={onRefresh}
              className="flex items-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={onToggleEdit}
              className="flex items-center gap-2"
            >
              <Settings2 className="h-4 w-4" />
              Customize
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
