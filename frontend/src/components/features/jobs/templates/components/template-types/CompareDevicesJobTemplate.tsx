import { Label } from "@/components/ui/label"
import { GitCompare, Info } from "lucide-react"

export function CompareDevicesJobTemplate() {
  return (
    <div className="rounded-lg border border-purple-200 bg-purple-50/30 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <GitCompare className="h-4 w-4 text-purple-600" />
        <Label className="text-sm font-semibold text-purple-900">Compare Devices</Label>
      </div>

      <div className="flex items-start gap-2 bg-purple-100/50 border border-purple-200 rounded-md p-3">
        <Info className="h-4 w-4 text-purple-600 mt-0.5 flex-shrink-0" />
        <div className="space-y-2 text-sm text-purple-900">
          <p className="leading-relaxed">
            This job compares device configurations between Nautobot and CheckMK to identify discrepancies.
          </p>
          <ul className="list-disc list-inside space-y-1 text-purple-800">
            <li>Fetches device data from Nautobot</li>
            <li>Retrieves corresponding configuration from CheckMK</li>
            <li>Compares and reports differences</li>
            <li>Results are stored and viewable in the Sync Devices app</li>
          </ul>
        </div>
      </div>

      <p className="text-xs text-purple-600">
        No additional configuration required - the job will compare all selected devices automatically
      </p>
    </div>
  )
}
