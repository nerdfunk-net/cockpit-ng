/**
 * Snapshot Commands Tab
 * Manages command templates for snapshots
 */

'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Plus, Trash2, Save, Upload } from 'lucide-react'
import { useSnapshotTemplates } from '../hooks/use-snapshot-templates'
import { SaveTemplateDialog } from '../dialogs/save-template-dialog'
import { useToast } from '@/hooks/use-toast'
import type { SnapshotCommand } from '../types/snapshot-types'

interface CommandsTabProps {
  selectedTemplateId: number | null
  commands: Omit<SnapshotCommand, 'id' | 'template_id' | 'created_at'>[]
  onTemplateSelected: (templateId: number | null) => void
  onCommandsChanged: (commands: Omit<SnapshotCommand, 'id' | 'template_id' | 'created_at'>[]) => void
}

export function CommandsTab({
  selectedTemplateId,
  commands,
  onTemplateSelected,
  onCommandsChanged,
}: CommandsTabProps) {
  const { templates, loading: templatesLoading, loadTemplates } = useSnapshotTemplates()
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const { toast } = useToast()

  const handleAddCommand = () => {
    onCommandsChanged([
      ...commands,
      {
        command: '',
        use_textfsm: true,
        order: commands.length,
      },
    ])
  }

  const handleRemoveCommand = (index: number) => {
    const newCommands = commands.filter((_, i) => i !== index)
    // Re-index order
    const reindexed = newCommands.map((cmd, i) => ({ ...cmd, order: i }))
    onCommandsChanged(reindexed)
  }

  const handleCommandChange = (index: number, field: keyof SnapshotCommand, value: any) => {
    const newCommands = [...commands]
    newCommands[index] = { ...newCommands[index], [field]: value }
    onCommandsChanged(newCommands)
  }

  const handleTemplateLoad = (templateId: string) => {
    if (templateId === 'none') {
      onTemplateSelected(null)
      onCommandsChanged([])
      return
    }

    const template = templates.find(t => t.id.toString() === templateId)
    if (template) {
      onTemplateSelected(template.id)
      // Load commands from template
      const templateCommands = template.commands.map(cmd => ({
        command: cmd.command,
        use_textfsm: cmd.use_textfsm,
        order: cmd.order,
      }))
      onCommandsChanged(templateCommands)
      toast({
        title: 'Template Loaded',
        description: `Loaded ${template.commands.length} commands from "${template.name}"`,
      })
    }
  }

  const handleSaveSuccess = async () => {
    await loadTemplates()
    setShowSaveDialog(false)
    toast({
      title: 'Template Saved',
      description: 'Command template saved successfully',
    })
  }

  return (
    <div className="space-y-6">
      {/* Template Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Command Templates</CardTitle>
          <CardDescription>
            Load an existing template or create a new one
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <Label htmlFor="template-select">Load Template</Label>
              <Select
                value={selectedTemplateId?.toString() || 'none'}
                onValueChange={handleTemplateLoad}
                disabled={templatesLoading}
              >
                <SelectTrigger id="template-select">
                  <SelectValue placeholder="Select a template..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">-- None --</SelectItem>
                  {templates.map(template => (
                    <SelectItem key={template.id} value={template.id.toString()}>
                      {template.name} ({template.scope === 'private' ? 'Private' : 'Global'})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button
                onClick={() => setShowSaveDialog(true)}
                disabled={commands.length === 0}
                variant="outline"
              >
                <Save className="mr-2 h-4 w-4" />
                Save Template
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Commands List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Commands</CardTitle>
              <CardDescription>
                Add commands to execute on selected devices
              </CardDescription>
            </div>
            <Button onClick={handleAddCommand} size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Add Command
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {commands.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No commands added yet. Click "Add Command" to get started.
            </div>
          ) : (
            <div className="space-y-4">
              {commands.map((cmd, index) => (
                <div
                  key={index}
                  className="flex gap-4 items-start p-4 border rounded-lg"
                >
                  <div className="flex-1 space-y-2">
                    <div className="flex gap-4 items-center">
                      <span className="text-sm font-medium text-muted-foreground w-8">
                        #{index + 1}
                      </span>
                      <Input
                        placeholder="Enter command (e.g., show ip route)"
                        value={cmd.command}
                        onChange={(e) =>
                          handleCommandChange(index, 'command', e.target.value)
                        }
                        className="flex-1"
                      />
                    </div>
                    <div className="flex items-center space-x-2 ml-12">
                      <Checkbox
                        id={`textfsm-${index}`}
                        checked={cmd.use_textfsm}
                        onCheckedChange={(checked) =>
                          handleCommandChange(index, 'use_textfsm', checked)
                        }
                      />
                      <Label
                        htmlFor={`textfsm-${index}`}
                        className="text-sm font-normal"
                      >
                        Parse output with TextFSM
                      </Label>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveCommand(index)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Save Template Dialog */}
      <SaveTemplateDialog
        open={showSaveDialog}
        onOpenChange={setShowSaveDialog}
        commands={commands}
        onSaveSuccess={handleSaveSuccess}
      />
    </div>
  )
}
