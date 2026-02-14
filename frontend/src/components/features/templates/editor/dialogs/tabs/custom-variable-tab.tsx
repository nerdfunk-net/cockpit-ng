'use client'

import { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Plus } from 'lucide-react'
import type { VariableDefinition } from '../types'

interface CustomVariableTabProps {
  onAdd: (variable: VariableDefinition) => void
  existingVariableNames: string[]
}

export function CustomVariableTab({ onAdd, existingVariableNames }: CustomVariableTabProps) {
  const [name, setName] = useState('')
  const [value, setValue] = useState('')

  const nameError = name && existingVariableNames.includes(name)
    ? 'A variable with this name already exists'
    : ''

  const canAdd = name.trim().length > 0 && !nameError

  const handleAdd = useCallback(() => {
    if (!canAdd) return
    onAdd({
      name: name.trim(),
      value,
      type: 'custom',
      metadata: {},
    })
    setName('')
    setValue('')
  }, [canAdd, name, value, onAdd])

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="custom-var-name">Variable Name</Label>
        <Input
          id="custom-var-name"
          placeholder="my_variable"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={nameError ? 'border-red-300' : ''}
        />
        {nameError && (
          <p className="text-xs text-red-500">{nameError}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="custom-var-value">Value (optional)</Label>
        <Textarea
          id="custom-var-value"
          placeholder="Enter value or leave empty..."
          value={value}
          onChange={(e) => setValue(e.target.value)}
          rows={4}
          className="font-mono text-sm"
        />
      </div>

      <Button onClick={handleAdd} disabled={!canAdd} className="w-full">
        <Plus className="h-4 w-4 mr-1" />
        Add Variable
      </Button>
    </div>
  )
}
