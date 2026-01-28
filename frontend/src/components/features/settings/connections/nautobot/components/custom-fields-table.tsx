import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Settings } from 'lucide-react'
import type { CustomField, CustomFieldChoice } from '../types'

interface CustomFieldsTableProps {
  customFields: CustomField[]
  customFieldChoices: { [key: string]: CustomFieldChoice[] }
  values: { [key: string]: string }
  onChange: (fieldName: string, value: string) => void
  disabled?: boolean
}

export function CustomFieldsTable({
  customFields,
  customFieldChoices,
  values,
  onChange,
  disabled = false,
}: CustomFieldsTableProps) {
  if (customFields.length === 0) {
    return (
      <div className="text-xs text-gray-500 text-center py-4 bg-white">
        No custom fields available
      </div>
    )
  }

  return (
    <div className="rounded-lg border shadow-sm overflow-hidden">
      <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-1 px-3">
        <div className="flex items-center space-x-2">
          <Settings className="h-3 w-3" />
          <div>
            <h3 className="text-xs font-semibold">Custom Fields</h3>
            <p className="text-blue-100 text-xs">
              Configure custom field settings for device offboarding
            </p>
          </div>
        </div>
      </div>
      <div className="bg-white">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-2 py-2 text-left text-xs font-medium text-gray-900">
                Custom Field
              </th>
              <th className="px-2 py-2 text-left text-xs font-medium text-gray-900">Value</th>
              <th className="px-2 py-2 text-center text-xs font-medium text-gray-900">
                Clear Custom Field
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {customFields.map((field) => {
              const fieldName = field.name || field.key || field.id
              if (!fieldName) return null

              const isClearSelected = values[fieldName] === 'clear'
              const fieldValue = isClearSelected ? '' : values[fieldName] || ''

              return (
                <tr key={field.id} className="hover:bg-gray-50">
                  <td className="px-2 py-2">
                    <div>
                      <div className="text-xs font-medium text-gray-900">
                        {fieldName}
                        {field.required && <span className="text-red-500 ml-1">*</span>}
                      </div>
                      {field.description && (
                        <div className="text-xs text-gray-500">{field.description}</div>
                      )}
                    </div>
                  </td>
                  <td className="px-2 py-2">
                    {field.type?.value === 'select' ? (
                      <Select
                        value={fieldValue}
                        onValueChange={(value) => onChange(fieldName, value)}
                        disabled={disabled || isClearSelected}
                      >
                        <SelectTrigger className="h-6 text-xs">
                          <SelectValue placeholder="Select a value" />
                        </SelectTrigger>
                        <SelectContent>
                          {customFieldChoices[fieldName]?.map((choice) => (
                            <SelectItem key={choice.id} value={choice.value}>
                              {choice.display}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        type="text"
                        placeholder={field.default || 'Enter value'}
                        value={fieldValue}
                        onChange={(e) => onChange(fieldName, e.target.value)}
                        disabled={disabled || isClearSelected}
                        className="h-6 text-xs"
                      />
                    )}
                  </td>
                  <td className="px-2 py-2 text-center">
                    <Checkbox
                      checked={isClearSelected}
                      onCheckedChange={(checked) =>
                        onChange(fieldName, checked ? 'clear' : '')
                      }
                      disabled={disabled}
                    />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
