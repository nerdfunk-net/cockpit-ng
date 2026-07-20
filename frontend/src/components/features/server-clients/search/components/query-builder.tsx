'use client'

import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import type { ServerSearchFacets } from '../types'
import {
  NUMERIC_FIELDS,
  SEARCH_FIELD_LABELS,
  STRING_FIELDS,
  createEmptyGroup,
  createEmptyRule,
  isSearchGroup,
  type SearchFieldName,
  type SearchGroup,
  type SearchOp,
  type SearchRule,
} from '../types'

const ALL_FIELDS = Object.keys(SEARCH_FIELD_LABELS) as SearchFieldName[]

interface QueryBuilderProps {
  group: SearchGroup
  onChange: (group: SearchGroup) => void
  facets?: ServerSearchFacets
  depth?: number
}

function defaultOpForField(field: SearchFieldName): SearchOp {
  if (NUMERIC_FIELDS.includes(field)) return 'gt'
  if (field === 'is_virtual') return 'eq'
  return 'eq'
}

function defaultValueForField(field: SearchFieldName): SearchRule['value'] {
  if (field === 'memtotal_mb') return 8
  if (field === 'disk_total_gb') return 100
  if (field === 'disk_usage_pct') return 80
  if (NUMERIC_FIELDS.includes(field)) return 1
  if (field === 'is_virtual') return true
  return ''
}

function opsForField(field: SearchFieldName): SearchOp[] {
  if (NUMERIC_FIELDS.includes(field)) return ['gt', 'lt', 'eq']
  if (field === 'is_virtual') return ['eq']
  return ['eq', 'in']
}

function facetOptions(
  field: SearchFieldName,
  facets?: ServerSearchFacets
): string[] {
  if (!facets) return []
  if (field === 'os_family') return facets.os_family
  if (field === 'distribution') return facets.distribution
  if (field === 'distribution_version') return facets.distribution_version
  return []
}

