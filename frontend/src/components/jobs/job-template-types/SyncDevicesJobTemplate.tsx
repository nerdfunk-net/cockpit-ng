import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { RefreshCw } from "lucide-react"

interface SyncDevicesJobTemplateProps {
  formActivateChangesAfterSync: boolean
  setFormActivateChangesAfterSync: (value: boolean) => void
}

export function SyncDevicesJobTemplate({
  formActivateChangesAfterSync,
  setFormActivateChangesAfterSync,
}: SyncDevicesJobTemplateProps) {
  return (
    <div className="rounded-lg border border-orange-200 bg-orange-50/30 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <RefreshCw className="h-4 w-4 text-orange-600" />
        <Label className="text-sm font-semibold text-orange-900">Sync Options</Label>
      </div>

      <div className="flex items-center space-x-3">
        <Switch
          id="activate-changes"
          checked={formActivateChangesAfterSync}
          onCheckedChange={setFormActivateChangesAfterSync}
        />
        <Label htmlFor="activate-changes" className="text-sm text-orange-900 cursor-pointer">
          Activate all changes after Sync
        </Label>
      </div>
      <p className="text-xs text-orange-700">
        When enabled, CheckMK configuration changes will be automatically activated after the sync job completes successfully.
      </p>
    </div>
  )
}
