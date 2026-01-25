import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { UseFormReturn } from 'react-hook-form'
import type { DeviceFormValues } from '../validation'
import { PREFIX_LENGTH_OPTIONS } from '../constants'

interface PrefixConfigurationProps {
  form: UseFormReturn<DeviceFormValues>
  isLoading: boolean
}

export function PrefixConfiguration({ form, isLoading }: PrefixConfigurationProps) {
  const { watch, setValue } = form

  return (
    <div className="shadow-lg border-0 p-0 bg-white rounded-lg">
      <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4 flex items-center justify-between rounded-t-lg">
        <div className="flex items-center space-x-2">
          <span className="text-sm font-medium">Prefix Configuration</span>
        </div>
        <div className="text-xs text-blue-100">
          Automatically add prefix to IP addresses
        </div>
      </div>
      <div className="p-4 bg-gradient-to-b from-white to-gray-50">
        <div className="flex items-center gap-4">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="addPrefix"
              checked={watch('addPrefix') ?? false}
              onCheckedChange={(checked) => setValue('addPrefix', checked as boolean)}
              disabled={isLoading}
            />
            <Label htmlFor="addPrefix" className="text-sm font-medium cursor-pointer">
              Enable
            </Label>
          </div>

          <div className="flex items-center gap-2">
            <Label htmlFor="defaultPrefixLength" className="text-xs font-medium">
              Prefix Length:
            </Label>
            <Select
              value={watch('defaultPrefixLength') ?? ''}
              onValueChange={(value) => setValue('defaultPrefixLength', value)}
              disabled={isLoading || !watch('addPrefix')}
            >
              <SelectTrigger id="defaultPrefixLength" className="w-24 h-8 border-2 border-slate-300 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 shadow-sm disabled:bg-slate-100 disabled:border-slate-200">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PREFIX_LENGTH_OPTIONS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </div>
  )
}
