'use client'

import { useCallback, useMemo, useState } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { Plus, Save, Shield } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { PriorityRuleCard } from './priority-rule-card'
import { PriorityRuleDialog } from '../dialogs/priority-rule-dialog'
import { usePriorityRulesQuery } from '../hooks/use-priority-rules-query'
import { usePriorityRulesMutations } from '../hooks/use-priority-rules-mutations'
import type { CheckMKPriorityRule, ExpressionItem } from '../types'

const DEFAULT_RULE_ID = -1

interface DefaultRule {
  id: typeof DEFAULT_RULE_ID
  filename: 'checkmk.yaml'
}

const DEFAULT_RULE: DefaultRule = { id: DEFAULT_RULE_ID, filename: 'checkmk.yaml' }

const EMPTY_PRIORITY_RULES: CheckMKPriorityRule[] = []

interface PriorityRulesPanelProps {
  selectedFilename: string
  onSelectFilename: (filename: string) => void
}

export function PriorityRulesPanel({
  selectedFilename,
  onSelectFilename,
}: PriorityRulesPanelProps) {
  const { data: rules = EMPTY_PRIORITY_RULES, isLoading } = usePriorityRulesQuery()
  const { createRule, updateRule, deleteRule, reorderRules } =
    usePriorityRulesMutations()

  const [localOrder, setLocalOrder] = useState<number[] | null>(null)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [editingRule, setEditingRule] = useState<CheckMKPriorityRule | null>(null)

  const orderedRules = useMemo(() => {
    if (!localOrder) return rules
    const map = new Map(rules.map((r) => [r.id, r]))
    return localOrder.flatMap((id) => {
      const r = map.get(id)
      return r ? [r] : []
    })
  }, [rules, localOrder])

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      if (!over || active.id === over.id) return
      const ids = orderedRules.map((r) => r.id)
      const oldIndex = ids.indexOf(active.id as number)
      const newIndex = ids.indexOf(over.id as number)
      setLocalOrder(arrayMove(ids, oldIndex, newIndex))
    },
    [orderedRules]
  )

  const handleSaveOrder = useCallback(() => {
    if (!localOrder) return
    reorderRules.mutate(localOrder, {
      onSuccess: () => setLocalOrder(null),
    })
  }, [localOrder, reorderRules])

  const handleCreate = useCallback(
    (data: { filename: string; expression: ExpressionItem[] }) => {
      createRule.mutate(
        { priority_order: rules.length + 1, ...data },
        { onSuccess: () => setShowCreateDialog(false) }
      )
    },
    [createRule, rules.length]
  )

  const handleUpdate = useCallback(
    (data: { filename: string; expression: ExpressionItem[] }) => {
      if (!editingRule) return
      updateRule.mutate(
        { id: editingRule.id, ...data },
        { onSuccess: () => setEditingRule(null) }
      )
    },
    [editingRule, updateRule]
  )

  const handleDelete = useCallback(
    (id: number) => {
      deleteRule.mutate(id)
    },
    [deleteRule]
  )

  const sortableIds = useMemo(() => orderedRules.map((r) => r.id), [orderedRules])

  if (isLoading) {
    return <div className="p-3 text-xs text-muted-foreground">Loading rules…</div>
  }

  return (
    <div className="flex flex-col gap-2 h-full">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col gap-1.5 flex-1 overflow-y-auto min-h-0">
            {orderedRules.map((rule) => (
              <PriorityRuleCard
                key={rule.id}
                rule={rule}
                isSelected={selectedFilename === rule.filename}
                onSelect={() => onSelectFilename(rule.filename)}
                onEdit={() => setEditingRule(rule)}
                onDelete={() => handleDelete(rule.id)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {/* Default (non-deletable) rule */}
      {orderedRules.length > 0 && <Separator />}
      <div
        onClick={() => onSelectFilename(DEFAULT_RULE.filename)}
        className={`flex items-center gap-2 rounded-md border p-2.5 cursor-pointer transition-colors ${
          selectedFilename === DEFAULT_RULE.filename
            ? 'border-primary bg-primary/5'
            : 'border-border hover:border-primary/50 hover:bg-muted/30'
        }`}
      >
        <Shield className="h-4 w-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium">checkmk.yaml</p>
          <p className="text-[11px] text-muted-foreground">Default (always matches)</p>
        </div>
      </div>

      <div className="flex gap-2 pt-1">
        <Button
          variant="outline"
          size="sm"
          className="flex-1 h-8 text-xs gap-1"
          onClick={() => setShowCreateDialog(true)}
        >
          <Plus className="h-3.5 w-3.5" />
          Add Rule
        </Button>

        {localOrder && (
          <Button
            size="sm"
            className="flex-1 h-8 text-xs gap-1"
            onClick={handleSaveOrder}
            disabled={reorderRules.isPending}
          >
            <Save className="h-3.5 w-3.5" />
            Save Order
          </Button>
        )}
      </div>

      {showCreateDialog && (
        <PriorityRuleDialog
          open
          onClose={() => setShowCreateDialog(false)}
          onSave={handleCreate}
          isSaving={createRule.isPending}
        />
      )}

      {editingRule && (
        <PriorityRuleDialog
          open
          onClose={() => setEditingRule(null)}
          onSave={handleUpdate}
          rule={editingRule}
          isSaving={updateRule.isPending}
        />
      )}
    </div>
  )
}
