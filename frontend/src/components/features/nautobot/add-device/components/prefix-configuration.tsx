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
    <div className="rounded-xl border shadow-sm p-6 space-y-4">
      <h2 className="text-lg font-semibold">Prefix Configuration</h2>

      <div className="space-y-4">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="addPrefix"
            checked={watch('addPrefix')}
            onCheckedChange={(checked) => setValue('addPrefix', checked as boolean)}
            disabled={isLoading}
          />
          <Label htmlFor="addPrefix" className="text-sm font-medium cursor-pointer">
            Automatically add prefix to IP addresses
          </Label>
        </div>

        {watch('addPrefix') && (
          <div className="ml-6 space-y-2">
            <Label htmlFor="defaultPrefixLength" className="text-xs font-medium">
              Default Prefix Length
            </Label>
            <Select
              value={watch('defaultPrefixLength')}
              onValueChange={(value) => setValue('defaultPrefixLength', value)}
              disabled={isLoading}
            >
              <SelectTrigger id="defaultPrefixLength" className="w-32">
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
        )}
      </div>
    </div>
  )
}
