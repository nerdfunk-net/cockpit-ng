import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Database } from 'lucide-react'

interface GetClientDataJobTemplateProps {
  collectIpAddress: boolean
  setCollectIpAddress: (value: boolean) => void
  collectMacAddress: boolean
  setCollectMacAddress: (value: boolean) => void
  collectHostname: boolean
  setCollectHostname: (value: boolean) => void
}

export function GetClientDataJobTemplate({
  collectIpAddress,
  setCollectIpAddress,
  collectMacAddress,
  setCollectMacAddress,
  collectHostname,
  setCollectHostname,
}: GetClientDataJobTemplateProps) {
  return (
    <div className="rounded-lg border border-emerald-200 bg-emerald-50/30 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Database className="h-4 w-4 text-emerald-600" />
        <Label className="text-sm font-semibold text-emerald-900">Collect Properties</Label>
      </div>
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Checkbox
            id="collect-ip"
            checked={collectIpAddress}
            onCheckedChange={checked => setCollectIpAddress(checked === true)}
          />
          <Label htmlFor="collect-ip" className="text-sm font-normal cursor-pointer">
            IP Address <span className="text-xs text-muted-foreground">(from ARP table)</span>
          </Label>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            id="collect-mac"
            checked={collectMacAddress}
            onCheckedChange={checked => setCollectMacAddress(checked === true)}
          />
          <Label htmlFor="collect-mac" className="text-sm font-normal cursor-pointer">
            MAC Address <span className="text-xs text-muted-foreground">(from MAC address table)</span>
          </Label>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            id="collect-hostname"
            checked={collectHostname}
            onCheckedChange={checked => setCollectHostname(checked === true)}
          />
          <Label htmlFor="collect-hostname" className="text-sm font-normal cursor-pointer">
            Resolve Hostname <span className="text-xs text-muted-foreground">(DNS lookup)</span>
          </Label>
        </div>
      </div>
      <p className="text-xs text-emerald-600">
        Requires SSH credentials. All collected rows share a session ID as the join key.
      </p>
    </div>
  )
}
