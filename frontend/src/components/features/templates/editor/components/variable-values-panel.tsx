'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { TemplateVariable } from '../types'

interface VariableValuesPanelProps {
  variables: TemplateVariable[]
  selectedVariableId: string | null
  onUpdateVariable: (id: string, field: 'name' | 'value', value: string) => void
}

export function VariableValuesPanel({
  variables,
  selectedVariableId,
  onUpdateVariable,
}: VariableValuesPanelProps) {
  const selectedVariable = selectedVariableId
    ? variables.find((v) => v.id === selectedVariableId)
    : null

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b border-t bg-gray-50">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
          Variable Details
        </span>
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        {!selectedVariable && (
          <p className="text-xs text-gray-400 text-center pt-4">
            Select a variable above to view its details.
          </p>
        )}
        {selectedVariable && (
          <div className="space-y-3">
            {/* Variable name */}
            <div className="space-y-1">
              <Label className="text-xs text-gray-500">Name</Label>
              {selectedVariable.isDefault ? (
                <p className="text-sm font-mono bg-gray-100 px-2 py-1.5 rounded">
                  {selectedVariable.name}
                </p>
              ) : (
                <Input
                  value={selectedVariable.name}
                  onChange={(e) =>
                    onUpdateVariable(selectedVariable.id, 'name', e.target.value)
                  }
                  placeholder="variable_name"
                  className="font-mono text-sm h-8"
                />
              )}
            </div>

            {/* Description (for default variables) */}
            {selectedVariable.description && (
              <div className="space-y-1">
                <Label className="text-xs text-gray-500">Description</Label>
                <p className="text-xs text-gray-600 bg-blue-50 px-2 py-1.5 rounded">
                  {selectedVariable.description}
                </p>
              </div>
            )}

            {/* Variable value */}
            <div className="space-y-1">
              <Label className="text-xs text-gray-500">Value</Label>
              {selectedVariable.isAutoFilled ? (
                <p className="text-xs text-gray-500 bg-gray-50 px-2 py-1.5 rounded italic">
                  Auto-filled at render time from backend context
                </p>
              ) : (
                <Input
                  value={selectedVariable.value}
                  onChange={(e) =>
                    onUpdateVariable(selectedVariable.id, 'value', e.target.value)
                  }
                  placeholder="Enter value..."
                  className="text-sm h-8"
                />
              )}
            </div>
          </div>
        )}

        {/* Quick overview of all variables when none selected */}
        {!selectedVariable && variables.length > 0 && (
          <div className="space-y-2 mt-2">
            {variables.map((v) => (
              <div key={v.id} className="flex items-center gap-2 text-xs">
                <span className="font-mono text-gray-700 font-medium min-w-[100px]">
                  {v.name || '(unnamed)'}
                </span>
                <span className="text-gray-400 truncate">
                  {v.isAutoFilled ? 'auto-filled' : v.value || '(empty)'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
