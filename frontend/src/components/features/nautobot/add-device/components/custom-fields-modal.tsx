import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, FileText } from 'lucide-react'
import type { CustomField } from '../types'

interface CustomFieldsModalProps {
  show: boolean
  onClose: () => void
  customFields: CustomField[]
  customFieldValues: Record<string, string>
  onUpdateField: (key: string, value: string) => void
  isLoading: boolean
}

export function CustomFieldsModal({
  show,
  onClose,
  customFields,
  customFieldValues,
  onUpdateField,
  isLoading,
}: CustomFieldsModalProps) {
  return (
    <Dialog open={show} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Custom Fields
          </DialogTitle>
        </DialogHeader>

        <div className="py-4 space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : customFields.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No custom fields available
            </p>
          ) : (
            <div className="space-y-4">
              {customFields.map((field) => (
                <div key={field.key} className="space-y-2">
                  <Label htmlFor={field.key} className="text-sm font-medium">
                    {field.label}
                    {field.required && <span className="text-destructive ml-1">*</span>}
                  </Label>
                  <Input
                    id={field.key}
                    value={customFieldValues[field.key] || ''}
                    onChange={(e) => onUpdateField(field.key, e.target.value)}
                    placeholder={field.description || `Enter ${field.label.toLowerCase()}`}
                  />
                  {field.description && (
                    <p className="text-xs text-muted-foreground">{field.description}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button onClick={onClose} disabled={isLoading}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
