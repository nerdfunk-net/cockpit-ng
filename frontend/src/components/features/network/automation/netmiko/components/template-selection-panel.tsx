import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { CheckCircle2, AlertCircle } from 'lucide-react'
import { LoadingButton } from '../ui/loading-button'
import type { Template } from '../types'
import type { DeviceInfo } from '@/components/shared/device-selector'

interface TemplateSelectionPanelProps {
  templates: Template[]
  selectedTemplateId: string
  selectedTemplate: Template | null
  editedTemplateContent: string
  isSavingTemplate: boolean
  setEditedTemplateContent: (content: string) => void
  handleTemplateChange: (templateId: string) => Promise<void>
  handleSaveTemplate: () => Promise<void>
  selectedDevices: DeviceInfo[]
  testDeviceId: string
  setTestDeviceId: (id: string) => void
  isTestingTemplate: boolean
  isLoadingNautobotData: boolean
  onTestTemplate: () => void
  onShowNautobotData: () => void
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
  selectedDevices,
  testDeviceId,
  setTestDeviceId,
  isTestingTemplate,
  isLoadingNautobotData,
  onTestTemplate,
  onShowNautobotData,
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

            {/* Template Configuration Display */}
            <div className="space-y-3 p-4 bg-blue-50 rounded-md border-2 border-blue-200">
              <Label className="text-sm font-semibold text-blue-900">Template Configuration</Label>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-blue-700">Execution Mode:</span>
                  <Badge
                    variant={
                      selectedTemplate.execution_mode === 'sync_to_nautobot' ? 'default' :
                      selectedTemplate.execution_mode === 'write_to_file' ? 'secondary' :
                      'outline'
                    }
                    className={
                      selectedTemplate.execution_mode === 'sync_to_nautobot' ? 'bg-green-100 text-green-800 border-green-300' :
                      selectedTemplate.execution_mode === 'write_to_file' ? 'bg-amber-100 text-amber-800 border-amber-300' :
                      'bg-slate-100 text-slate-800 border-slate-300'
                    }
                  >
                    {selectedTemplate.execution_mode === 'run_on_device' ? 'Run on Device' :
                     selectedTemplate.execution_mode === 'write_to_file' ? 'Write to File' :
                     selectedTemplate.execution_mode === 'sync_to_nautobot' ? 'Sync to Nautobot' :
                     'Run on Device (default)'}
                  </Badge>
                </div>
                {selectedTemplate.execution_mode === 'write_to_file' && selectedTemplate.file_path && (
                  <div className="flex items-start gap-2">
                    <span className="text-sm font-medium text-blue-700">File Path:</span>
                    <code className="text-xs font-mono bg-white px-2 py-1 rounded border border-blue-200 flex-1">
                      {selectedTemplate.file_path}
                    </code>
                  </div>
                )}
                {selectedTemplate.execution_mode === 'sync_to_nautobot' && (
                  <div className="text-xs text-green-700 mt-2">
                    ℹ️ This template will sync the rendered output to Nautobot when executed
                  </div>
                )}
              </div>
            </div>

            {/* Test Template Section */}
            <div className="space-y-3 p-4 bg-gray-50 rounded-md border border-gray-200">
              <Label className="text-sm font-medium">Test Template Rendering</Label>

              {selectedDevices.length === 0 ? (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Please select devices in the <strong>Devices</strong> tab first to test the template.
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-end gap-2">
                    <div className="flex-1 space-y-2">
                      <Label htmlFor="test-device-select" className="text-sm">
                        Select Device for Testing
                      </Label>
                      <Select value={testDeviceId} onValueChange={setTestDeviceId}>
                        <SelectTrigger className="border-2 border-slate-300 bg-white focus:border-blue-500">
                          <SelectValue placeholder="Choose a device..." />
                        </SelectTrigger>
                        <SelectContent>
                          {selectedDevices.map((device) => (
                            <SelectItem key={device.id} value={device.id}>
                              {device.name} ({typeof device.primary_ip4 === 'object' && device.primary_ip4?.address
                                ? device.primary_ip4.address.split('/')[0]
                                : (device.primary_ip4 as string) || 'No IP'})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <LoadingButton
                      onClick={onTestTemplate}
                      disabled={!testDeviceId}
                      isLoading={isTestingTemplate}
                      loadingText="Testing..."
                      className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400"
                    >
                      Test Template
                    </LoadingButton>
                    <LoadingButton
                      onClick={onShowNautobotData}
                      disabled={!testDeviceId}
                      isLoading={isLoadingNautobotData}
                      loadingText="Loading..."
                      variant="outline"
                      className="border-2 border-slate-300"
                    >
                      Show Nautobot Data
                    </LoadingButton>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
