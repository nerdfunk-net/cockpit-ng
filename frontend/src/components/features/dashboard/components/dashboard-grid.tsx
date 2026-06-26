'use client'

import { useMemo } from 'react'
import { Responsive, WidthProvider } from 'react-grid-layout/legacy'
import type { Layout, LayoutItem, ResponsiveLayouts } from 'react-grid-layout/legacy'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'
import { WIDGET_REGISTRY } from '../registry/widget-registry'
import { WidgetShell } from './widget-shell'
import type { DashboardLayoutDoc, DashboardLayoutItem, WidgetId } from '../types/dashboard'

const ResponsiveGrid = WidthProvider(Responsive)

interface DashboardGridProps {
  layoutDoc: DashboardLayoutDoc
  isEditing: boolean
  onLayoutChange: (allLayouts: DashboardLayoutDoc['layouts']) => void
  onRemoveWidget: (id: WidgetId) => void
}

function toRglLayouts(doc: DashboardLayoutDoc): ResponsiveLayouts {
  const result: ResponsiveLayouts = {}
  for (const [bp, items] of Object.entries(doc.layouts)) {
    if (items) {
      result[bp] = items.map(item => ({
        i: item.i,
        x: item.x,
        y: item.y,
        w: item.w,
        h: item.h,
        minW: item.minW,
        minH: item.minH,
      }))
    }
  }
  return result
}

function fromRglLayouts(allLayouts: ResponsiveLayouts): DashboardLayoutDoc['layouts'] {
  const result: DashboardLayoutDoc['layouts'] = {}
  for (const [bp, items] of Object.entries(allLayouts)) {
    result[bp as keyof DashboardLayoutDoc['layouts']] = (items as Layout).map(
      (item: LayoutItem) => ({
        i: item.i as WidgetId,
        x: item.x,
        y: item.y,
        w: item.w,
        h: item.h,
        minW: item.minW,
        minH: item.minH,
      })
    ) as DashboardLayoutItem[]
  }
  return result
}

export function DashboardGrid({
  layoutDoc,
  isEditing,
  onLayoutChange,
  onRemoveWidget,
}: DashboardGridProps) {
  const activeIds = useMemo(
    () => new Set((layoutDoc.layouts.lg ?? []).map(item => item.i)),
    [layoutDoc.layouts.lg]
  )

  const rglLayouts = useMemo(() => toRglLayouts(layoutDoc), [layoutDoc])

  const handleLayoutChange = (_current: Layout, allLayouts: ResponsiveLayouts) => {
    onLayoutChange(fromRglLayouts(allLayouts))
  }

  return (
    <ResponsiveGrid
      layouts={rglLayouts}
      breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
      cols={{ lg: 10, md: 8, sm: 6, xs: 4, xxs: 2 }}
      rowHeight={60}
      isDraggable={isEditing}
      isResizable={isEditing}
      draggableHandle=".drag-handle"
      onLayoutChange={handleLayoutChange}
      margin={[16, 16]}
      containerPadding={[0, 0]}
    >
      {Array.from(activeIds).map(id => {
        const widgetId = id as WidgetId
        const definition = WIDGET_REGISTRY[widgetId]
        if (!definition) return null
        const WidgetComponent = definition.component
        return (
          <div key={widgetId}>
            <WidgetShell id={widgetId} isEditing={isEditing} onRemove={onRemoveWidget}>
              <WidgetComponent />
            </WidgetShell>
          </div>
        )
      })}
    </ResponsiveGrid>
  )
}
