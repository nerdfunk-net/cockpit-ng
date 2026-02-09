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
            {/* Variable value */}
            <div className="space-y-1">
              <Label className="text-xs text-gray-500">Value</Label>
              {selectedVariable.isAutoFilled ? (
                selectedVariable.value ? (
                  <pre className="text-xs bg-gray-50 px-2 py-1.5 rounded border border-gray-200 overflow-auto max-h-[400px] font-mono">
                    {selectedVariable.value}
                  </pre>
                ) : (
                  <p className="text-xs text-gray-500 bg-gray-50 px-2 py-1.5 rounded italic">
                    Auto-filled at render time from backend context
                  </p>
                )
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
              <div key={v.id} className="flex items-start gap-2 text-xs">
                <span className="font-mono text-gray-700 font-medium min-w-[100px] flex-shrink-0">
                  {v.name || '(unnamed)'}
                </span>
                <span className="text-gray-400 truncate">
                  {v.isAutoFilled 
                    ? (v.value ? `${v.value.substring(0, 50)}...` : 'auto-filled') 
                    : (v.value || '(empty)')}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
