import { VariableManagerPanel } from '../components/variable-manager-panel'
import { TemplateSelectionPanel } from '../components/template-selection-panel'
import type { Template, TemplateVariable } from '../types'

interface VariablesAndTemplatesTabProps {
  // Variables
  variables: TemplateVariable[]
  addVariable: () => void
  removeVariable: (id: string) => void
  updateVariable: (id: string, field: 'name' | 'value', value: string) => void
  validateVariableName: (name: string) => boolean
  // Templates
  templates: Template[]
  selectedTemplateId: string
  selectedTemplate: Template | null
  editedTemplateContent: string
  isSavingTemplate: boolean
  setEditedTemplateContent: (content: string) => void
  handleTemplateChange: (templateId: string) => Promise<void>
  handleSaveTemplate: () => Promise<void>
}

export function VariablesAndTemplatesTab(props: VariablesAndTemplatesTabProps) {

  return (
    <div className="space-y-6">
      <VariableManagerPanel
        variables={props.variables}
        addVariable={props.addVariable}
        removeVariable={props.removeVariable}
        updateVariable={props.updateVariable}
        validateVariableName={props.validateVariableName}
      />

      <TemplateSelectionPanel
        templates={props.templates}
        selectedTemplateId={props.selectedTemplateId}
        selectedTemplate={props.selectedTemplate}
        editedTemplateContent={props.editedTemplateContent}
        isSavingTemplate={props.isSavingTemplate}
        setEditedTemplateContent={props.setEditedTemplateContent}
        handleTemplateChange={props.handleTemplateChange}
        handleSaveTemplate={props.handleSaveTemplate}
      />
    </div>
  )
}
