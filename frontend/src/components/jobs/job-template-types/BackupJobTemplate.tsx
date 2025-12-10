import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { FileText, Clock } from "lucide-react"

interface CustomField {
  id: string
  name?: string
  key: string
  label: string
  type: {
    value: string
    label: string
  }
}

interface BackupJobTemplateProps {
  formBackupRunningConfigPath: string
  setFormBackupRunningConfigPath: (value: string) => void
  formBackupStartupConfigPath: string
  setFormBackupStartupConfigPath: (value: string) => void
  formWriteTimestampToCustomField: boolean
  setFormWriteTimestampToCustomField: (value: boolean) => void
  formTimestampCustomFieldName: string
  setFormTimestampCustomFieldName: (value: string) => void
  customFields: CustomField[]
}

export function BackupJobTemplate({
  formBackupRunningConfigPath,
  setFormBackupRunningConfigPath,
  formBackupStartupConfigPath,
  setFormBackupStartupConfigPath,
  formWriteTimestampToCustomField,
  setFormWriteTimestampToCustomField,
  formTimestampCustomFieldName,
  setFormTimestampCustomFieldName,
  customFields,
}: BackupJobTemplateProps) {
  return (
    <>
      {/* Backup Paths Section */}
      <div className="rounded-lg border border-amber-200 bg-amber-50/30 p-4 space-y-4">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-amber-600" />
          <Label className="text-sm font-semibold text-amber-900">Backup Configuration Paths</Label>
        </div>

        <div className="bg-amber-100/50 border border-amber-200 rounded-md px-3 py-2 space-y-1">
          <p className="text-xs text-amber-800 leading-relaxed">
            <span className="font-semibold">Available variables</span> (leave empty to use defaults):
          </p>
          <p className="text-xs text-amber-700 leading-relaxed">
            Device: {"{device_name}"}, {"{hostname}"}, {"{serial}"}, {"{asset_tag}"}
          </p>
          <p className="text-xs text-amber-700 leading-relaxed">
            Location: {"{location.name}"}, {"{location.parent.name}"}, {"{location.parent.parent.name}"}
          </p>
          <p className="text-xs text-amber-700 leading-relaxed">
            Platform: {"{platform.name}"}, {"{platform.manufacturer.name}"}, {"{device_type.model}"}
          </p>
          <p className="text-xs text-amber-700 leading-relaxed">
            Other: {"{role.name}"}, {"{status.name}"}, {"{tenant.name}"}, {"{rack.name}"}, {"{custom_field_data.FIELD_NAME}"}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4">
          <div className="space-y-2">
            <Label htmlFor="running-config-path" className="text-sm text-amber-900 font-medium flex items-center gap-1">
              Running Config Path <span className="text-xs text-amber-600 font-normal">(optional)</span>
            </Label>
            <Input
              id="running-config-path"
              placeholder="{custom_field_data.cf_net}/{location.name}/{device_name}.running_config"
              value={formBackupRunningConfigPath}
              onChange={(e) => setFormBackupRunningConfigPath(e.target.value)}
              className="h-9 bg-white border-amber-200 font-mono text-sm focus:ring-amber-500 focus:border-amber-500"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="startup-config-path" className="text-sm text-amber-900 font-medium flex items-center gap-1">
              Startup Config Path <span className="text-xs text-amber-600 font-normal">(optional)</span>
            </Label>
            <Input
              id="startup-config-path"
              placeholder="{custom_field_data.cf_net}/{location.name}/{device_name}.startup_config"
              value={formBackupStartupConfigPath}
              onChange={(e) => setFormBackupStartupConfigPath(e.target.value)}
              className="h-9 bg-white border-amber-200 font-mono text-sm focus:ring-amber-500 focus:border-amber-500"
            />
          </div>
        </div>
      </div>

      {/* Backup Timestamp Section */}
      <div className="rounded-lg border border-teal-200 bg-teal-50/30 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Clock className="h-4 w-4 text-teal-600" />
          <Label className="text-sm font-semibold text-teal-900">Backup Timestamp</Label>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center space-x-3">
            <Switch
              id="write-timestamp"
              checked={formWriteTimestampToCustomField}
              onCheckedChange={(checked) => {
                setFormWriteTimestampToCustomField(checked)
                if (!checked) {
                  setFormTimestampCustomFieldName("")
                }
              }}
            />
            <Label htmlFor="write-timestamp" className="text-sm text-teal-900 cursor-pointer">
              Write timestamp to custom field
            </Label>
          </div>

          {formWriteTimestampToCustomField && (
            <div className="flex-1">
              <Select
                value={formTimestampCustomFieldName}
                onValueChange={setFormTimestampCustomFieldName}
                disabled={customFields.length === 0}
              >
                <SelectTrigger id="timestamp-custom-field" className="h-9 bg-white border-teal-200">
                  <SelectValue placeholder={customFields.length === 0 ? "No suitable custom fields found" : "Select custom field..."} />
                </SelectTrigger>
                <SelectContent>
                  {customFields.map((field) => (
                    <SelectItem key={field.id} value={field.key}>
                      <div className="flex items-center gap-2">
                        <span>{field.label}</span>
                        <Badge variant="secondary" className="text-xs">
                          {field.type.label}
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        <p className="text-xs text-teal-600 mt-2">
          When enabled, the backup completion timestamp will be written to the selected custom field in Nautobot
        </p>
      </div>
    </>
  )
}
