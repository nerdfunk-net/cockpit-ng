import { Label } from '@/components/ui/label'
import { GitCompare } from 'lucide-react'
import { StatusAlert } from '@/components/shared/status-alert'

export function CompareDevicesJobTemplate() {
  return (
    <div className="rounded-lg border border-info-border bg-info/30 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <GitCompare className="h-4 w-4 text-info-foreground" />
        <Label className="text-sm font-semibold text-info-foreground">Compare Devices</Label>
      </div>

      <StatusAlert variant="info">
        <div className="space-y-2 text-sm">
          <p className="leading-relaxed">
            This job compares device configurations between Nautobot and CheckMK to
            identify discrepancies.
          </p>
          <ul className="list-disc list-inside space-y-1">
            <li>Fetches device data from Nautobot</li>
            <li>Retrieves corresponding configuration from CheckMK</li>
            <li>Compares and reports differences</li>
            <li>Results are stored and viewable in the Sync Devices app</li>
          </ul>
        </div>
      </StatusAlert>

      <p className="text-xs text-info-foreground">
        No additional configuration required - the job will compare all selected devices
        automatically
      </p>
    </div>
  )
}
