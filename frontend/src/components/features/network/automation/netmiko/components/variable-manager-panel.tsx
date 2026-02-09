import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Plus, Trash2 } from 'lucide-react'
import type { TemplateVariable } from '../types'

interface VariableManagerPanelProps {
  variables: TemplateVariable[]
  addVariable: () => void
  removeVariable: (id: string) => void
  updateVariable: (id: string, field: 'name' | 'value', value: string) => void
  validateVariableName: (name: string) => boolean
}

export function VariableManagerPanel({
  variables,
  addVariable,
  removeVariable,
  updateVariable,
  validateVariableName,
}: VariableManagerPanelProps) {
  return (
    <div className="shadow-lg border-0 p-0 bg-white rounded-lg">
      <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4 flex items-center justify-between rounded-t-lg">
        <div className="flex items-center space-x-2">
          <span className="text-sm font-medium">Template Variables</span>
        </div>
        <div className="text-xs text-blue-100">
          Define variables that will be used in your Jinja2 template
        </div>
      </div>
      <div className="p-6 space-y-4">
        {/* Variables List */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">Custom Variables</Label>
            <Button
              onClick={addVariable}
              size="sm"
              variant="outline"
              className="flex items-center gap-1"
            >
              <Plus className="h-4 w-4" />
              Add Variable
            </Button>
          </div>

          {variables.map((variable) => (
            <div key={variable.id} className="flex items-start gap-2">
              <div className="flex-1 grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Input
                    placeholder="Variable name (e.g., hostname)"
                    value={variable.name}
                    onChange={(e) => updateVariable(variable.id, 'name', e.target.value)}
                    className={`border-2 ${
                      variable.name && !validateVariableName(variable.name)
                        ? 'border-red-500 focus:border-red-500'
                        : 'border-slate-300 focus:border-blue-500'
                    } bg-white`}
                  />
                  {variable.name && !validateVariableName(variable.name) && (
                    <p className="text-xs text-red-600">
                      Invalid name. Use letters, numbers, underscore. Must start with letter or underscore.
                    </p>
                  )}
                </div>
                <Input
                  placeholder="Value"
                  value={variable.value}
                  onChange={(e) => updateVariable(variable.id, 'value', e.target.value)}
                  className="border-2 border-slate-300 bg-white focus:border-blue-500"
                />
              </div>
              <Button
                onClick={() => removeVariable(variable.id)}
                size="icon"
                variant="ghost"
                className="h-10 w-10 text-red-600 hover:text-red-700 hover:bg-red-50"
                disabled={variables.length === 1}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
