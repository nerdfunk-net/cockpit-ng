'use client'

import { useState, useMemo, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-keys'
import { useDashboardLayoutQuery } from '@/hooks/queries/use-dashboard-layout-query'
import { useDashboardLayoutMutations } from '@/hooks/queries/use-dashboard-layout-mutations'
import { DashboardToolbar } from './components/dashboard-toolbar'
import { DashboardGrid } from './components/dashboard-grid'
import { AddWidgetDialog } from './dialogs/add-widget-dialog'
import { DEFAULT_LAYOUT } from './constants/default-layout'
import { WIDGET_REGISTRY } from './registry/widget-registry'
import type { DashboardLayoutDoc, DashboardLayoutItem, WidgetId } from './types/dashboard'

export function DashboardPage() {
  const queryClient = useQueryClient()
  const { data: savedLayout, isLoading } = useDashboardLayoutQuery()
  const { saveDashboardLayout } = useDashboardLayoutMutations()

  const [isEditing, setIsEditing] = useState(false)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [localLayout, setLocalLayout] = useState<DashboardLayoutDoc | null>(null)

  const activeLayout: DashboardLayoutDoc = localLayout ?? savedLayout ?? DEFAULT_LAYOUT

  const activeWidgetIds = useMemo(
    () => new Set((activeLayout.layouts.lg ?? []).map(item => item.i as WidgetId)),
    [activeLayout.layouts.lg]
  )

  const handleToggleEdit = useCallback(() => {
    setLocalLayout(activeLayout)
    setIsEditing(true)
  }, [activeLayout])

  const handleLayoutChange = useCallback((allLayouts: DashboardLayoutDoc['layouts']) => {
    setLocalLayout(prev => ({
      version: 1,
      layouts: {
        ...(prev?.layouts ?? DEFAULT_LAYOUT.layouts),
        ...allLayouts,
      },
    }))
  }, [])

  const handleDone = useCallback(() => {
    const layoutToSave = localLayout ?? activeLayout
    saveDashboardLayout.mutate(layoutToSave)
    setIsEditing(false)
  }, [localLayout, activeLayout, saveDashboardLayout])

  const handleReset = useCallback(() => {
    setLocalLayout(DEFAULT_LAYOUT)
  }, [])

  const handleRefresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all })
  }, [queryClient])

  const handleAddWidget = useCallback((id: WidgetId) => {
    const definition = WIDGET_REGISTRY[id]
    if (!definition) return

    setLocalLayout(prev => {
      const base = prev ?? activeLayout
      const newItem: DashboardLayoutItem = {
        i: id,
        x: 0,
        y: Infinity,
        w: definition.defaultSize.w,
        h: definition.defaultSize.h,
        minW: definition.defaultSize.minW,
        minH: definition.defaultSize.minH,
      }
      const updatedLayouts: DashboardLayoutDoc['layouts'] = {}
      for (const [bp, items] of Object.entries(base.layouts)) {
        if (items) {
          updatedLayouts[bp as keyof DashboardLayoutDoc['layouts']] = [
            ...items,
            newItem,
          ] as DashboardLayoutItem[]
        }
      }
      if (!updatedLayouts.lg) {
        updatedLayouts.lg = [newItem]
      }
      return { version: 1, layouts: updatedLayouts }
    })
  }, [activeLayout])

  const handleRemoveWidget = useCallback((id: WidgetId) => {
    setLocalLayout(prev => {
      const base = prev ?? activeLayout
      const updatedLayouts: DashboardLayoutDoc['layouts'] = {}
      for (const [bp, items] of Object.entries(base.layouts)) {
        if (items) {
          updatedLayouts[bp as keyof DashboardLayoutDoc['layouts']] = (
            items as DashboardLayoutItem[]
          ).filter(item => item.i !== id)
        }
      }
      return { version: 1, layouts: updatedLayouts }
    })
  }, [activeLayout])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse text-slate-500">Loading dashboard...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6 bg-slate-50/50 min-h-screen">
      <DashboardToolbar
        isEditing={isEditing}
        isSaving={saveDashboardLayout.isPending}
        onToggleEdit={handleToggleEdit}
        onDone={handleDone}
        onAddWidget={() => setIsAddDialogOpen(true)}
        onReset={handleReset}
        onRefresh={handleRefresh}
      />

      {isEditing && (
        <div className="rounded-lg border border-dashed border-blue-300 bg-blue-50/50 px-4 py-2 text-sm text-blue-600">
          Edit mode — drag cards to reposition, resize from the corner, or remove with ✕
        </div>
      )}

      <DashboardGrid
        layoutDoc={activeLayout}
        isEditing={isEditing}
        onLayoutChange={handleLayoutChange}
        onRemoveWidget={handleRemoveWidget}
      />

      <AddWidgetDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        activeWidgetIds={activeWidgetIds}
        onAdd={handleAddWidget}
      />
    </div>
  )
}
