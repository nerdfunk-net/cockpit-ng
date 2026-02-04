import { useEffect, useState, useCallback } from "react"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Radar, Network } from "lucide-react"
import { useAuthStore } from "@/lib/auth-store"

interface CustomField {
  id: string
  name?: string
  key: string
  label: string
  type: {
    value: string
    label: string
  }
  choices?: Array<{
    value: string
    display: string
  }>
}

interface ScanPrefixesJobTemplateProps {
  formScanResolveDns: boolean
  setFormScanResolveDns: (value: boolean) => void
  formScanPingCount: string
  setFormScanPingCount: (value: string) => void
  formScanTimeoutMs: string
  setFormScanTimeoutMs: (value: string) => void
  formScanRetries: string
  setFormScanRetries: (value: string) => void
  formScanIntervalMs: string
  setFormScanIntervalMs: (value: string) => void
  formScanCustomFieldName: string
  setFormScanCustomFieldName: (value: string) => void
  formScanCustomFieldValue: string
  setFormScanCustomFieldValue: (value: string) => void
  formScanResponseCustomFieldName: string
  setFormScanResponseCustomFieldName: (value: string) => void
  formScanSetReachableIpActive: boolean
  setFormScanSetReachableIpActive: (value: boolean) => void
  formScanMaxIps: string
  setFormScanMaxIps: (value: string) => void
}

const EMPTY_CUSTOM_FIELDS: CustomField[] = []

