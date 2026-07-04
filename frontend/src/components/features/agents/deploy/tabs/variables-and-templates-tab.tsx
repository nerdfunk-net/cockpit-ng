import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2 } from 'lucide-react'

interface TemplateVariable {
  value: string
  type: 'custom' | 'inventory'
  metadata: Record<string, unknown>
}

interface Template {
  id: number
  name: string
  content: string
  category: string
  scope: 'global' | 'private'
  use_nautobot_context: boolean
  pass_snmp_mapping: boolean
  variables?: Record<string, TemplateVariable>
}

interface TemplateListItem {
  id: number
  name: string
  scope: 'global' | 'private'
}

interface VariablesAndTemplatesTabProps {
  templates: TemplateListItem[]
  selectedTemplateId: string
  selectedTemplate: Template | null
  isLoadingTemplate: boolean
  onTemplateChange: (templateId: string) => void
  editedTemplateContent: string
  onTemplateContentChange: (content: string) => void
  variableOverrides: Record<string, string>
  onVariableOverrideChange: (name: string, value: string) => void
}

export function VariablesAndTemplatesTab({
  templates,
  selectedTemplateId,
  selectedTemplate,
  isLoadingTemplate,
  onTemplateChange,
  editedTemplateContent,
  onTemplateContentChange,
  variableOverrides,
  onVariableOverrideChange,
}: VariablesAndTemplatesTabProps) {
  // Extract custom variables from the selected template
  const customVariables = selectedTemplate?.variables
    ? Object.entries(selectedTemplate.variables)
        .filter(([, variable]) => variable.type === 'custom')
        .map(([name, variable]) => ({
          name,
          defaultValue: variable.value,
          currentValue: variableOverrides[name] ?? variable.value,
        }))
    : []

  return (
    <div className="space-y-6">
      {/* Template Selection - Now at the top */}
      <div className="shadow-lg border-0 p-0 bg-card rounded-lg">
        <div className="panel-header py-2 px-4 flex items-center justify-between rounded-t-lg">
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium">Template Selection</span>
          </div>
          <div className="text-xs text-panel-header-muted">
            Choose a Jinja2 template to render for your devices
          </div>
        </div>
        <div className="p-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="template">Template</Label>
            <Select value={selectedTemplateId} onValueChange={onTemplateChange}>
              <SelectTrigger id="template">
                <SelectValue placeholder="Select a template" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No template selected</SelectItem>
                {templates.map(template => (
                  <SelectItem key={template.id} value={template.id.toString()}>
                    {template.name} ({template.scope})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isLoadingTemplate && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span className="ml-2 text-sm text-muted-foreground">
                Loading template details...
              </span>
            </div>
          )}

          {!isLoadingTemplate && selectedTemplate && (
            <>
              <div className="p-3 bg-muted border border-border rounded-md space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-medium text-foreground">
                      Template Configuration:
                    </span>
                    <span className="text-sm text-muted-foreground">
                      Use Nautobot data & context is{' '}
                      <span
                        className={
                          selectedTemplate.use_nautobot_context
                            ? 'font-semibold text-success-foreground'
                            : 'font-semibold text-muted-foreground'
                        }
                      >
                        {selectedTemplate.use_nautobot_context ? 'enabled' : 'disabled'}
                      </span>
                    </span>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-medium text-foreground">
                    SNMP Mapping:
                  </span>
                  <span className="text-sm text-muted-foreground">
                    Pass SNMP mapping is{' '}
                    <span
                      className={
                        selectedTemplate.pass_snmp_mapping
                          ? 'font-semibold text-success-foreground'
                          : 'font-semibold text-muted-foreground'
                      }
                    >
                      {selectedTemplate.pass_snmp_mapping ? 'enabled' : 'disabled'}
                    </span>
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="template-preview">Template Preview</Label>
                <Textarea
                  id="template-preview"
                  value={editedTemplateContent}
                  onChange={e => onTemplateContentChange(e.target.value)}
                  className="font-mono text-sm min-h-[300px] border-2"
                  readOnly={selectedTemplate.scope === 'global'}
                />
                {selectedTemplate.scope === 'global' && (
                  <p className="text-sm text-muted-foreground">
                    Global templates are read-only
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Custom Variables Section - Only shown when template has custom variables */}
      {!isLoadingTemplate && selectedTemplate && customVariables.length > 0 && (
        <div className="shadow-lg border-0 p-0 bg-card rounded-lg">
          <div className="panel-header py-2 px-4 flex items-center justify-between rounded-t-lg">
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium">Template Variables</span>
            </div>
            <div className="text-xs text-panel-header-muted">
              Override custom variable values
            </div>
          </div>
          <div className="p-6 space-y-4">
            <p className="text-sm text-muted-foreground mb-4">
              The selected template contains custom variables. You can override their
              default values below:
            </p>
            <div className="space-y-3">
              {customVariables.map(({ name, defaultValue, currentValue }) => (
                <div key={name} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor={`var-${name}`} className="text-sm font-medium">
                      {name}
                    </Label>
                    <span className="text-xs text-muted-foreground">
                      Default: {defaultValue}
                    </span>
                  </div>
                  <Input
                    id={`var-${name}`}
                    placeholder={`Override value for ${name}`}
                    value={currentValue}
                    onChange={e => onVariableOverrideChange(name, e.target.value)}
                    className="border-2"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Info message when no custom variables */}
      {!isLoadingTemplate && selectedTemplate && customVariables.length === 0 && (
        <div className="shadow-lg border-0 p-0 bg-card rounded-lg">
          <div className="panel-header py-2 px-4 flex items-center justify-between rounded-t-lg">
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium">Template Variables</span>
            </div>
          </div>
          <div className="p-6">
            <p className="text-sm text-muted-foreground">
              This template does not have any custom variables that can be overridden.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
