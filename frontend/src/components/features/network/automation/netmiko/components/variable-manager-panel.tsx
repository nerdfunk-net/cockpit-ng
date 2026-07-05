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
    <div className="shadow-lg border-0 p-0 bg-card rounded-lg">
      <div className="panel-header py-2 px-4 flex items-center justify-between rounded-t-lg">
        <div className="flex items-center space-x-2">
          <span className="text-sm font-medium">Template Variables</span>
        </div>
        <div className="text-xs text-panel-header-muted">
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

          {variables.map(variable => (
            <div key={variable.id} className="flex items-start gap-2">
              <div className="flex-1 grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Input
                    placeholder="Variable name (e.g., hostname)"
                    value={variable.name}
                    onChange={e => updateVariable(variable.id, 'name', e.target.value)}
                    className={`border-2 ${
                      variable.name && !validateVariableName(variable.name)
                        ? 'border-destructive focus:border-destructive'
                        : 'border-border focus:border-primary'
                    } bg-card`}
                  />
                  {variable.name && !validateVariableName(variable.name) && (
                    <p className="text-xs text-destructive">
                      Invalid name. Use letters, numbers, underscore. Must start with
                      letter or underscore.
                    </p>
                  )}
                </div>
                <Input
                  placeholder="Value"
                  value={variable.value}
                  onChange={e => updateVariable(variable.id, 'value', e.target.value)}
                  className="border-2 border-border bg-card focus:border-primary"
                />
              </div>
              <Button
                onClick={() => removeVariable(variable.id)}
                size="icon"
                variant="ghost"
                className="h-10 w-10 text-destructive hover:text-destructive hover:bg-error"
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