export function ScanPrefixesJobTemplate({
  formScanResolveDns,
  setFormScanResolveDns,
  formScanPingCount,
  setFormScanPingCount,
  formScanTimeoutMs,
  setFormScanTimeoutMs,
  formScanRetries,
  setFormScanRetries,
  formScanIntervalMs,
  setFormScanIntervalMs,
  formScanCustomFieldName,
  setFormScanCustomFieldName,
  formScanCustomFieldValue,
  setFormScanCustomFieldValue,
  formScanResponseCustomFieldName,
  setFormScanResponseCustomFieldName,
  formScanSetReachableIpActive,
  setFormScanSetReachableIpActive,
  formScanMaxIps,
  setFormScanMaxIps,
}: ScanPrefixesJobTemplateProps) {
  const token = useAuthStore(state => state.token)
  const [customFields, setCustomFields] = useState<CustomField[]>(EMPTY_CUSTOM_FIELDS)
  const [selectedFieldChoices, setSelectedFieldChoices] = useState<Array<{ value: string, display: string }>>([])
  const [loadingCustomFields, setLoadingCustomFields] = useState(false)

  // Fetch custom fields for ipam.prefix
  const fetchCustomFields = useCallback(async () => {
    if (!token) return

    setLoadingCustomFields(true)
    try {
      const response = await fetch("/api/proxy/api/nautobot/custom-fields/prefixes", {
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      })

      if (response.ok) {
        const data = await response.json()
        setCustomFields(data || [])
      }
    } catch (error) {
      console.error("Error fetching prefix custom fields:", error)
    } finally {
      setLoadingCustomFields(false)
    }
  }, [token])

  useEffect(() => {
    fetchCustomFields()
  }, [fetchCustomFields])

  // When a custom field is selected, check if it has choices
  useEffect(() => {
    if (formScanCustomFieldName) {
      const field = customFields.find(f => f.key === formScanCustomFieldName)
      if (field?.choices && field.choices.length > 0) {
        setSelectedFieldChoices(field.choices)
      } else {
        setSelectedFieldChoices([])
      }
    } else {
      setSelectedFieldChoices([])
    }
  }, [formScanCustomFieldName, customFields])

  const getSelectedFieldType = useCallback(() => {
    const field = customFields.find(f => f.key === formScanCustomFieldName)
    return field?.type?.value?.toLowerCase() || 'text'
  }, [formScanCustomFieldName, customFields])

  return (
    <>
      {/* Custom Field Selection Section */}
      <div className="rounded-lg border border-purple-200 bg-purple-50/30 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Network className="h-4 w-4 text-purple-600" />
          <Label className="text-sm font-semibold text-purple-900">Prefix Custom Fields</Label>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="custom-field-name" className="text-sm text-purple-900">
              Scan Condition
            </Label>
            <Select
              value={formScanCustomFieldName}
              onValueChange={setFormScanCustomFieldName}
              disabled={loadingCustomFields}
            >
              <SelectTrigger className="bg-white border-purple-200 focus:border-purple-400 focus:ring-purple-400">
                <SelectValue placeholder={loadingCustomFields ? "Loading..." : "Select custom field..."} />
              </SelectTrigger>
              <SelectContent>
                {customFields.map((field) => (
                  <SelectItem key={field.key} value={field.key}>
                    {field.label} ({field.type.label})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-purple-700">
              Select the custom field on prefixes to filter by (content_type: ipam.prefix)
            </p>
          </div>

          {formScanCustomFieldName && (
            <div className="space-y-2">
              <Label htmlFor="custom-field-value" className="text-sm text-purple-900">
                Custom Field Value
              </Label>
              {getSelectedFieldType() === 'boolean' ? (
                <Select
                  value={formScanCustomFieldValue}
                  onValueChange={setFormScanCustomFieldValue}
                >
                  <SelectTrigger className="bg-white border-purple-200 focus:border-purple-400 focus:ring-purple-400">
                    <SelectValue placeholder="Select value..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">True</SelectItem>
                    <SelectItem value="false">False</SelectItem>
                  </SelectContent>
                </Select>
              ) : selectedFieldChoices.length > 0 ? (
                <Select
                  value={formScanCustomFieldValue}
                  onValueChange={setFormScanCustomFieldValue}
                >
                  <SelectTrigger className="bg-white border-purple-200 focus:border-purple-400 focus:ring-purple-400">
                    <SelectValue placeholder="Select value..." />
                  </SelectTrigger>
                  <SelectContent>
                    {selectedFieldChoices.map((choice) => (
                      <SelectItem key={choice.value} value={choice.value}>
                        {choice.display}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  id="custom-field-value"
                  type="text"
                  value={formScanCustomFieldValue}
                  onChange={(e) => setFormScanCustomFieldValue(e.target.value)}
                  placeholder="Enter value..."
                  className="bg-white border-purple-200 focus:border-purple-400 focus:ring-purple-400"
                />
              )}
              <p className="text-xs text-purple-700">
                Prefixes with this custom field value will be scanned
              </p>
            </div>
          )}
        </div>

        {/* Response Custom Field */}
        <div className="grid grid-cols-2 gap-4 pt-2 border-t border-purple-200">
          <div className="space-y-2">
            <Label htmlFor="response-custom-field-name" className="text-sm text-purple-900">
              Write Response to
            </Label>
            <Select
              value={formScanResponseCustomFieldName}
              onValueChange={setFormScanResponseCustomFieldName}
              disabled={loadingCustomFields}
            >
              <SelectTrigger className="bg-white border-purple-200 focus:border-purple-400 focus:ring-purple-400">
                <SelectValue placeholder={loadingCustomFields ? "Loading..." : "Select custom field..."} />
              </SelectTrigger>
              <SelectContent>
                {customFields.map((field) => (
                  <SelectItem key={field.key} value={field.key}>
                    {field.label} ({field.type.label})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-purple-700">
              Optional: Write scan results to this custom field (content_type: ipam.prefix)
            </p>
          </div>
        </div>

        {/* Set Reachable IP to Active */}
        <div className="pt-2 border-t border-purple-200">
          <div className="flex items-center space-x-3">
            <Switch
              id="scan-set-reachable-ip-active"
              checked={formScanSetReachableIpActive}
              onCheckedChange={setFormScanSetReachableIpActive}
            />
            <Label htmlFor="scan-set-reachable-ip-active" className="text-sm text-purple-900 cursor-pointer">
              Set reachable IP to Active
            </Label>
          </div>
          <p className="text-xs text-purple-700 mt-1">
            When enabled, all reachable IP addresses will be updated with status=Active
          </p>
        </div>
      </div>

      {/* Scan Options Section */}
      <div className="rounded-lg border border-purple-200 bg-purple-50/30 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Radar className="h-4 w-4 text-purple-600" />
          <Label className="text-sm font-semibold text-purple-900">Scan Options</Label>
        </div>

        <div className="flex items-center space-x-3">
          <Switch
            id="scan-resolve-dns"
            checked={formScanResolveDns}
            onCheckedChange={setFormScanResolveDns}
          />
          <Label htmlFor="scan-resolve-dns" className="text-sm text-purple-900 cursor-pointer">
            Resolve DNS
          </Label>
        </div>
        <p className="text-xs text-purple-700">
          When enabled, DNS names will be resolved during network scanning.
        </p>

        <div className="grid grid-cols-2 gap-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="scan-ping-count" className="text-sm text-purple-900">
              Ping Count
            </Label>
            <Input
              id="scan-ping-count"
              type="number"
              min="1"
              max="10"
              value={formScanPingCount}
              onChange={(e) => setFormScanPingCount(e.target.value)}
              placeholder="3"
              className="bg-white border-purple-200 focus:border-purple-400 focus:ring-purple-400"
            />
            <p className="text-xs text-purple-700">Number of ping attempts per host (1-10)</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="scan-timeout-ms" className="text-sm text-purple-900">
              Timeout (ms)
            </Label>
            <Input
              id="scan-timeout-ms"
              type="number"
              min="100"
              max="30000"
              value={formScanTimeoutMs}
              onChange={(e) => setFormScanTimeoutMs(e.target.value)}
              placeholder="1000"
              className="bg-white border-purple-200 focus:border-purple-400 focus:ring-purple-400"
            />
            <p className="text-xs text-purple-700">Timeout in milliseconds (100-30000)</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="scan-retries" className="text-sm text-purple-900">
              Retries
            </Label>
            <Input
              id="scan-retries"
              type="number"
              min="0"
              max="5"
              value={formScanRetries}
              onChange={(e) => setFormScanRetries(e.target.value)}
              placeholder="2"
              className="bg-white border-purple-200 focus:border-purple-400 focus:ring-purple-400"
            />
            <p className="text-xs text-purple-700">Number of retry attempts (0-5)</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="scan-max-ips" className="text-sm text-purple-900">
              Max IPs per Scan
            </Label>
            <Input
              id="scan-max-ips"
              type="number"
              min="0"
              value={formScanMaxIps}
              onChange={(e) => setFormScanMaxIps(e.target.value)}
              placeholder="No limit"
              className="bg-white border-purple-200 focus:border-purple-400 focus:ring-purple-400"
            />
            <p className="text-xs text-purple-700">Maximum number of IPs to scan. Larger jobs will be split.</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="scan-interval-ms" className="text-sm text-purple-900">
              Interval (ms)
            </Label>
            <Input
              id="scan-interval-ms"
              type="number"
              min="0"
              max="10000"
              value={formScanIntervalMs}
              onChange={(e) => setFormScanIntervalMs(e.target.value)}
              placeholder="100"
              className="bg-white border-purple-200 focus:border-purple-400 focus:ring-purple-400"
            />
            <p className="text-xs text-purple-700">Interval between scans in milliseconds (0-10000)</p>
          </div>
        </div>
      </div>
    </>
  )
}
