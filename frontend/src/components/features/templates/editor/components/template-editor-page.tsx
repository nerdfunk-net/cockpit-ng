'use client'

import { useState, useCallback, Suspense } from 'react'
import { useWatch } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import { FileCode, Play, Save, RefreshCw } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { useTemplateMutations } from '@/components/features/settings/templates/hooks/use-template-mutations'

import { useTemplateEditor } from '../hooks/use-template-editor'
import { useTemplateRender } from '../hooks/use-template-render'
import { GeneralPanel } from './general-panel'
import { AgentOptionsPanel } from './agent-options-panel'
import { VariablesPanel } from './variables-panel'
import { VariableValuesPanel } from './variable-values-panel'
import { CodeEditorPanel } from './code-editor-panel'
import { RenderedOutputDialog } from './rendered-output-dialog'

function TemplateEditorContent() {
  const { toast } = useToast()
  const editor = useTemplateEditor()
  const renderer = useTemplateRender()
  const { createTemplate, updateTemplate } = useTemplateMutations()

  const [selectedVariableId, setSelectedVariableId] = useState<string | null>(null)

  const watchedContent = useWatch({ control: editor.form.control, name: 'content' })
  const watchedTemplateType = useWatch({
    control: editor.form.control,
    name: 'template_type',
  })
  const watchedCategory = useWatch({ control: editor.form.control, name: 'category' })

  const handleContentChange = useCallback(
    (value: string) => {
      editor.setContent(value)
    },
    [editor.setContent]
  )

  const handleRender = useCallback(async () => {
    const formData = editor.form.getValues()
    await renderer.render({
      content: formData.content,
      category: formData.category,
      variables: editor.variableManager.variables,
      inventoryId: formData.inventoryId,
      passSnmpMapping: formData.passSnmpMapping,
      path: formData.path,
    })
  }, [editor.form, editor.variableManager.variables, renderer])

  const handleSave = useCallback(async () => {
    const isValid = await editor.form.trigger()
    if (!isValid) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      })
      return
    }

    const formData = editor.form.getValues()

    // Build the variables record from user-defined variables
    const variables: Record<string, string> = {}
    for (const v of editor.variableManager.variables) {
      if (v.name && !v.isAutoFilled) {
        variables[v.name] = v.value
      }
    }

    const templateData = {
      name: formData.name,
      source: 'webeditor' as const,
      template_type: formData.template_type,
      category: formData.category,
      description: formData.description,
      scope: formData.scope,
      content: formData.content,
      variables,
      use_nautobot_context: formData.category === 'agent',
    }

    try {
      if (editor.isEditMode && editor.templateId) {
        await updateTemplate.mutateAsync({
          templateId: editor.templateId,
          formData: templateData,
        })
      } else {
        await createTemplate.mutateAsync({
          formData: templateData,
        })
      }
    } catch {
      // Error toast handled by mutation hooks
    }
  }, [editor, createTemplate, updateTemplate, toast])

  if (editor.isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="flex items-center gap-3 text-gray-600">
          <RefreshCw className="h-5 w-5 animate-spin" />
          <span>Loading template...</span>
        </div>
      </div>
    )
  }

  const isSaving = createTemplate.isPending || updateTemplate.isPending

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center space-x-3">
        <div className="bg-purple-100 p-2 rounded-lg">
          <FileCode className="h-6 w-6 text-purple-600" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {editor.isEditMode ? 'Edit Template' : 'Template Editor'}
          </h1>
          <p className="text-gray-600 mt-1">
            Create and edit Jinja2 templates with variable support and live preview
          </p>
        </div>
      </div>

      {/* General Panel */}
      <GeneralPanel form={editor.form} />

      {/* Agent Options (conditional) */}
      {watchedCategory === 'agent' && <AgentOptionsPanel form={editor.form} />}

      {/* Main Split Area */}
      <div className="grid grid-cols-1 lg:grid-cols-[350px_1fr] gap-4" style={{ minHeight: '500px' }}>
        {/* Left: Variables */}
        <div className="flex flex-col overflow-hidden border rounded-lg shadow-sm bg-white">
          <div className="flex-[2] min-h-0 overflow-hidden">
            <VariablesPanel
              variables={editor.variableManager.variables}
              selectedVariableId={selectedVariableId}
              onSelectVariable={setSelectedVariableId}
              onAddVariable={editor.variableManager.addVariable}
              onRemoveVariable={editor.variableManager.removeVariable}
            />
          </div>
          <div className="flex-[3] min-h-0 overflow-hidden">
            <VariableValuesPanel
              variables={editor.variableManager.variables}
              selectedVariableId={selectedVariableId}
              onUpdateVariable={editor.variableManager.updateVariable}
            />
          </div>
        </div>

        {/* Right: Code Editor */}
        <div className="overflow-hidden border rounded-lg shadow-sm">
          <CodeEditorPanel
            value={watchedContent}
            onChange={handleContentChange}
            language={watchedTemplateType}
          />
        </div>
      </div>

      {/* Bottom Buttons */}
      <div className="flex items-center justify-between pt-2 border-t">
        <Button
          variant="outline"
          onClick={handleRender}
          disabled={renderer.isRendering || !watchedContent.trim()}
          className="border-blue-300 text-blue-700 hover:bg-blue-50"
        >
          {renderer.isRendering ? (
            <RefreshCw className="h-4 w-4 animate-spin mr-1" />
          ) : (
            <Play className="h-4 w-4 mr-1" />
          )}
          {renderer.isRendering ? 'Rendering...' : 'Show Rendered Template'}
        </Button>

        <Button
          onClick={handleSave}
          disabled={isSaving}
          className="bg-green-600 hover:bg-green-700"
        >
          {isSaving && <RefreshCw className="h-4 w-4 animate-spin mr-1" />}
          <Save className="h-4 w-4 mr-1" />
          {editor.isEditMode ? 'Update Template' : 'Save Template'}
        </Button>
      </div>

      {/* Rendered Output Dialog */}
      <RenderedOutputDialog
        open={renderer.showDialog}
        onOpenChange={renderer.setShowDialog}
        result={renderer.renderResult}
      />
    </div>
  )
}

export function TemplateEditorPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-24">
          <div className="flex items-center gap-3 text-gray-600">
            <RefreshCw className="h-5 w-5 animate-spin" />
            <span>Loading editor...</span>
          </div>
        </div>
      }
    >
      <TemplateEditorContent />
    </Suspense>
  )
}
