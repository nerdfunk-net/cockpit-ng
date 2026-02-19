import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Network, AlertTriangle, List, Trash2, Tag } from "lucide-react"

interface MaintainIPAddressesJobTemplateProps {
  formIpAction: string
  setFormIpAction: (value: string) => void
  formIpFilterField: string
  setFormIpFilterField: (value: string) => void
  formIpFilterType: string
  setFormIpFilterType: (value: string) => void
  formIpFilterValue: string
  setFormIpFilterValue: (value: string) => void
  formIpIncludeNull: boolean
  setFormIpIncludeNull: (value: boolean) => void
}

const ACTION_OPTIONS = [
  {
    value: "list",
    label: "List",
    icon: List,
    description: "Fetch and display matching IP addresses",
    color: "text-blue-600",
  },
  {
    value: "mark",
    label: "Mark (coming soon)",
    icon: Tag,
    description: "Mark matching IP addresses with a custom field",
    color: "text-yellow-600",
    disabled: true,
  },
  {
    value: "remove",
    label: "Remove",
    icon: Trash2,
    description: "Permanently delete matching IP addresses from Nautobot",
    color: "text-red-600",
  },
]

const FILTER_TYPE_OPTIONS = [
  { value: "__eq__", label: "= (equals)" },
  { value: "lte",   label: "≤ (less than or equal)" },
  { value: "lt",    label: "< (less than)" },
  { value: "gte",   label: "≥ (greater than or equal)" },
  { value: "gt",    label: "> (greater than)" },
  { value: "contains", label: "contains" },
]

// Sentinel value meaning "no operator suffix" (equality)
const EQUALITY_SENTINEL = "__eq__"

export function MaintainIPAddressesJobTemplate({
  formIpAction,
  setFormIpAction,
  formIpFilterField,
  setFormIpFilterField,
  formIpFilterType,
  setFormIpFilterType,
  formIpFilterValue,
  setFormIpFilterValue,
  formIpIncludeNull,
  setFormIpIncludeNull,
}: MaintainIPAddressesJobTemplateProps) {
  const filterLabel =
    formIpFilterField
      ? formIpFilterType && formIpFilterType !== EQUALITY_SENTINEL
        ? `${formIpFilterField}__${formIpFilterType} = "${formIpFilterValue || "…"}"`
        : `${formIpFilterField} = "${formIpFilterValue || "…"}"`
      : null

  return (
    <>
      {/* Action Selection */}
      <div className="rounded-lg border border-emerald-200 bg-emerald-50/30 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Network className="h-4 w-4 text-emerald-600" />
          <Label className="text-sm font-semibold text-emerald-900">Action</Label>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {ACTION_OPTIONS.map(({ value, label, icon: Icon, description, color, disabled }) => (
            <button
              key={value}
              type="button"
              disabled={disabled}
              onClick={() => !disabled && setFormIpAction(value)}
              className={[
                "flex flex-col items-center gap-2 rounded-lg border-2 p-3 text-sm transition-all",
                disabled
                  ? "cursor-not-allowed opacity-40 border-gray-200 bg-white"
                  : formIpAction === value
                    ? "border-emerald-500 bg-emerald-50 shadow-sm"
                    : "border-gray-200 bg-white hover:border-emerald-300 cursor-pointer",
              ].join(" ")}
            >
              <Icon className={`h-5 w-5 ${color}`} />
              <span className="font-medium text-center leading-tight">{label}</span>
              <span className="text-xs text-muted-foreground text-center leading-tight">
                {description}
              </span>
            </button>
          ))}
        </div>

        {formIpAction === "remove" && (
          <div className="flex items-start gap-2 rounded-md bg-red-50 border border-red-200 p-3">
            <AlertTriangle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
            <p className="text-sm text-red-800">
              <strong>Destructive action:</strong> All matching IP addresses will be
              permanently deleted from Nautobot. This cannot be undone.
            </p>
          </div>
        )}
      </div>

      {/* Filter Configuration */}
      <div className="rounded-lg border border-emerald-200 bg-emerald-50/30 p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Network className="h-4 w-4 text-emerald-600" />
          <Label className="text-sm font-semibold text-emerald-900">Filter</Label>
          {filterLabel && (
            <code className="ml-auto text-xs bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-mono">
              {filterLabel}
            </code>
          )}
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="ip-filter-field" className="text-sm text-emerald-900">
              Field <span className="text-red-500">*</span>
            </Label>
            <Input
              id="ip-filter-field"
              value={formIpFilterField}
              onChange={(e) => setFormIpFilterField(e.target.value)}
              placeholder="e.g. cf_last_scan"
              className="bg-white border-emerald-200 focus:border-emerald-400 focus:ring-emerald-400 font-mono text-sm"
            />
            <p className="text-xs text-emerald-700">
              Nautobot field name. Use <code>cf_</code> prefix for custom fields.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ip-filter-type" className="text-sm text-emerald-900">
              Operator
            </Label>
            <Select
              value={formIpFilterType || EQUALITY_SENTINEL}
              onValueChange={setFormIpFilterType}
            >
              <SelectTrigger className="bg-white border-emerald-200 focus:border-emerald-400 focus:ring-emerald-400">
                <SelectValue placeholder="Select operator…" />
              </SelectTrigger>
              <SelectContent>
                {FILTER_TYPE_OPTIONS.map(({ value, label }) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-emerald-700">
              Comparison operator for the filter.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ip-filter-value" className="text-sm text-emerald-900">
              Value <span className="text-red-500">*</span>
            </Label>
            <Input
              id="ip-filter-value"
              value={formIpFilterValue}
              onChange={(e) => setFormIpFilterValue(e.target.value)}
              placeholder="e.g. 2026-02-19 or {today-14}"
              className="bg-white border-emerald-200 focus:border-emerald-400 focus:ring-emerald-400 font-mono text-sm"
            />
            <div className="flex flex-wrap gap-1">
              {["{today}", "{today-7}", "{today-14}", "{today-30}", "{today+7}"].map((tpl) => (
                <button
                  key={tpl}
                  type="button"
                  onClick={() => setFormIpFilterValue(tpl)}
                  className="text-xs font-mono px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border border-emerald-300 transition-colors"
                >
                  {tpl}
                </button>
              ))}
            </div>
            <p className="text-xs text-emerald-700">
              Fixed value (e.g. <code>2026-02-19</code>) or a date template. Templates are resolved at run time:
              {" "}<code>{"{today}"}</code> = today,{" "}
              <code>{"{today-N}"}</code> / <code>{"{today+N}"}</code> = N days before/after today.
            </p>
          </div>
        </div>

        <div className="pt-2 border-t border-emerald-200">
          <div className="flex items-center space-x-3">
            <Switch
              id="ip-include-null"
              checked={formIpIncludeNull}
              onCheckedChange={setFormIpIncludeNull}
            />
            <div>
              <Label htmlFor="ip-include-null" className="text-sm text-emerald-900 cursor-pointer">
                Include IPs where field is null
              </Label>
              <p className="text-xs text-emerald-700 mt-0.5">
                When enabled, also includes IP addresses where the field has never been set.
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
