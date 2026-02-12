import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
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
import { Badge } from '@/components/ui/badge'
import { Settings, Loader2 } from 'lucide-react'
import { UseFormReturn } from 'react-hook-form'
import type { VMFormValues } from '../hooks/use-vm-form'
import type { VlanItem } from '../types'
import { VLAN_MODES } from '../constants'

interface InterfacePropertiesModalProps {
  form: UseFormReturn<VMFormValues>
  interfaceId: string | null
  vlans: VlanItem[]
  isLoadingVlans: boolean
  show: boolean
  onClose: () => void
}

export function InterfacePropertiesModal({
  form,
  interfaceId,
  vlans,
  isLoadingVlans,
  show,
  onClose,
}: InterfacePropertiesModalProps) {
  const { register, watch, setValue } = form

  // interfaceId is now the index as a string
  const interfaceIndex = interfaceId ? parseInt(interfaceId, 10) : -1
  const interfaces = watch('interfaces')

  if (interfaceIndex === -1 || !show || isNaN(interfaceIndex) || !interfaces || interfaceIndex >= interfaces.length) return null

  const currentInterface = interfaces[interfaceIndex]
  if (!currentInterface) return null

  return (
    <Dialog open={show} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Interface Properties - {currentInterface.name || 'Unnamed Interface'}
          </DialogTitle>
          <DialogDescription>
            Configure additional properties for this interface. All fields are optional.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Basic Settings Section */}
          <div className="rounded-lg border bg-green-50 p-4">
            <h4 className="text-sm font-semibold text-green-700 mb-3">Basic Settings</h4>
            <div className="space-y-3">
              <div className="flex items-center gap-6">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    checked={watch(`interfaces.${interfaceIndex}.enabled`) ?? true}
                    onCheckedChange={(checked) =>
                      setValue(`interfaces.${interfaceIndex}.enabled`, checked as boolean)
                    }
                  />
                  <Label className="cursor-pointer text-sm">Enabled</Label>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">MAC Address</Label>
                  <Input
                    {...register(`interfaces.${interfaceIndex}.mac_address`)}
                    placeholder="00:1A:2B:3C:4D:5E"
                    className="h-8 text-sm border-2 border-slate-300 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 shadow-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">MTU</Label>
                  <Input
                    type="number"
                    {...register(`interfaces.${interfaceIndex}.mtu`, {
                      valueAsNumber: true,
                    })}
                    placeholder="1500"
                    className="h-8 text-sm border-2 border-slate-300 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 shadow-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Description</Label>
                  <Input
                    {...register(`interfaces.${interfaceIndex}.description`)}
                    placeholder="Interface description"
                    className="h-8 text-sm border-2 border-slate-300 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 shadow-sm"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* VLAN Configuration Section */}
          <div className="rounded-lg border bg-blue-50 p-4">
            <h4 className="text-sm font-semibold text-blue-700 mb-3">VLAN Configuration</h4>
            {isLoadingVlans && (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <span className="ml-2 text-sm">Loading VLANs...</span>
              </div>
            )}
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Mode</Label>
                  <Select
                    value={watch(`interfaces.${interfaceIndex}.mode`) || 'none'}
                    onValueChange={(value) => setValue(`interfaces.${interfaceIndex}.mode`, value)}
                  >
                    <SelectTrigger className="h-8 text-sm border-2 border-slate-300 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 shadow-sm">
                      <SelectValue placeholder="Select mode" />
                    </SelectTrigger>
                    <SelectContent>
                      {VLAN_MODES.map((mode) => (
                        <SelectItem key={mode.value} value={mode.value}>
                          {mode.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Untagged VLAN</Label>
                  <Select
                    value={watch(`interfaces.${interfaceIndex}.untagged_vlan`) || 'none'}
                    onValueChange={(value) =>
                      setValue(
                        `interfaces.${interfaceIndex}.untagged_vlan`,
                        value === 'none' ? '' : value
                      )
                    }
                    disabled={isLoadingVlans}
                  >
                    <SelectTrigger className="h-8 text-sm border-2 border-slate-300 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 shadow-sm disabled:bg-slate-100 disabled:border-slate-200">
                      <SelectValue placeholder={isLoadingVlans ? 'Loading...' : 'Select VLAN'} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {vlans.map((vlan) => (
                        <SelectItem key={vlan.id} value={vlan.id}>
                          {`${vlan.vid} - ${vlan.name}${vlan.location ? ` (${vlan.location.name})` : ' (Global)'}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Tagged VLANs</Label>
                  <Select
                    value=""
                    onValueChange={(value) => {
                      const current = watch(`interfaces.${interfaceIndex}.tagged_vlans`) || []
                      if (value && !current.includes(value)) {
                        setValue(`interfaces.${interfaceIndex}.tagged_vlans`, [...current, value])
                      }
                    }}
                    disabled={
                      isLoadingVlans || watch(`interfaces.${interfaceIndex}.mode`) !== 'tagged'
                    }
                  >
                    <SelectTrigger className="h-8 text-sm border-2 border-slate-300 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 shadow-sm disabled:bg-slate-100 disabled:border-slate-200">
                      <SelectValue
                        placeholder={
                          watch(`interfaces.${interfaceIndex}.mode`) !== 'tagged'
                            ? 'Tagged mode only'
                            : isLoadingVlans
                              ? 'Loading...'
                              : 'Add VLAN'
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {vlans
                        .filter(
                          (vlan) =>
                            !watch(`interfaces.${interfaceIndex}.tagged_vlans`)?.includes(vlan.id)
                        )
                        .map((vlan) => (
                          <SelectItem key={vlan.id} value={vlan.id}>
                            {`${vlan.vid} - ${vlan.name}${vlan.location ? ` (${vlan.location.name})` : ' (Global)'}`}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  {watch(`interfaces.${interfaceIndex}.tagged_vlans`)?.length && watch(`interfaces.${interfaceIndex}.tagged_vlans`)!.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {watch(`interfaces.${interfaceIndex}.tagged_vlans`)!.map((vlanId) => {
                        const vlan = vlans.find((v) => v.id === vlanId)
                        return (
                          <Badge
                            key={vlanId}
                            variant="secondary"
                            className="cursor-pointer hover:bg-destructive hover:text-destructive-foreground text-xs"
                            onClick={() => {
                              const current =
                                watch(`interfaces.${interfaceIndex}.tagged_vlans`) || []
                              setValue(
                                `interfaces.${interfaceIndex}.tagged_vlans`,
                                current.filter((id) => id !== vlanId)
                              )
                            }}
                          >
                            {vlan ? `${vlan.vid} - ${vlan.name}` : vlanId} ×
                          </Badge>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Advanced Settings Section */}
          <div className="rounded-lg border bg-purple-50 p-4">
            <h4 className="text-sm font-semibold text-purple-700 mb-3">Advanced Settings</h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Parent Interface</Label>
                <Input
                  {...register(`interfaces.${interfaceIndex}.parent_interface`)}
                  placeholder="UUID"
                  className="h-8 text-sm border-2 border-slate-300 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 shadow-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Bridge</Label>
                <Input
                  {...register(`interfaces.${interfaceIndex}.bridge`)}
                  placeholder="UUID"
                  className="h-8 text-sm border-2 border-slate-300 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 shadow-sm"
                />
              </div>
            </div>
            <div className="space-y-1 mt-3">
              <Label className="text-xs">Tags (comma-separated)</Label>
              <Input
                value={watch(`interfaces.${interfaceIndex}.tags`)?.join(', ') || ''}
                onChange={(e) => {
                  const tags = e.target.value
                    ? e.target.value.split(',').map((v) => v.trim()).filter(Boolean)
                    : []
                  setValue(`interfaces.${interfaceIndex}.tags`, tags)
                }}
                placeholder="production, critical, monitored"
                className="h-8 text-sm border-2 border-slate-300 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 shadow-sm"
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={onClose} variant="outline">
            Save & Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
