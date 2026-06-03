'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { CheckMKPriorityRule, ExpressionCondition, ExpressionConnector } from '../types'

interface PriorityRuleCardProps {
  rule: CheckMKPriorityRule
  isSelected: boolean
  onSelect: () => void
  onEdit: () => void
  onDelete: () => void
}

function formatExpression(expression: CheckMKPriorityRule['expression']): string {
  return expression
    .map((item) => {
      if (item.type === 'condition') {
        const cond = item as ExpressionCondition
        const keyLabel =
          cond.key === 'custom_field' ? `${cond.key}.${cond.field ?? ''}` : cond.key
        return `${keyLabel} = ${cond.value}`
      }
      return (item as ExpressionConnector).operator
    })
    .join(' ')
}

export function PriorityRuleCard({
  rule,
  isSelected,
  onSelect,
  onEdit,
  onDelete,
}: PriorityRuleCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: rule.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={onSelect}
      className={`group flex items-start gap-2 rounded-md border p-2.5 cursor-pointer transition-colors ${
        isSelected
          ? 'border-primary bg-primary/5'
          : 'border-border hover:border-primary/50 hover:bg-muted/30'
      }`}
    >
      <button
        {...attributes}
        {...listeners}
        className="mt-0.5 shrink-0 cursor-grab text-muted-foreground hover:text-foreground active:cursor-grabbing"
        onClick={(e) => e.stopPropagation()}
        aria-label="Drag to reorder"
      >
        <GripVertical className="h-4 w-4" />
      </button>

      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-foreground">
          {rule.filename}
        </p>
        <p className="truncate text-[11px] text-muted-foreground mt-0.5">
          {formatExpression(rule.expression)}
        </p>
      </div>

      <div className="flex shrink-0 gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={(e) => {
            e.stopPropagation()
            onEdit()
          }}
        >
          <Pencil className="h-3 w-3" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-destructive hover:text-destructive"
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  )
}
