import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Minus } from 'lucide-react'
import type { OffboardProperties, NautobotIntegrationMode } from '@/types/features/nautobot/offboard'

interface OffboardPanelProps {
  selectedCount: number
  isSubmitting: boolean
  offboardProperties: OffboardProperties
  nautobotIntegrationMode: NautobotIntegrationMode
  onOffboardPropertiesChange: (props: Partial<OffboardProperties>) => void
  onNautobotIntegrationModeChange: (mode: NautobotIntegrationMode) => void
  onOffboard: () => void
  isFormValid: boolean
}

export function OffboardPanel({
  selectedCount,
  isSubmitting,
  offboardProperties,
  nautobotIntegrationMode,
  onOffboardPropertiesChange,
  onNautobotIntegrationModeChange,
  onOffboard,
  isFormValid
}: OffboardPanelProps) {
  return (
    <div className="rounded-xl border shadow-sm overflow-hidden">
      <div className="bg-gradient-to-r from-red-400/80 to-red-500/80 text-white py-2 px-4">
        <div className="flex items-center space-x-2">
          <Minus className="h-4 w-4" />
          <div>
            <h3 className="text-sm font-semibold">Offboarding</h3>
            <p className="text-red-100 text-xs">Configure removal settings</p>
          </div>
        </div>
      </div>
      <div className="p-4 bg-white space-y-3">
        {/* Nautobot Integration */}
        <div className="space-y-3">
          <Label className="text-sm font-semibold text-gray-700">Nautobot Integration</Label>
          <Select value={nautobotIntegrationMode} onValueChange={onNautobotIntegrationModeChange}>
            <SelectTrigger className="h-9 border-2 bg-white border-gray-300 hover:border-gray-400 focus:border-blue-500">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="remove">Remove from Nautobot</SelectItem>
              <SelectItem value="set-offboarding">Set Offboarding Values</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* IP Removal Options */}
        <div className="space-y-3">
          <Label className="text-sm font-semibold text-gray-700">IP Address Removal</Label>
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="remove-primary-ip"
                checked={offboardProperties.removePrimaryIp}
                onCheckedChange={(checked) =>
                  onOffboardPropertiesChange({ removePrimaryIp: checked as boolean })
                }
              />
              <Label htmlFor="remove-primary-ip" className="text-sm font-medium cursor-pointer">
                Remove Primary IP
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="remove-interface-ips"
                checked={offboardProperties.removeInterfaceIps}
                onCheckedChange={(checked) =>
                  onOffboardPropertiesChange({ removeInterfaceIps: checked as boolean })
                }
              />
              <Label htmlFor="remove-interface-ips" className="text-sm font-medium cursor-pointer">
                Remove Interface IPs
              </Label>
            </div>
          </div>
        </div>

        {/* CheckMK Removal Option */}
        <div className="space-y-3">
          <Label className="text-sm font-semibold text-gray-700">CheckMK Integration</Label>
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="remove-from-checkmk"
                checked={offboardProperties.removeFromCheckMK}
                onCheckedChange={(checked) =>
                  onOffboardPropertiesChange({ removeFromCheckMK: checked as boolean })
                }
              />
              <Label htmlFor="remove-from-checkmk" className="text-sm font-medium cursor-pointer">
                Remove from CheckMK
              </Label>
            </div>
          </div>
        </div>

        {/* Offboard Button */}
        <div className="pt-4">
          <Button
            onClick={onOffboard}
            disabled={!isFormValid || isSubmitting}
            className="w-full bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700"
          >
            {isSubmitting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                Offboarding...
              </>
            ) : (
              <>
                <Minus className="h-4 w-4 mr-2" />
                Offboard {selectedCount > 0 ? `${selectedCount} ` : ''}Device{selectedCount !== 1 ? 's' : ''}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
