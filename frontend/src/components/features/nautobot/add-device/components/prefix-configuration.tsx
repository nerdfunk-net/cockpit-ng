import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { UseFormReturn } from 'react-hook-form'
import type { DeviceFormValues } from '../utils/validation'
import { PREFIX_LENGTH_OPTIONS } from '../constants'

interface PrefixConfigurationProps {
  form: UseFormReturn<DeviceFormValues>
  isLoading: boolean
}

export function PrefixConfiguration({ form, isLoading }: PrefixConfigurationProps) {
  const { watch, setValue } = form

  return (
    <div className="shadow-lg border-0 p-0 bg-card rounded-lg">
      <div className="panel-header py-2 px-4 flex items-center justify-between rounded-t-lg">
        <div className="flex items-center space-x-2">
          <span className="text-sm font-medium">Prefix Configuration</span>
        </div>
        <div className="text-xs text-panel-header-muted">
          Automatically add prefix to IP addresses
        </div>
      </div>
      <div className="p-6 panel-content">
        <div className="flex items-center gap-4">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="addPrefix"
              checked={watch('addPrefix') ?? false}
              onCheckedChange={checked => setValue('addPrefix', checked as boolean)}
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
              onValueChange={value => setValue('defaultPrefixLength', value)}
              disabled={isLoading || !watch('addPrefix')}
            >
              <SelectTrigger
                id="defaultPrefixLength"
                className="w-24 h-8 border-2 border-border bg-card focus:border-primary focus:ring-2 focus:ring-ring/30 shadow-sm disabled:bg-muted disabled:border-border"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PREFIX_LENGTH_OPTIONS.map(option => (
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
