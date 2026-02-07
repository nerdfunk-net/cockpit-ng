'use client'

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FileCode, Globe, Lock, User, Calendar, Edit } from 'lucide-react'
import type { Template } from '../types/templates'

interface TemplateViewDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  template: Template | null
  canEdit: boolean
  onEdit: () => void
}

export function TemplateViewDialog({
  open, onOpenChange, template, canEdit, onEdit
}: TemplateViewDialogProps) {
  if (!template) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <FileCode className="h-6 w-6 text-blue-600" />
            {template.name}
          </DialogTitle>
          <DialogDescription>
            Template details and content
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Metadata Section - Compact */}
          <div className="grid grid-cols-4 gap-3">
            <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg border text-sm">
              {template.scope === 'global' ? (
                <>
                  <Globe className="h-4 w-4 text-blue-600 flex-shrink-0" />
                  <Badge variant="default" className="text-xs">Global</Badge>
                </>
              ) : (
                <>
                  <Lock className="h-4 w-4 text-purple-600 flex-shrink-0" />
                  <Badge variant="outline" className="text-xs">Private</Badge>
                </>
              )}
            </div>

            <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg border text-sm">
              <User className="h-4 w-4 text-gray-600 flex-shrink-0" />
              <span className="text-gray-700 truncate">{template.created_by || 'Unknown'}</span>
            </div>

            <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg border text-sm">
              <Calendar className="h-4 w-4 text-gray-600 flex-shrink-0" />
              <span className="text-gray-700 truncate">
                {new Date(template.updated_at).toLocaleDateString()}
              </span>
            </div>

            <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg border text-sm">
              <FileCode className="h-4 w-4 text-gray-600 flex-shrink-0" />
              <span className="text-gray-700 truncate">{template.template_type}</span>
            </div>
          </div>

          {/* Description - Compact */}
          {template.description && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-gray-700">{template.description}</p>
            </div>
          )}

          {/* Template Content - Larger */}
          <Card className="flex-1">
            <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 py-3">
              <CardTitle className="text-base flex items-center gap-2">
                <FileCode className="h-4 w-4" />
                Template Content
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="bg-gray-900 rounded-lg p-4 overflow-auto max-h-[500px]">
                <pre className="text-sm text-green-400 font-mono whitespace-pre-wrap">
                  {template.content}
                </pre>
              </div>
              <div className="mt-3 p-2 bg-blue-50 border border-blue-200 rounded-md">
                <p className="text-xs text-blue-800">
                  <strong>Tip:</strong> Use{' '}
                  <code className="bg-blue-100 px-1 rounded">{'{{ user_variables.var_name }}'}</code> for
                  custom variables and{' '}
                  <code className="bg-blue-100 px-1 rounded">{'{{ nautobot.field }}'}</code> for device data
                  from Nautobot.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex justify-end gap-3">
            {canEdit && (
              <Button
                onClick={onEdit}
                variant="outline"
                className="gap-2"
              >
                <Edit className="h-4 w-4" />
                Edit Template
              </Button>
            )}
            <Button onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
