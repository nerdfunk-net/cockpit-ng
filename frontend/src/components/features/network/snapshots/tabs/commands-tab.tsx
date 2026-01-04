/**
 * Snapshot Commands Tab
 * Manages command templates for snapshots
 */

'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus, Trash2, Save } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { SnapshotCommand } from '../types/snapshot-types'
import { useSnapshotTemplates } from '../hooks/use-snapshot-templates'
import { SaveTemplateDialog } from '../dialogs/save-template-dialog'

interface CommandsTabProps {
  selectedTemplateId: number | null
  commands: Omit<SnapshotCommand, 'id' | 'template_id' | 'created_at'>[]
  onTemplateChange: (templateId: number | null) => void
  onCommandsChange: (commands: Omit<SnapshotCommand, 'id' | 'template_id' | 'created_at'>[]) => void
}

export function CommandsTab({
  selectedTemplateId: parentTemplateId,
  commands: parentCommands,
  onTemplateChange,
  onCommandsChange,
}: CommandsTabProps) {
  const {
    templates,
  } = useSnapshotTemplates()

  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(parentTemplateId?.toString() || 'none')
  const [commands, setCommands] = useState<SnapshotCommand[]>(
    parentCommands.map((cmd, idx) => ({ ...cmd, id: idx + 1, order: idx }))
  )
  const [showSaveDialog, setShowSaveDialog] = useState(false)

  // Sync local commands with parent
  useEffect(() => {
    const mappedCommands = commands.map(({ command, use_textfsm, order }) => ({
      command,
      use_textfsm,
      order,
    }))
    onCommandsChange(mappedCommands)
  }, [commands, onCommandsChange])

  const handleTemplateChange = (value: string) => {
    setSelectedTemplateId(value)
    
    // Notify parent of template change
    onTemplateChange(value === 'none' ? null : parseInt(value))
    
    if (value === 'none') {
      setCommands([])
    } else {
      const template = templates.find(t => t.id === parseInt(value))
      if (template) {
        setCommands(template.commands)
      }
    }
  }

  const handleAddCommand = () => {
    const newCommand: SnapshotCommand = {
      id: Date.now(),
      command: '',
      use_textfsm: false,
      order: commands.length,
    }
    setCommands([...commands, newCommand])
  }

  const handleRemoveCommand = (id: number) => {
    setCommands(commands.filter(cmd => cmd.id !== id))
  }

  const handleUpdateCommand = (id: number, field: keyof SnapshotCommand, value: string | boolean) => {
    setCommands(commands.map(cmd => 
      cmd.id === id ? { ...cmd, [field]: value } : cmd
    ))
  }

  const handleSaveTemplate = () => {
    if (commands.length === 0) {
      alert('Please add at least one command before saving.')
      return
    }
    setShowSaveDialog(true)
  }

  return (
    <div className="space-y-6">
      {/* Template Selection Section */}
      <div className="shadow-lg border-0 p-0 bg-white rounded-lg">
        <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4 flex items-center justify-between rounded-t-lg">
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium">Command Template</span>
          </div>
          <div className="text-xs text-blue-100">
            Select an existing template or create a new one
          </div>
        </div>
        <div className="p-6 bg-gradient-to-b from-white to-gray-50">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="template-select">Template</Label>
              <Select value={selectedTemplateId} onValueChange={handleTemplateChange}>
                <SelectTrigger id="template-select">
                  <SelectValue placeholder="Select a template" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No template (manual commands)</SelectItem>
                  {templates.map(template => (
                    <SelectItem key={template.id} value={template.id.toString()}>
                      {template.name} ({template.scope})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedTemplateId !== 'none' && (
              <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded-md">
                <p className="font-medium">Description:</p>
                <p>{templates.find(t => t.id === parseInt(selectedTemplateId))?.description}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Commands Section */}
      <div className="shadow-lg border-0 p-0 bg-white rounded-lg">
        <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4 flex items-center justify-between rounded-t-lg">
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium">Commands</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleAddCommand}
              className="bg-white text-blue-600 hover:bg-blue-50 border-0"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Command
            </Button>
            {commands.length > 0 && (
              <Button
                variant="secondary"
                size="sm"
                onClick={handleSaveTemplate}
                className="bg-white text-blue-600 hover:bg-blue-50 border-0"
              >
                <Save className="h-4 w-4 mr-2" />
                Save Template
              </Button>
            )}
          </div>
        </div>
        <div className="p-6 bg-gradient-to-b from-white to-gray-50">
          {commands.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <p className="text-lg font-medium">No commands added yet</p>
              <p className="text-sm mt-1">Click &quot;Add Command&quot; to get started</p>
            </div>
          ) : (
            <div className="space-y-2">
              {commands.map((cmd) => (
                <div key={cmd.id} className="flex items-center gap-2 p-2 border rounded-md bg-white shadow-sm hover:shadow-md transition-shadow group">
                  <Input
                    id={`command-${cmd.id}`}
                    value={cmd.command}
                    onChange={(e) => handleUpdateCommand(cmd.id!, 'command', e.target.value)}
                    placeholder="Enter command (e.g., show ip route)"
                    className="flex-1 font-mono text-sm h-8 focus:ring-2 focus:ring-blue-500"
                  />
                  <div className="flex items-center gap-1.5">
                    <Checkbox
                      id={`textfsm-${cmd.id}`}
                      checked={cmd.use_textfsm}
                      onCheckedChange={(checked) => 
                        handleUpdateCommand(cmd.id!, 'use_textfsm', checked as boolean)
                      }
                      className="h-4 w-4"
                    />
                    <label 
                      htmlFor={`textfsm-${cmd.id}`} 
                      className="text-xs text-gray-600 cursor-pointer whitespace-nowrap hover:text-gray-900"
                      title="Parse output using TextFSM templates"
                    >
                      TextFSM
                    </label>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveCommand(cmd.id!)}
                    className="h-8 w-8 p-0 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Remove command"
                  >
                    <Trash2 className="h-4 w-4 text-red-600" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Save Template Dialog */}
      <SaveTemplateDialog
        open={showSaveDialog}
        onOpenChange={setShowSaveDialog}
        commands={commands.map(({ command, use_textfsm, order }) => ({
          command,
          use_textfsm,
          order,
        }))}
        onSaveSuccess={() => setShowSaveDialog(false)}
      />
    </div>
  )
}
