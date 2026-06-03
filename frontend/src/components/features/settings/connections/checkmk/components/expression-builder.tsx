'use client'

import { useCallback } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { ExpressionCondition, ExpressionItem } from '../types'
import { SUPPORTED_EXPRESSION_KEYS } from '../utils/constants'

interface ExpressionBuilderProps {
  value: ExpressionItem[]
  onChange: (items: ExpressionItem[]) => void
}

const NEW_CONDITION: ExpressionCondition = {
  type: 'condition',
  key: 'role',
  value: '',
}

export function ExpressionBuilder({ value, onChange }: ExpressionBuilderProps) {
  const conditions = value.filter((item) => item.type === 'condition') as ExpressionCondition[]
  const connectors = value.filter((item) => item.type === 'connector')

  const updateCondition = useCallback(
    (index: number, patch: Partial<ExpressionCondition>) => {
      const conditionIndex = index * 2
      onChange(
        value.map((item, i) => {
          if (i !== conditionIndex) return item
          const updated = { ...item, ...patch } as ExpressionCondition
          if (patch.key && patch.key !== 'custom_field') {
            updated.field = undefined
          }
          return updated
        })
      )
    },
    [value, onChange]
  )

  const updateConnector = useCallback(
    (index: number, operator: 'and' | 'or') => {
      const connectorIndex = index * 2 + 1
      onChange(
        value.map((item, i) =>
          i === connectorIndex ? { type: 'connector', operator } : item
        )
      )
    },
    [value, onChange]
  )

  const addCondition = useCallback(() => {
    const newItems: ExpressionItem[] = [
      ...value,
      { type: 'connector', operator: 'and' },
      { ...NEW_CONDITION },
    ]
    onChange(newItems)
  }, [value, onChange])

  const removeCondition = useCallback(
    (conditionIndex: number) => {
      const flatIndex = conditionIndex * 2
      if (conditionIndex === 0) {
        // Remove first condition and the following connector (if any)
        onChange(value.slice(2))
      } else {
        // Remove the preceding connector and the condition
        onChange([
          ...value.slice(0, flatIndex - 1),
          ...value.slice(flatIndex + 1),
        ])
      }
    },
    [value, onChange]
  )

  return (
    <div className="space-y-2">
      {conditions.map((condition, idx) => (
        <div key={idx}>
          {idx > 0 && (
            <div className="flex items-center gap-2 my-1 ml-1">
              <Select
                value={connectors[idx - 1]?.type === 'connector'
                  ? (connectors[idx - 1] as { type: 'connector'; operator: string }).operator
                  : 'and'}
                onValueChange={(v) => updateConnector(idx - 1, v as 'and' | 'or')}
              >
                <SelectTrigger className="w-20 h-7 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="and">and</SelectItem>
                  <SelectItem value="or">or</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="flex items-center gap-2">
            <Select
              value={condition.key}
              onValueChange={(v) =>
                updateCondition(idx, { key: v as ExpressionCondition['key'] })
              }
            >
              <SelectTrigger className="w-36 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SUPPORTED_EXPRESSION_KEYS.map((k) => (
                  <SelectItem key={k.value} value={k.value} className="text-xs">
                    {k.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {condition.key === 'custom_field' && (
              <Input
                className="w-28 h-8 text-xs"
                placeholder="field name"
                value={condition.field ?? ''}
                onChange={(e) => updateCondition(idx, { field: e.target.value })}
              />
            )}

            <span className="text-xs text-muted-foreground">is</span>

            <Input
              className="flex-1 h-8 text-xs"
              placeholder="value"
              value={condition.value}
              onChange={(e) => updateCondition(idx, { value: e.target.value })}
            />

            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={() => removeCondition(idx)}
              disabled={conditions.length === 1}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      ))}

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-7 text-xs gap-1"
        onClick={addCondition}
      >
        <Plus className="h-3 w-3" />
        Add condition
      </Button>
    </div>
  )
}
