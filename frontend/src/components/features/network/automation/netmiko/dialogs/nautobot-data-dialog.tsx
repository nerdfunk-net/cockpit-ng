import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { InfoCard } from '../ui/info-card'

interface NautobotDataDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  nautobotData: any
}

export function NautobotDataDialog({ open, onOpenChange, nautobotData }: NautobotDataDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Nautobot Device Details</DialogTitle>
          <DialogDescription>
            Complete device information from Nautobot
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto">
          {nautobotData && (
            <div className="space-y-4">
              {/* Device Overview */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-3">
                  <InfoCard
                    label="Device Name"
                    value={nautobotData.name}
                    colorScheme="blue"
                  />
                  {nautobotData.primary_ip4 && (
                    <InfoCard
                      label="Primary IPv4"
                      value={nautobotData.primary_ip4.address}
                      colorScheme="green"
                    />
                  )}
                  {nautobotData.role && (
                    <InfoCard
                      label="Role"
                      value={nautobotData.role.name}
                      colorScheme="purple"
                    />
                  )}
                </div>
                <div className="space-y-3">
                  {nautobotData.device_type && (
                    <InfoCard
                      label="Device Type"
                      value={nautobotData.device_type.model}
                      colorScheme="orange"
                      sublabel={nautobotData.device_type.manufacturer?.name}
                    />
                  )}
                  {nautobotData.platform && (
                    <InfoCard
                      label="Platform"
                      value={nautobotData.platform.name}
                      colorScheme="indigo"
                    />
                  )}
                  {nautobotData.status && (
                    <InfoCard
                      label="Status"
                      value={nautobotData.status.name}
                      colorScheme="teal"
                    />
                  )}
                </div>
              </div>

              {/* Location */}
              {nautobotData.location && (
                <InfoCard
                  label="Location"
                  value={`${nautobotData.location.name}${nautobotData.location.parent ? ` (${nautobotData.location.parent.name})` : ''}`}
                  colorScheme="gray"
                />
              )}

              {/* Serial & Asset Tag */}
              {(nautobotData.serial || nautobotData.asset_tag) && (
                <div className="grid grid-cols-2 gap-4">
                  {nautobotData.serial && (
                    <InfoCard
                      label="Serial Number"
                      value={nautobotData.serial}
                      colorScheme="gray"
                    />
                  )}
                  {nautobotData.asset_tag && (
                    <InfoCard
                      label="Asset Tag"
                      value={nautobotData.asset_tag}
                      colorScheme="gray"
                    />
                  )}
                </div>
              )}

              {/* Config Context */}
              {nautobotData.config_context && Object.keys(nautobotData.config_context).length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Config Context</Label>
                  <pre className="p-3 bg-gray-900 text-green-400 text-xs font-mono rounded-md overflow-x-auto max-h-60 overflow-y-auto">
                    {JSON.stringify(nautobotData.config_context, null, 2)}
                  </pre>
                </div>
              )}

              {/* Tags */}
              {nautobotData.tags && nautobotData.tags.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Tags</Label>
                  <div className="flex flex-wrap gap-2">
                    {nautobotData.tags.map((tag: { id: number; name: string }) => (
                      <Badge key={tag.id} variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                        {tag.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Full JSON Data */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Full Device Data (JSON)</Label>
                <pre className="p-3 bg-gray-900 text-green-400 text-xs font-mono rounded-md overflow-x-auto max-h-96 overflow-y-auto">
                  {JSON.stringify(nautobotData, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </div>
        <div className="flex justify-end pt-4 border-t">
          <Button onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
