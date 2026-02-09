import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { CheckCircle2 } from 'lucide-react'
import { LoadingButton } from '../ui/loading-button'
import type { Template } from '../types'

interface TemplateSelectionPanelProps {
  templates: Template[]
  selectedTemplateId: string
  selectedTemplate: Template | null
  editedTemplateContent: string
  isSavingTemplate: boolean
  setEditedTemplateContent: (content: string) => void
  handleTemplateChange: (templateId: string) => Promise<void>
  handleSaveTemplate: () => Promise<void>
}

export function TemplateSelectionPanel({
  templates,
  selectedTemplateId,
  selectedTemplate,
  editedTemplateContent,
  isSavingTemplate,
  setEditedTemplateContent,
  handleTemplateChange,
  handleSaveTemplate,
}: TemplateSelectionPanelProps) {
  return (
    <div className="shadow-lg border-0 p-0 bg-white rounded-lg">
      <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4 flex items-center justify-between rounded-t-lg">
        <div className="flex items-center space-x-2">
          <span className="text-sm font-medium">Template Selection</span>
        </div>
        <div className="text-xs text-blue-100">
          Choose a Jinja2 template to generate commands for your devices
        </div>
      </div>
      <div className="p-6 space-y-4">
        {/* Template Selection Dropdown */}
        <div className="space-y-2">
          <Label htmlFor="template-select">Template</Label>
          <Select value={selectedTemplateId} onValueChange={handleTemplateChange}>
            <SelectTrigger className="border-2 border-slate-300 bg-white focus:border-blue-500">
              <SelectValue placeholder="Select a template..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No Template</SelectItem>
              {templates.map((template) => (
                <SelectItem key={template.id} value={template.id.toString()}>
                  {template.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Template Preview */}
        {selectedTemplate && (
          <>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Template Preview</Label>
                {selectedTemplate.scope === 'private' && (
                  <Badge variant="outline" className="text-xs">
                    Editable (Private)
                  </Badge>
                )}
              </div>
              <Textarea
                value={editedTemplateContent}
                onChange={(e) => setEditedTemplateContent(e.target.value)}
                readOnly={selectedTemplate.scope !== 'private'}
                rows={12}
                className={`font-mono text-sm border-2 resize-none ${
                  selectedTemplate.scope === 'private'
                    ? 'border-blue-300 bg-white'
                    : 'border-slate-300 bg-gray-50'
                }`}
                placeholder={selectedTemplate.scope === 'private' ? 'Edit your private template...' : ''}
              />
              {selectedTemplate.scope === 'private' && (
                <div className="flex justify-end">
                  <LoadingButton
                    onClick={handleSaveTemplate}
                    disabled={editedTemplateContent === selectedTemplate.content}
                    isLoading={isSavingTemplate}
                    loadingText="Saving..."
                    size="sm"
                    className="gap-2"
                    icon={<CheckCircle2 className="h-4 w-4" />}
                  >
                    Save Template
                  </LoadingButton>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
