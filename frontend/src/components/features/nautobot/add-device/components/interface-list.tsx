import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Plus, Trash2, Settings, X } from 'lucide-react'
import { UseFormReturn, useFieldArray } from 'react-hook-form'
import type { DeviceFormValues } from '../validation'
import type { NautobotDropdownsResponse } from '../types'
import { DEFAULT_INTERFACE, DEFAULT_IP_ADDRESS } from '../constants'

interface InterfaceListProps {
  form: UseFormReturn<DeviceFormValues>
  dropdownData: NautobotDropdownsResponse
  onOpenProperties: (interfaceId: string) => void
  isLoading: boolean
}

export function InterfaceList({
  form,
  dropdownData,
  onOpenProperties,
  isLoading,
}: InterfaceListProps) {
  const { control, register, setValue, watch, formState: { errors } } = form

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'interfaces',
  })

  const handleAddInterface = () => {
    const newId = Date.now().toString()
    // Auto-select namespace if only one is available
    const defaultNamespace = dropdownData.nautobotDefaults?.namespace ||
      (dropdownData.namespaces.length === 1 ? dropdownData.namespaces[0]?.id : '') || ''
    
    append({
      id: newId,
      ...DEFAULT_INTERFACE,
      status: dropdownData.nautobotDefaults?.interface_status || '',
      ip_addresses: [{
        id: '1',
        ...DEFAULT_IP_ADDRESS,
        namespace: defaultNamespace,
        ip_role: 'none',
      }],
    })
  }

  return (
    <div className="shadow-lg border-0 p-0 bg-white rounded-lg">
      <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4 flex items-center justify-between rounded-t-lg">
        <div className="flex items-center space-x-2">
          <span className="text-sm font-medium">Network Interfaces</span>
        </div>
        <Button
          type="button"
          onClick={handleAddInterface}
          disabled={isLoading}
          size="sm"
          className="bg-white/20 border-white/30 text-white hover:bg-white/30 h-7 text-xs"
        >
          <Plus className="h-3 w-3 mr-1" />
          Add Interface
        </Button>
      </div>
      <div className="p-6 bg-gradient-to-b from-white to-gray-50">
      <div className="space-y-3">
        {fields.map((field, index) => {
          const interfaceErrors = errors.interfaces?.[index]
          return (
            <div key={field.id} className="p-3 border rounded-lg space-y-2 bg-muted/20">
              <div className="flex items-center justify-between">
                <Badge variant="outline">Interface {index + 1}</Badge>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    onClick={() => onOpenProperties(index.toString())}
                    disabled={isLoading}
                    size="sm"
                    variant="outline"
                  >
                    <Settings className="h-4 w-4 mr-1" />
                    Properties
                  </Button>
                  {fields.length > 1 && (
                    <Button
                      type="button"
                      onClick={() => remove(index)}
                      disabled={isLoading}
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
              </div>

              {/* Interface Fields - All in one row */}
              <div className="grid grid-cols-3 gap-4">
                {/* Interface Name */}
                <div className="space-y-1">
                  <Label className="text-xs font-medium">
                    Interface Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    {...register(`interfaces.${index}.name`)}
                    placeholder="e.g., eth0, Ethernet0/0"
                    disabled={isLoading}
                    className="border-2 border-slate-300 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 shadow-sm"
                  />
                  {interfaceErrors?.name && (
                    <p className="text-xs text-destructive">{interfaceErrors.name.message}</p>
                  )}
                </div>

                {/* Interface Type */}
                <div className="space-y-1">
                  <Label className="text-xs font-medium">
                    Type <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={watch(`interfaces.${index}.type`) ?? ''}
                    onValueChange={(value) => setValue(`interfaces.${index}.type`, value)}
                    disabled={isLoading}
                  >
                    <SelectTrigger className="border-2 border-slate-300 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 shadow-sm disabled:bg-slate-100 disabled:border-slate-200">
                      <SelectValue placeholder="Select type..." />
                    </SelectTrigger>
                    <SelectContent>
                      {dropdownData.interfaceTypes.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.display_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {interfaceErrors?.type && (
                    <p className="text-xs text-destructive">{interfaceErrors.type.message}</p>
                  )}
                </div>

                {/* Interface Status */}
                <div className="space-y-1">
                  <Label className="text-xs font-medium">
                    Status <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={watch(`interfaces.${index}.status`) ?? ''}
                    onValueChange={(value) => setValue(`interfaces.${index}.status`, value)}
                    disabled={isLoading}
                  >
                    <SelectTrigger className="border-2 border-slate-300 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 shadow-sm disabled:bg-slate-100 disabled:border-slate-200">
                      <SelectValue placeholder="Select status..." />
                    </SelectTrigger>
                    <SelectContent>
                      {dropdownData.interfaceStatuses.map((status) => (
                        <SelectItem key={status.id} value={status.id}>
                          {status.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {interfaceErrors?.status && (
                    <p className="text-xs text-destructive">{interfaceErrors.status.message}</p>
                  )}
                </div>
              </div>

              {/* IP Addresses Section */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium">IP Addresses</Label>
                  <Button
                    type="button"
                    onClick={() => {
                      const currentIps = watch(`interfaces.${index}.ip_addresses`) || []
                      // Auto-select namespace if only one is available
                      const defaultNamespace = dropdownData.nautobotDefaults?.namespace ||
                        (dropdownData.namespaces.length === 1 ? dropdownData.namespaces[0]?.id : '') || ''
                      
                      setValue(`interfaces.${index}.ip_addresses`, [
                        ...currentIps,
                        {
                          id: Date.now().toString(),
                          ...DEFAULT_IP_ADDRESS,
                          namespace: defaultNamespace,
                          ip_role: 'none',
                        },
                      ])
                    }}
                    disabled={isLoading}
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Add IP
                  </Button>
                </div>

                {(watch(`interfaces.${index}.ip_addresses`) || []).map((ipAddr, ipIndex) => {
                  const ipErrors = interfaceErrors?.ip_addresses?.[ipIndex]
                  const ipAddresses = watch(`interfaces.${index}.ip_addresses`) || []
                  
                  return (
                    <div key={`ip-${field.id}-${ipAddr?.id || ipAddr?.address || `temp-${ipIndex}`}`} className="p-3 border rounded bg-slate-50 space-y-2">
                      <div className="flex items-center justify-between mb-2">
                        <Badge variant="secondary" className="text-xs">IP {ipIndex + 1}</Badge>
                        {ipAddresses.length > 1 && (
                          <Button
                            type="button"
                            onClick={() => {
                              const updated = ipAddresses.filter((_, i) => i !== ipIndex)
                              setValue(`interfaces.${index}.ip_addresses`, updated)
                            }}
                            disabled={isLoading}
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0"
                          >
                            <X className="h-3 w-3 text-destructive" />
                          </Button>
                        )}
                      </div>

                      {/* All IP fields in one row */}
                      <div className="grid grid-cols-4 gap-3">
                        {/* IP Address */}
                        <div className="space-y-1">
                          <Label className="text-xs font-medium">
                            Address <span className="text-destructive">*</span>
                          </Label>
                          <Input
                            {...register(`interfaces.${index}.ip_addresses.${ipIndex}.address`)}
                            placeholder="192.168.1.10/24"
                            disabled={isLoading}
                            className="border-2 border-slate-300 bg-white text-xs h-8"
                          />
                          {ipErrors?.address && (
                            <p className="text-xs text-destructive">{ipErrors.address.message}</p>
                          )}
                        </div>

                        {/* Namespace */}
                        <div className="space-y-1">
                          <Label className="text-xs font-medium">
                            Namespace <span className="text-destructive">*</span>
                          </Label>
                          <Select
                            value={watch(`interfaces.${index}.ip_addresses.${ipIndex}.namespace`) ?? ''}
                            onValueChange={(value) => setValue(`interfaces.${index}.ip_addresses.${ipIndex}.namespace`, value)}
                            disabled={isLoading}
                          >
                            <SelectTrigger className="border-2 border-slate-300 bg-white text-xs h-8">
                              <SelectValue placeholder="Select..." />
                            </SelectTrigger>
                            <SelectContent>
                              {dropdownData.namespaces.map((ns) => (
                                <SelectItem key={ns.id} value={ns.id}>
                                  {ns.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {ipErrors?.namespace && (
                            <p className="text-xs text-destructive">{ipErrors.namespace.message}</p>
                          )}
                        </div>

                        {/* IP Role */}
                        <div className="space-y-1">
                          <Label className="text-xs font-medium">IP Role</Label>
                          <Select
                            value={watch(`interfaces.${index}.ip_addresses.${ipIndex}.ip_role`) || 'none'}
                            onValueChange={(value) => setValue(`interfaces.${index}.ip_addresses.${ipIndex}.ip_role`, value)}
                            disabled={isLoading}
                          >
                            <SelectTrigger className="border-2 border-slate-300 bg-white text-xs h-8">
                              <SelectValue placeholder="Select..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">None</SelectItem>
                              {dropdownData.ipRoles.map((role) => (
                                <SelectItem key={role.id} value={role.id}>
                                  {role.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Primary Checkbox */}
                        <div className="space-y-1">
                          <Label className="text-xs font-medium">Primary</Label>
                          <div className="flex items-center h-8 px-2 rounded-md border border-input bg-background">
                            <Checkbox
                              checked={watch(`interfaces.${index}.ip_addresses.${ipIndex}.is_primary`) || false}
                              onCheckedChange={(checked) =>
                                setValue(`interfaces.${index}.ip_addresses.${ipIndex}.is_primary`, checked as boolean)
                              }
                              disabled={isLoading}
                            />
                            <label className="ml-2 text-xs font-normal cursor-pointer">
                              Primary
                            </label>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
      </div>
    </div>
  )
}
