import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Network,
  List,
  Trash2,
  Tag,
  Loader2,
  ShieldCheck,
} from 'lucide-react'
import { StatusAlert } from '@/components/shared/status-alert'
import { cn } from '@/lib/utils'
import type { IpAddressStatus, IpAddressTag } from '../../types'

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
  // Mark action options
  formIpMarkStatus: string
  setFormIpMarkStatus: (value: string) => void
  formIpMarkTag: string
  setFormIpMarkTag: (value: string) => void
  formIpMarkDescription: string
  setFormIpMarkDescription: (value: string) => void
  // Remove action options
  formIpRemoveSkipAssigned: boolean
  setFormIpRemoveSkipAssigned: (value: boolean) => void
  formIpRemoveSkipReserved: boolean
  setFormIpRemoveSkipReserved: (value: boolean) => void
  ipStatuses: IpAddressStatus[]
  ipTags: IpAddressTag[]
  loadingMarkOptions: boolean
}

const ACTION_OPTIONS = [
  {
    value: 'list',
    label: 'List',
    icon: List,
    description: 'Fetch and display matching IP addresses',
    color: 'text-info-foreground',
  },
  {
    value: 'mark',
    label: 'Mark',
    icon: Tag,
    description: 'Mark matching IP addresses by updating status, tag or description',
    color: 'text-warning-foreground',
  },
  {
    value: 'remove',
    label: 'Remove',
    icon: Trash2,
    description: 'Permanently delete matching IP addresses from Nautobot',
    color: 'text-error-foreground',
  },
]

const FILTER_TYPE_OPTIONS = [
  { value: '__eq__', label: '= (equals)' },
  { value: 'lte', label: '≤ (less than or equal)' },
  { value: 'lt', label: '< (less than)' },
  { value: 'gte', label: '≥ (greater than or equal)' },
  { value: 'gt', label: '> (greater than)' },
  { value: 'contains', label: 'contains' },
]

