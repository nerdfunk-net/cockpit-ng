import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2, FileText } from 'lucide-react'
import type { CustomField } from '../types'

interface CustomFieldsModalProps {
  show: boolean
  onClose: () => void
  customFields: CustomField[]
  customFieldValues: Record<string, string>
  onUpdateField: (key: string, value: string) => void
  isLoading: boolean
  customFieldChoices: Record<string, string[]>
}

export function CustomFieldsModal({
  show,
  onClose,
  customFields,
  customFieldValues,
  onUpdateField,
  isLoading,
  customFieldChoices,
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
                  {field.type?.value === 'select' && customFieldChoices[field.key] ? (
                    <Select
                      value={customFieldValues[field.key] || ''}
                      onValueChange={(value) => onUpdateField(field.key, value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select..." />
                      </SelectTrigger>
                      <SelectContent>
                        {customFieldChoices[field.key]?.map((choice) => {
                          const choiceValue = typeof choice === 'object' && choice !== null
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            ? (choice as any).value || (choice as any).id || JSON.stringify(choice)
                            : String(choice)
                          return (
                            <SelectItem key={`${field.key}-${choiceValue}`} value={choiceValue}>
                              {choiceValue}
                            </SelectItem>
                          )
                        })}
                      </SelectContent>
                    </Select>
                  ) : field.type?.value === 'boolean' ? (
                    <div className="flex items-center h-9">
                      <Checkbox
                        checked={customFieldValues[field.key] === 'true'}
                        onCheckedChange={(checked) =>
                          onUpdateField(field.key, checked ? 'true' : 'false')
                        }
                      />
                    </div>
                  ) : field.type?.value === 'integer' ? (
                    <Input
                      id={field.key}
                      type="number"
                      value={customFieldValues[field.key] || ''}
                      onChange={(e) => onUpdateField(field.key, e.target.value)}
                      placeholder={field.description || `Enter ${field.label.toLowerCase()}`}
                    />
                  ) : (
                    <Input
                      id={field.key}
                      value={customFieldValues[field.key] || ''}
                      onChange={(e) => onUpdateField(field.key, e.target.value)}
                      placeholder={field.description || `Enter ${field.label.toLowerCase()}`}
                    />
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
