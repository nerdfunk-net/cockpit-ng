'use client'

import { GripHorizontal, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { WidgetId } from '../types/dashboard'

interface WidgetShellProps {
  id: WidgetId
  isEditing: boolean
  onRemove: (id: WidgetId) => void
  children: React.ReactNode
}

export function WidgetShell({ id, isEditing, onRemove, children }: WidgetShellProps) {
  return (
    <div className="relative h-full group">
      {isEditing && (
        <>
          <div
            className="drag-handle absolute top-0 left-0 right-0 z-10 h-7 flex items-center justify-center cursor-grab active:cursor-grabbing bg-muted/80 rounded-t-lg border-b border-border opacity-0 group-hover:opacity-100 transition-opacity"
            title="Drag to move"
          >
            <GripHorizontal className="h-4 w-4 text-muted-foreground" />
          </div>
          <button
            className={cn(
              'absolute top-1 right-1 z-20 p-1 rounded-full bg-error text-error-foreground hover:opacity-80 transition-opacity',
              'opacity-0 group-hover:opacity-100'
            )}
            onClick={e => {
              e.stopPropagation()
              onRemove(id)
            }}
            title="Remove widget"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </>
      )}
      <div className={cn('h-full', isEditing && 'pt-7')}>{children}</div>
    </div>
  )
}
