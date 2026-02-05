import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
import { Plus, Trash2 } from 'lucide-react'

interface TemplateVariable {
  id: string
  name: string
  value: string
}

interface Template {
  id: number
  name: string
  content: string
  category: string
  scope: 'global' | 'private'
}

interface VariablesAndTemplatesTabProps {
  variables: TemplateVariable[]
  useNautobotContext: boolean
  onVariablesChange: () => void
  onVariableUpdate: (id: string, field: 'name' | 'value', value: string) => void
  onVariableRemove: (id: string) => void
  onUseNautobotContextChange: (checked: boolean) => void
  templates: Template[]
  selectedTemplateId: string
  onTemplateChange: (templateId: string) => void
  editedTemplateContent: string
  onTemplateContentChange: (content: string) => void
}

export function VariablesAndTemplatesTab({
  variables,
  useNautobotContext,
  onVariablesChange,
  onVariableUpdate,
  onVariableRemove,
  onUseNautobotContextChange,
  templates,
  selectedTemplateId,
  onTemplateChange,
  editedTemplateContent,
  onTemplateContentChange
}: VariablesAndTemplatesTabProps) {
  const selectedTemplate = templates.find(t => t.id.toString() === selectedTemplateId)

  return (
    <div className="space-y-6">
      {/* Variables Section */}
      <div className="shadow-lg border-0 p-0 bg-white rounded-lg">
        <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4 flex items-center justify-between rounded-t-lg">
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium">Template Variables</span>
          </div>
          <div className="text-xs text-blue-100">
            Define variables to use in your templates
          </div>
        </div>
        <div className="p-6 space-y-4">
          <div className="flex items-center space-x-3 p-3 bg-blue-50 border border-blue-200 rounded-md">
            <Checkbox
              id="nautobot-context"
              checked={useNautobotContext}
              onCheckedChange={onUseNautobotContextChange}
            />
            <div className="flex-1">
              <Label htmlFor="nautobot-context" className="font-medium cursor-pointer">
                Use Nautobot data & context
              </Label>
              <p className="text-xs text-gray-600 mt-1">
                When enabled, Nautobot device data will be available in the template context
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Custom Variables</Label>
              <Button
                onClick={onVariablesChange}
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
                  <Input
                    placeholder="Variable name"
                    value={variable.name}
                    onChange={(e) => onVariableUpdate(variable.id, 'name', e.target.value)}
                    className="border-2"
                  />
                  <Input
                    placeholder="Value"
                    value={variable.value}
                    onChange={(e) => onVariableUpdate(variable.id, 'value', e.target.value)}
                    className="border-2"
                  />
                </div>
                {variables.length > 1 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onVariableRemove(variable.id)}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Template Selection */}
      <div className="shadow-lg border-0 p-0 bg-white rounded-lg">
        <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4 flex items-center justify-between rounded-t-lg">
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium">Template Selection</span>
          </div>
          <div className="text-xs text-blue-100">
            Choose a Jinja2 template to render for your devices
          </div>
        </div>
        <div className="p-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="template">Template</Label>
            <Select
              value={selectedTemplateId}
              onValueChange={onTemplateChange}
            >
              <SelectTrigger id="template">
                <SelectValue placeholder="Select a template" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No template selected</SelectItem>
                {templates.map((template) => (
                  <SelectItem key={template.id} value={template.id.toString()}>
                    {template.name} ({template.scope})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedTemplate && (
            <div className="space-y-2">
              <Label htmlFor="template-preview">Template Preview</Label>
              <Textarea
                id="template-preview"
                value={editedTemplateContent}
                onChange={(e) => onTemplateContentChange(e.target.value)}
                className="font-mono text-sm min-h-[300px] border-2"
                readOnly={selectedTemplate.scope === 'global'}
              />
              {selectedTemplate.scope === 'global' && (
                <p className="text-sm text-gray-500">
                  Global templates are read-only
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
