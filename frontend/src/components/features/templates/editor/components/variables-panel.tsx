'use client'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Lock, Plus, X } from 'lucide-react'
import type { TemplateVariable } from '../types'

interface VariablesPanelProps {
  variables: TemplateVariable[]
  selectedVariableId: string | null
  onSelectVariable: (id: string) => void
  onAddVariable: () => void
  onRemoveVariable: (id: string) => void
}

export function VariablesPanel({
  variables,
  selectedVariableId,
  onSelectVariable,
  onAddVariable,
  onRemoveVariable,
}: VariablesPanelProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b bg-gray-50">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
          Variables
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={onAddVariable}
          className="h-6 px-2 text-xs"
        >
          <Plus className="h-3 w-3 mr-1" />
          Add
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {variables.length === 0 && (
          <p className="text-xs text-gray-400 p-2 text-center">
            No variables. Select a category or add custom variables.
          </p>
        )}
        {variables.map((variable) => (
          <div
            key={variable.id}
            onClick={() => onSelectVariable(variable.id)}
            className={`flex items-center justify-between px-2 py-1.5 rounded cursor-pointer text-sm transition-colors ${
              selectedVariableId === variable.id
                ? 'bg-blue-100 text-blue-800'
                : 'hover:bg-gray-100'
            }`}
          >
            <div className="flex items-center gap-1.5 min-w-0">
              {variable.isDefault && (
                <Lock className="h-3 w-3 text-gray-400 flex-shrink-0" />
              )}
              <Badge
                variant={variable.isDefault ? 'secondary' : 'outline'}
                className="font-mono text-xs truncate"
              >
                {variable.name || '(unnamed)'}
              </Badge>
            </div>
            {!variable.isDefault && (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation()
                  onRemoveVariable(variable.id)
                }}
                className="h-5 w-5 p-0 text-gray-400 hover:text-red-500"
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
