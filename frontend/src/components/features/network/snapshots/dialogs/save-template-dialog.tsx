/**
 * Save Template Dialog
 * Dialog for saving command templates
 */

'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { useSnapshotTemplates } from '../hooks/use-snapshot-templates'
import { useToast } from '@/hooks/use-toast'
import type { SnapshotCommand } from '../types/snapshot-types'

interface SaveTemplateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  commands: Omit<SnapshotCommand, 'id' | 'template_id' | 'created_at'>[]
  onSaveSuccess: () => void
}

export function SaveTemplateDialog({
  open,
  onOpenChange,
  commands,
  onSaveSuccess,
}: SaveTemplateDialogProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [scope, setScope] = useState<'global' | 'private'>('private')
  const [saving, setSaving] = useState(false)
  const { createTemplate } = useSnapshotTemplates()
  const { toast } = useToast()

  const handleSave = async () => {
    if (!name.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Please enter a template name',
        variant: 'destructive',
      })
      return
    }

    if (commands.length === 0) {
      toast({
        title: 'Validation Error',
        description: 'Please add at least one command',
        variant: 'destructive',
      })
      return
    }

    setSaving(true)
    try {
      await createTemplate({
        name: name.trim(),
        description: description.trim() || undefined,
        scope,
        commands,
      })

      // Reset form
      setName('')
      setDescription('')
      setScope('private')

      onSaveSuccess()
    } catch (error) {
      toast({
        title: 'Save Failed',
        description: error instanceof Error ? error.message : 'Failed to save template',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Save Command Template</DialogTitle>
          <DialogDescription>
            Save this set of commands as a template for future use
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="template-name">Template Name *</Label>
            <Input
              id="template-name"
              placeholder="e.g., Routing Snapshot"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="template-description">Description</Label>
            <Textarea
              id="template-description"
              placeholder="Optional description of what this template does"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>Template Scope</Label>
            <RadioGroup value={scope} onValueChange={(val) => setScope(val as 'global' | 'private')}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="private" id="private" />
                <Label htmlFor="private" className="font-normal">
                  Private (Only visible to you)
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="global" id="global" />
                <Label htmlFor="global" className="font-normal">
                  Global (Visible to all users)
                </Label>
              </div>
            </RadioGroup>
          </div>

          <div className="text-sm text-muted-foreground">
            This template will save {commands.length} command{commands.length !== 1 ? 's' : ''}.
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Template'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
