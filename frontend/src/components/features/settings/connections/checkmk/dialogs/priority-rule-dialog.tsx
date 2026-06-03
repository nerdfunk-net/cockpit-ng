'use client'

import { useCallback, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ExpressionBuilder } from '../components/expression-builder'
import type { CheckMKPriorityRule, ExpressionItem } from '../types'

interface PriorityRuleDialogProps {
  open: boolean
  onClose: () => void
  onSave: (data: { filename: string; expression: ExpressionItem[] }) => void
  rule?: CheckMKPriorityRule
  isSaving?: boolean
}

const DEFAULT_EXPRESSION: ExpressionItem[] = [
  { type: 'condition', key: 'role', value: '' },
]

export function PriorityRuleDialog({
  open,
  onClose,
  onSave,
  rule,
  isSaving = false,
}: PriorityRuleDialogProps) {
  const [filename, setFilename] = useState(rule?.filename ?? '')
  const [expression, setExpression] = useState<ExpressionItem[]>(
    rule?.expression ?? DEFAULT_EXPRESSION
  )

  const handleOpenChange = useCallback(
    (isOpen: boolean) => {
      if (!isOpen) onClose()
    },
    [onClose]
  )

  const handleSave = useCallback(() => {
    if (!filename.trim()) return
    onSave({ filename: filename.trim(), expression })
  }, [filename, expression, onSave])

  const isValid =
    filename.trim().endsWith('.yaml') &&
    !filename.includes('/') &&
    expression.every(
      (item) =>
        item.type === 'connector' ||
        (item.value.trim().length > 0 &&
          (item.key !== 'custom_field' || (item.field ?? '').trim().length > 0))
    )

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{rule ? 'Edit Priority Rule' : 'New Priority Rule'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-sm">Config filename</Label>
            <Input
              placeholder="checkmk_network.yaml"
              value={filename}
              onChange={(e) => setFilename(e.target.value)}
              className="h-8 text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Must end with .yaml, no path separators. File will be read from the
              config directory.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm">Match condition</Label>
            <ExpressionBuilder value={expression} onChange={setExpression} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!isValid || isSaving}>
            {isSaving ? 'Saving…' : rule ? 'Update' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