function RuleEditor({
  rule,
  onChange,
  onRemove,
  facets,
  canRemove,
}: {
  rule: SearchRule
  onChange: (rule: SearchRule) => void
  onRemove: () => void
  facets?: ServerSearchFacets
  canRemove: boolean
}) {
  const ops = opsForField(rule.field)
  const options = facetOptions(rule.field, facets)

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="space-y-2">
        <Label className="text-sm">Field</Label>
        <Select
          value={rule.field}
          onValueChange={(field) => {
            const next = field as SearchFieldName
            onChange({
              ...rule,
              field: next,
              op: defaultOpForField(next),
              value: defaultValueForField(next),
            })
          }}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ALL_FIELDS.map((field) => (
              <SelectItem key={field} value={field}>
                {SEARCH_FIELD_LABELS[field]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label className="text-sm">Operator</Label>
        <Select
          value={rule.op}
          onValueChange={(op) => {
            const nextOp = op as SearchOp
            let value = rule.value
            if (nextOp === 'in' && !Array.isArray(value)) {
              value = typeof value === 'string' && value ? [value] : []
            } else if (nextOp !== 'in' && Array.isArray(value)) {
              value = value[0] ?? ''
            }
            onChange({ ...rule, op: nextOp, value })
          }}
        >
          <SelectTrigger className="w-[110px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ops.map((op) => (
              <SelectItem key={op} value={op}>
                {op === 'gt' ? '>' : op === 'lt' ? '<' : op === 'eq' ? '=' : 'in'}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2 min-w-[120px] flex-1">
        <Label className="text-sm">Value</Label>
        {rule.field === 'is_virtual' ? (
          <Select
            value={rule.value === true ? 'yes' : 'no'}
            onValueChange={(v) => onChange({ ...rule, value: v === 'yes' })}
          >
            <SelectTrigger className="w-[110px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="yes">Yes</SelectItem>
              <SelectItem value="no">No</SelectItem>
            </SelectContent>
          </Select>
        ) : STRING_FIELDS.includes(rule.field) && rule.op === 'eq' ? (
          <Select
            value={typeof rule.value === 'string' ? rule.value : ''}
            onValueChange={(v) => onChange({ ...rule, value: v })}
          >
            <SelectTrigger className="min-w-[160px] w-full">
              <SelectValue placeholder="Select…" />
            </SelectTrigger>
            <SelectContent>
              {options.map((opt) => (
                <SelectItem key={opt} value={opt}>
                  {opt}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : STRING_FIELDS.includes(rule.field) && rule.op === 'in' ? (
          <Input
            className="min-w-[200px] w-full"
            placeholder="Comma-separated values"
            value={Array.isArray(rule.value) ? rule.value.join(', ') : ''}
            onChange={(e) =>
              onChange({
                ...rule,
                value: e.target.value
                  .split(',')
                  .map((s) => s.trim())
                  .filter(Boolean),
              })
            }
          />
        ) : (
          <Input
            type="number"
            className="w-[120px]"
            value={typeof rule.value === 'number' ? rule.value : ''}
            onChange={(e) =>
              onChange({
                ...rule,
                value: e.target.value === '' ? 0 : Number(e.target.value),
              })
            }
          />
        )}
      </div>

      {canRemove && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onRemove}
          aria-label="Remove rule"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      )}
    </div>
  )
}

export function QueryBuilder({
  group,
  onChange,
  facets,
  depth = 0,
}: QueryBuilderProps) {
  const updateRule = (index: number, next: SearchRule | SearchGroup) => {
    const rules = group.rules.slice()
    rules[index] = next
    onChange({ ...group, rules })
  }

  const removeAt = (index: number) => {
    onChange({ ...group, rules: group.rules.filter((_, i) => i !== index) })
  }

  return (
    <div
      className={cn(
        'space-y-4',
        depth > 0 && 'p-4 bg-muted border border-border rounded-lg shadow-sm'
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">Match</span>
        <Select
          value={group.combinator}
          onValueChange={(v) =>
            onChange({ ...group, combinator: v as 'and' | 'or' })
          }
        >
          <SelectTrigger className="w-[90px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="and">AND</SelectItem>
            <SelectItem value="or">OR</SelectItem>
          </SelectContent>
        </Select>
        <Button
          type="button"
          variant={group.not ? 'default' : 'outline'}
          size="sm"
          onClick={() => onChange({ ...group, not: !group.not })}
        >
          NOT
        </Button>
        <div className="ml-auto flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              onChange({ ...group, rules: [...group.rules, createEmptyRule()] })
            }
          >
            <Plus className="h-4 w-4 mr-2" />
            Rule
          </Button>
          {depth < 4 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                onChange({
                  ...group,
                  rules: [...group.rules, createEmptyGroup()],
                })
              }
            >
              <Plus className="h-4 w-4 mr-2" />
              Group
            </Button>
          )}
        </div>
      </div>

      <div className="space-y-4">
        {group.rules.map((item) =>
          isSearchGroup(item) ? (
            <div key={item.id} className="relative">
              <QueryBuilder
                group={item}
                facets={facets}
                depth={depth + 1}
                onChange={(next) =>
                  updateRule(
                    group.rules.findIndex((r) => r.id === item.id),
                    next
                  )
                }
              />
              {group.rules.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-2 top-2"
                  onClick={() =>
                    removeAt(group.rules.findIndex((r) => r.id === item.id))
                  }
                  aria-label="Remove group"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ) : (
            <RuleEditor
              key={item.id}
              rule={item}
              facets={facets}
              canRemove={group.rules.length > 1}
              onChange={(next) =>
                updateRule(
                  group.rules.findIndex((r) => r.id === item.id),
                  next
                )
              }
              onRemove={() =>
                removeAt(group.rules.findIndex((r) => r.id === item.id))
              }
            />
          )
        )}
      </div>
    </div>
  )
}
