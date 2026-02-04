'use client'

import { useCallback, useEffect } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { FilterableSelect } from '@/components/ui/filterable-select'
import { FileText, Loader2 } from 'lucide-react'
import { useApi } from '@/hooks/use-api'

interface CustomField {
  id: string
  key: string
  label: string
  type: {
    value: string
  }
  required: boolean
  description?: string
}

interface CustomFieldsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  customFieldValues: Record<string, string>
  onUpdateCustomField: (key: string, value: string) => void
  customFields: CustomField[]
  setCustomFields: (fields: CustomField[]) => void
  customFieldChoices: Record<string, string[]>
  setCustomFieldChoices: (choices: Record<string, string[]>) => void
  isLoadingCustomFields: boolean
  setIsLoadingCustomFields: (loading: boolean) => void
}

export function CustomFieldsModal({
  open,
  onOpenChange,
  customFieldValues,
  onUpdateCustomField,
  customFields,
  setCustomFields,
  customFieldChoices,
  setCustomFieldChoices,
  isLoadingCustomFields,
  setIsLoadingCustomFields
}: CustomFieldsModalProps) {
  const { apiCall } = useApi()

  // Load custom fields when modal opens
  useEffect(() => {
    if (open && customFields.length === 0) {
      loadCustomFields()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const loadCustomFields = useCallback(async () => {
    setIsLoadingCustomFields(true)
    try {
      const fieldsData = await apiCall<CustomField[]>('nautobot/custom-fields/devices', { method: 'GET' })
      if (fieldsData && Array.isArray(fieldsData)) {
        setCustomFields(fieldsData)

        // Load choices for select-type fields
        const selectFields = fieldsData.filter(f => f.type?.value === 'select' || f.type?.value === 'multi-select')
        const choicesPromises = selectFields.map(async (field) => {
          try {
            const choices = await apiCall<string[]>(`nautobot/custom-field-choices/${field.key}`, { method: 'GET' })
            return { key: field.key, choices: choices || [] }
          } catch {
            return { key: field.key, choices: [] }
          }
        })

        const choicesResults = await Promise.all(choicesPromises)
        const choicesMap: Record<string, string[]> = {}
        choicesResults.forEach(result => {
          choicesMap[result.key] = result.choices
        })
        setCustomFieldChoices(choicesMap)
      }
    } catch (error) {
      console.error('Error loading custom fields:', error)
      setCustomFields([])
    } finally {
      setIsLoadingCustomFields(false)
    }
  }, [apiCall, setCustomFields, setCustomFieldChoices, setIsLoadingCustomFields])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
          {isLoadingCustomFields ? (
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
                            onValueChange={(value) => onUpdateCustomField(field.key, value)}
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
                                onUpdateCustomField(field.key, checked ? 'true' : 'false')
                              }
                            />
                          </div>
                        ) : field.type?.value === 'integer' ? (
                          <Input
                            type="number"
                            value={customFieldValues[field.key] || ''}
                            onChange={(e) => onUpdateCustomField(field.key, e.target.value)}
                            className="h-9 bg-white border"
                          />
                        ) : (
                          <Input
                            value={customFieldValues[field.key] || ''}
                            onChange={(e) => onUpdateCustomField(field.key, e.target.value)}
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
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