// Sentinel value meaning "no operator suffix" (equality)
const EQUALITY_SENTINEL = '__eq__'

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
  formIpMarkStatus,
  setFormIpMarkStatus,
  formIpMarkTag,
  setFormIpMarkTag,
  formIpMarkDescription,
  setFormIpMarkDescription,
  formIpRemoveSkipAssigned,
  setFormIpRemoveSkipAssigned,
  formIpRemoveSkipReserved,
  setFormIpRemoveSkipReserved,
  ipStatuses,
  ipTags,
  loadingMarkOptions,
}: MaintainIPAddressesJobTemplateProps) {
  const filterLabel = formIpFilterField
    ? formIpFilterType && formIpFilterType !== EQUALITY_SENTINEL
      ? `${formIpFilterField}__${formIpFilterType} = "${formIpFilterValue || '…'}"`
      : `${formIpFilterField} = "${formIpFilterValue || '…'}"`
    : null

  return (
    <>
      {/* Action Selection */}
      <div className="rounded-lg border border-success-border bg-success/30 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Network className="h-4 w-4 text-success-foreground" />
          <Label className="text-sm font-semibold text-success-foreground">Action</Label>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {ACTION_OPTIONS.map(({ value, label, icon: Icon, description, color }) => (
            <button
              key={value}
              type="button"
              onClick={() => setFormIpAction(value)}
              className={cn(
                'flex flex-col items-center gap-2 rounded-lg border-2 p-3 text-sm transition-all',
                formIpAction === value
                  ? 'border-primary bg-primary/10 shadow-sm'
                  : 'border-border bg-card hover:border-primary/40 cursor-pointer'
              )}
            >
              <Icon className={cn('h-5 w-5', color)} />
              <span className="font-medium text-center leading-tight">{label}</span>
              <span className="text-xs text-muted-foreground text-center leading-tight">
                {description}
              </span>
            </button>
          ))}
        </div>

        {formIpAction === 'remove' && (
          <StatusAlert variant="error">
            <strong>Destructive action:</strong> All matching IP addresses will be
            permanently deleted from Nautobot. This cannot be undone.
          </StatusAlert>
        )}
      </div>

      {/* Removal Options – shown only when action is "remove" */}
      {formIpAction === 'remove' && (
        <div className="rounded-lg border border-error-border bg-error/30 p-4 space-y-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-error-foreground" />
            <Label className="text-sm font-semibold text-error-foreground">
              Removal Options
            </Label>
          </div>

          <div className="flex items-center space-x-3">
            <Switch
              id="ip-remove-skip-assigned"
              checked={formIpRemoveSkipAssigned}
              onCheckedChange={setFormIpRemoveSkipAssigned}
            />
            <div>
              <Label
                htmlFor="ip-remove-skip-assigned"
                className="text-sm text-error-foreground cursor-pointer"
              >
                Skip Assigned IP-Addresses
              </Label>
              <p className="text-xs text-error-foreground mt-0.5">
                When enabled, IP addresses that are currently assigned to an interface
                will be skipped and not deleted.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <Switch
              id="ip-remove-skip-reserved"
              checked={formIpRemoveSkipReserved}
              onCheckedChange={setFormIpRemoveSkipReserved}
            />
            <div>
              <Label
                htmlFor="ip-remove-skip-reserved"
                className="text-sm text-error-foreground cursor-pointer"
              >
                Skip Reserved IP-Addresses
              </Label>
              <p className="text-xs text-error-foreground mt-0.5">
                When enabled, IP addresses with status &quot;Reserved&quot; will be skipped
                and not deleted.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Mark Options – shown only when action is "mark" */}
      {formIpAction === 'mark' && (
        <div className="rounded-lg border border-warning-border bg-warning/30 p-4 space-y-4">
          <div className="flex items-center gap-2">
            <Tag className="h-4 w-4 text-warning-foreground" />
            <Label className="text-sm font-semibold text-warning-foreground">Mark Options</Label>
            {loadingMarkOptions && (
              <Loader2 className="h-3 w-3 animate-spin text-warning-foreground ml-1" />
            )}
            <span className="text-xs text-warning-foreground ml-auto">
              Select one or more options to apply to matching IP addresses
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Status */}
            <div className="space-y-2">
              <Label htmlFor="ip-mark-status" className="text-sm text-warning-foreground">
                New Status{' '}
                <span className="text-muted-foreground text-xs">(optional)</span>
              </Label>
              <Select
                value={formIpMarkStatus || '__none__'}
                onValueChange={v => setFormIpMarkStatus(v === '__none__' ? '' : v)}
                disabled={loadingMarkOptions}
              >
                <SelectTrigger
                  id="ip-mark-status"
                  className="bg-card border-warning-border focus:border-primary focus:ring-ring/30"
                >
                  <SelectValue placeholder="Keep existing status…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Keep existing status —</SelectItem>
                  {ipStatuses.map(s => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-warning-foreground">
                Set a new status on all matching IP addresses.
              </p>
            </div>

            {/* Tag */}
            <div className="space-y-2">
              <Label htmlFor="ip-mark-tag" className="text-sm text-warning-foreground">
                Add Tag{' '}
                <span className="text-muted-foreground text-xs">(optional)</span>
              </Label>
              <Select
                value={formIpMarkTag || '__none__'}
                onValueChange={v => setFormIpMarkTag(v === '__none__' ? '' : v)}
                disabled={loadingMarkOptions}
              >
                <SelectTrigger
                  id="ip-mark-tag"
                  className="bg-card border-warning-border focus:border-primary focus:ring-ring/30"
                >
                  <SelectValue placeholder="No tag…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— No tag —</SelectItem>
                  {ipTags.map(t => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-warning-foreground">
                Assign a tag to all matching IP addresses.
              </p>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="ip-mark-description" className="text-sm text-warning-foreground">
              Update Description{' '}
              <span className="text-muted-foreground text-xs">(optional)</span>
            </Label>
            <Input
              id="ip-mark-description"
              value={formIpMarkDescription}
              onChange={e => setFormIpMarkDescription(e.target.value)}
              placeholder="Leave empty to keep existing description…"
              className="bg-card border-warning-border focus:border-primary focus:ring-ring/30"
            />
            <p className="text-xs text-warning-foreground">
              Overwrite the description on all matching IP addresses.
            </p>
          </div>
        </div>
      )}

      {/* Filter Configuration */}
      <div className="rounded-lg border border-success-border bg-success/30 p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Network className="h-4 w-4 text-success-foreground" />
          <Label className="text-sm font-semibold text-success-foreground">Filter</Label>
          {filterLabel && (
            <code className="ml-auto text-xs bg-success text-success-foreground px-2 py-0.5 rounded font-mono">
              {filterLabel}
            </code>
          )}
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="ip-filter-field" className="text-sm text-success-foreground">
              Field <span className="text-destructive">*</span>
            </Label>
            <Input
              id="ip-filter-field"
              value={formIpFilterField}
              onChange={e => setFormIpFilterField(e.target.value)}
              placeholder="e.g. cf_last_scan"
              className="bg-card border-success-border focus:border-primary focus:ring-ring/30 font-mono text-sm"
            />
            <p className="text-xs text-success-foreground">
              Nautobot field name. Use <code>cf_</code> prefix for custom fields.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ip-filter-type" className="text-sm text-success-foreground">
              Operator
            </Label>
            <Select
              value={formIpFilterType || EQUALITY_SENTINEL}
              onValueChange={setFormIpFilterType}
            >
              <SelectTrigger className="bg-card border-success-border focus:border-primary focus:ring-ring/30">
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
            <p className="text-xs text-success-foreground">
              Comparison operator for the filter.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ip-filter-value" className="text-sm text-success-foreground">
              Value <span className="text-destructive">*</span>
            </Label>
            <Input
              id="ip-filter-value"
              value={formIpFilterValue}
              onChange={e => setFormIpFilterValue(e.target.value)}
              placeholder="e.g. 2026-02-19 or {today-14}"
              className="bg-card border-success-border focus:border-primary focus:ring-ring/30 font-mono text-sm"
            />
            <div className="flex flex-wrap gap-1">
              {['{today}', '{today-7}', '{today-14}', '{today-30}', '{today+7}'].map(
                tpl => (
                  <button
                    key={tpl}
                    type="button"
                    onClick={() => setFormIpFilterValue(tpl)}
                    className="text-xs font-mono px-1.5 py-0.5 rounded bg-success text-success-foreground hover:opacity-80 border border-success-border transition-colors"
                  >
                    {tpl}
                  </button>
                )
              )}
            </div>
            <p className="text-xs text-success-foreground">
              Fixed value (e.g. <code>2026-02-19</code>) or a date template. Templates
              are resolved at run time: <code>{'{today}'}</code> = today,{' '}
              <code>{'{today-N}'}</code> / <code>{'{today+N}'}</code> = N days
              before/after today.
            </p>
          </div>
        </div>

        <div className="pt-2 border-t border-success-border">
          <div className="flex items-center space-x-3">
            <Switch
              id="ip-include-null"
              checked={formIpIncludeNull}
              onCheckedChange={setFormIpIncludeNull}
            />
            <div>
              <Label
                htmlFor="ip-include-null"
                className="text-sm text-success-foreground cursor-pointer"
              >
                Include IPs where field is null
              </Label>
              <p className="text-xs text-success-foreground mt-0.5">
                When enabled, also includes IP addresses where the field has never been
                set.
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
