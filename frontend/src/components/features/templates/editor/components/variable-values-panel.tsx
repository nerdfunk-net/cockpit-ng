'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Play, RefreshCw } from 'lucide-react'
import type { TemplateVariable } from '../types'

interface VariableValuesPanelProps {
  variables: TemplateVariable[]
  selectedVariableId: string | null
  onUpdateVariable: (id: string, field: 'name' | 'value', value: string) => void
  onExecutePreRun?: () => Promise<void>
}

export function VariableValuesPanel({
  variables,
  selectedVariableId,
  onUpdateVariable,
  onExecutePreRun,
}: VariableValuesPanelProps) {
  const selectedVariable = selectedVariableId
    ? variables.find((v) => v.id === selectedVariableId)
    : null

  const handleExecuteCommand = async () => {
    if (!selectedVariable || !selectedVariable.requiresExecution || !onExecutePreRun) {
      return
    }
    
    await onExecutePreRun()
  }

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
            {/* Variable name - only for custom variables */}
            {!selectedVariable.isDefault && (
              <div className="space-y-1">
                <Label className="text-xs text-gray-500">Name</Label>
                <Input
                  value={selectedVariable.name}
                  onChange={(e) =>
                    onUpdateVariable(selectedVariable.id, 'name', e.target.value)
                  }
                  placeholder="variable_name"
                  className="font-mono text-sm h-8"
                />
              </div>
            )}

            {/* Variable value */}
            <div className="space-y-1">
              <Label className="text-xs text-gray-500">Value</Label>
              {selectedVariable.isAutoFilled ? (
                selectedVariable.value ? (
                  <pre className="text-xs bg-gray-50 px-2 py-1.5 rounded border border-gray-200 overflow-auto max-h-[400px] font-mono">
                    {selectedVariable.value}
                  </pre>
                ) : selectedVariable.requiresExecution ? (
                  <div className="space-y-2">
                    <div className="text-xs text-orange-600 bg-orange-50 px-3 py-2 rounded border border-orange-200">
                      <p className="font-medium mb-1">⚡ Command Execution Required</p>
                      <p className="text-gray-600">
                        Execute the pre-run command to populate both <code className="font-mono bg-orange-100 px-1">pre_run.raw</code> and <code className="font-mono bg-orange-100 px-1">pre_run.parsed</code> variables.
                      </p>
                    </div>
                    <Button
                      type="button"
                      onClick={handleExecuteCommand}
                      disabled={selectedVariable.isExecuting}
                      size="sm"
                      className="w-full bg-blue-600 hover:bg-blue-700"
                    >
                      {selectedVariable.isExecuting ? (
                        <>
                          <RefreshCw className="h-3 w-3 mr-2 animate-spin" />
                          Executing Command...
                        </>
                      ) : (
                        <>
                          <Play className="h-3 w-3 mr-2" />
                          Execute Pre-Run Command
                        </>
                      )}
                    </Button>
                  </div>
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
