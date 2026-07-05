import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { RefreshCw, GitCompare } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SyncDevicesJobTemplateProps {
  formActivateChangesAfterSync: boolean
  setFormActivateChangesAfterSync: (value: boolean) => void
  formUseLastCompareRun: boolean
  setFormUseLastCompareRun: (value: boolean) => void
  formSyncNotFoundDevices: boolean
  setFormSyncNotFoundDevices: (value: boolean) => void
}

export function SyncDevicesJobTemplate({
  formActivateChangesAfterSync,
  setFormActivateChangesAfterSync,
  formUseLastCompareRun,
  setFormUseLastCompareRun,
  formSyncNotFoundDevices,
  setFormSyncNotFoundDevices,
}: SyncDevicesJobTemplateProps) {
  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-warning-border bg-warning/30 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <RefreshCw className="h-4 w-4 text-warning-foreground" />
          <Label className="text-sm font-semibold text-warning-foreground">Sync Options</Label>
        </div>

        <div className="flex items-center space-x-3">
          <Switch
            id="activate-changes"
            checked={formActivateChangesAfterSync}
            onCheckedChange={setFormActivateChangesAfterSync}
          />
          <Label
            htmlFor="activate-changes"
            className="text-sm text-warning-foreground cursor-pointer"
          >
            Activate all changes after Sync
          </Label>
        </div>
        <p className="text-xs text-warning-foreground">
          When enabled, CheckMK configuration changes will be automatically activated
          after the sync job completes successfully.
        </p>
      </div>

      <div className="rounded-lg border border-info-border bg-info/30 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <GitCompare className="h-4 w-4 text-info-foreground" />
          <Label className="text-sm font-semibold text-info-foreground">Compare Filter</Label>
        </div>

        <div className="flex items-center space-x-3">
          <Switch
            id="use-last-compare-run"
            checked={formUseLastCompareRun}
            onCheckedChange={setFormUseLastCompareRun}
          />
          <Label
            htmlFor="use-last-compare-run"
            className="text-sm text-info-foreground cursor-pointer"
          >
            Use Last Compare Run
          </Label>
        </div>
        <p className="text-xs text-info-foreground">
          When enabled, only devices with differences (or errors) from the last compare
          job will be synced. Devices already matching CheckMK are skipped.
        </p>

        <div
          className={cn('flex items-center space-x-3', !formUseLastCompareRun && 'opacity-50')}
        >
          <Switch
            id="sync-not-found-devices"
            checked={formSyncNotFoundDevices}
            onCheckedChange={setFormSyncNotFoundDevices}
            disabled={!formUseLastCompareRun}
          />
          <Label
            htmlFor="sync-not-found-devices"
            className={cn(
              'text-sm text-info-foreground',
              formUseLastCompareRun ? 'cursor-pointer' : 'cursor-not-allowed'
            )}
          >
            Sync Not-Found Devices
          </Label>
        </div>
        <p className="text-xs text-info-foreground">
          When enabled alongside &quot;Use Last Compare Run&quot;, devices that were not
          part of the last compare job will also be synced.
        </p>
      </div>
    </div>
  )
}
