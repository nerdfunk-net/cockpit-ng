import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { FilterableSelect } from '@/components/ui/filterable-select'
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
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Custom Fields
          </DialogTitle>
          <DialogDescription>
            Set custom field values for this device.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : customFields.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No custom fields available for devices.
            </p>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-muted/50 border-b">
                    <th className="text-left py-2 px-3 text-sm font-medium">Field Name</th>
                    <th className="text-left py-2 px-3 text-sm font-medium">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {customFields.map((field, index) => (
                    <tr key={field.id} className={index % 2 === 0 ? 'bg-white' : 'bg-muted/20'}>
                      <td className="py-2 px-3 border-r">
                        <div>
                          <span className="text-sm font-medium">
                            {field.label}
                            {field.required && <span className="text-destructive ml-1">*</span>}
                          </span>
                          {field.description && (
                            <p className="text-xs text-muted-foreground">{field.description}</p>
                          )}
                        </div>
                      </td>
                      <td className="py-2 px-3">
                        {field.type?.value === 'select' && customFieldChoices[field.key] ? (
                          <FilterableSelect
                            value={customFieldValues[field.key] || ''}
                            onValueChange={(value) => onUpdateField(field.key, value)}
                            options={(customFieldChoices[field.key] || []).map((choice) => {
                              // Handle both string and object choices
                              const choiceValue = typeof choice === 'object' && choice !== null
                                ? (choice as { value?: string; id?: string }).value || (choice as { value?: string; id?: string }).id || JSON.stringify(choice)
                                : String(choice)
                              return choiceValue
                            })}
                            placeholder="Select..."
                            searchPlaceholder="Filter options..."
                            emptyMessage="No matching options found."
                          />
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
                            type="number"
                            value={customFieldValues[field.key] || ''}
                            onChange={(e) => onUpdateField(field.key, e.target.value)}
                            className="h-9 bg-white border"
                          />
                        ) : (
                          <Input
                            value={customFieldValues[field.key] || ''}
                            onChange={(e) => onUpdateField(field.key, e.target.value)}
                            className="h-9 bg-white border"
                            placeholder="Enter value..."
                          />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
