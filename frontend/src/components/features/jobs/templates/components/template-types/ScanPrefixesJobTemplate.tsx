import { useEffect, useState, useCallback } from 'react'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Radar, Network } from 'lucide-react'
import { useAuthStore } from '@/lib/auth-store'

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

interface NautobotLocation {
  id: string
  name: string
  description?: string
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
  formScanConditionType: string
  setFormScanConditionType: (value: string) => void
  formScanLocationName: string
  setFormScanLocationName: (value: string) => void
  formScanCidr: string
  setFormScanCidr: (value: string) => void
}

const EMPTY_CUSTOM_FIELDS: CustomField[] = []
const EMPTY_LOCATIONS: NautobotLocation[] = []

const SELECT_TRIGGER_CLASSES = 'bg-card border-info-border focus:border-primary focus:ring-ring/30'
const INPUT_CLASSES = 'bg-card border-info-border focus:border-primary focus:ring-ring/30'

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
  formScanConditionType,
  setFormScanConditionType,
  formScanLocationName,
  setFormScanLocationName,
  formScanCidr,
  setFormScanCidr,
}: ScanPrefixesJobTemplateProps) {
  const isAuthenticated = useAuthStore(state => state.isAuthenticated)
  const [customFields, setCustomFields] = useState<CustomField[]>(EMPTY_CUSTOM_FIELDS)
  const [locations, setLocations] = useState<NautobotLocation[]>(EMPTY_LOCATIONS)
  const [selectedFieldChoices, setSelectedFieldChoices] = useState<
    Array<{ value: string; display: string }>
  >([])
  const [loadingCustomFields, setLoadingCustomFields] = useState(false)
  const [loadingLocations, setLoadingLocations] = useState(false)

  const fetchCustomFields = useCallback(async () => {
    if (!isAuthenticated) return
    setLoadingCustomFields(true)
    try {
      const response = await fetch('/api/proxy/api/nautobot/custom-fields/prefixes', {
        headers: {
          'Content-Type': 'application/json',
        },
      })
      if (response.ok) {
        const data = await response.json()
        setCustomFields(data || [])
      }
    } catch (error) {
      console.error('Error fetching prefix custom fields:', error)
    } finally {
      setLoadingCustomFields(false)
    }
  }, [isAuthenticated])

  const fetchLocations = useCallback(async () => {
    if (!isAuthenticated) return
    setLoadingLocations(true)
    try {
      const response = await fetch('/api/proxy/api/nautobot/locations', {
        headers: {
          'Content-Type': 'application/json',
        },
      })
      if (response.ok) {
        const data = await response.json()
        setLocations(data || [])
      }
    } catch (error) {
      console.error('Error fetching locations:', error)
    } finally {
      setLoadingLocations(false)
    }
  }, [isAuthenticated])

  useEffect(() => {
    fetchCustomFields()
  }, [fetchCustomFields])

  useEffect(() => {
    if (formScanConditionType === 'location') {
      fetchLocations()
    }
  }, [formScanConditionType, fetchLocations])

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
      {/* Scan Conditions Section */}
      <div className="rounded-lg border border-info-border bg-info/30 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Network className="h-4 w-4 text-info-foreground" />
          <Label className="text-sm font-semibold text-info-foreground">Scan Conditions</Label>
        </div>

        {/* Condition type selector */}
        <div className="space-y-2">
          <Label className="text-sm text-info-foreground">Condition Type</Label>
          <RadioGroup
            value={formScanConditionType || 'custom_field'}
            onValueChange={setFormScanConditionType}
            className="flex gap-6"
          >
            <div className="flex items-center gap-2">
              <RadioGroupItem value="custom_field" id="condition-custom-field" />
              <Label htmlFor="condition-custom-field" className="text-sm text-info-foreground cursor-pointer font-normal">
                Custom Field
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="location" id="condition-location" />
              <Label htmlFor="condition-location" className="text-sm text-info-foreground cursor-pointer font-normal">
                Location
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="cidr" id="condition-cidr" />
              <Label htmlFor="condition-cidr" className="text-sm text-info-foreground cursor-pointer font-normal">
                CIDR
              </Label>
            </div>
          </RadioGroup>
        </div>

        {/* Custom Field mode */}
        {(!formScanConditionType || formScanConditionType === 'custom_field') && (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="custom-field-name" className="text-sm text-info-foreground">
                Scan Condition
              </Label>
              <Select
                value={formScanCustomFieldName}
                onValueChange={setFormScanCustomFieldName}
                disabled={loadingCustomFields}
              >
                <SelectTrigger className={SELECT_TRIGGER_CLASSES}>
                  <SelectValue
                    placeholder={
                      loadingCustomFields ? 'Loading...' : 'Select custom field...'
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {customFields.map(field => (
                    <SelectItem key={field.key} value={field.key}>
                      {field.label} ({field.type.label})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-info-foreground">
                Select the custom field on prefixes to filter by (content_type: ipam.prefix)
              </p>
            </div>

            {formScanCustomFieldName && (
              <div className="space-y-2">
                <Label htmlFor="custom-field-value" className="text-sm text-info-foreground">
                  Custom Field Value
                </Label>
                {getSelectedFieldType() === 'boolean' ? (
                  <Select
                    value={formScanCustomFieldValue}
                    onValueChange={setFormScanCustomFieldValue}
                  >
                    <SelectTrigger className={SELECT_TRIGGER_CLASSES}>
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
                    <SelectTrigger className={SELECT_TRIGGER_CLASSES}>
                      <SelectValue placeholder="Select value..." />
                    </SelectTrigger>
                    <SelectContent>
                      {selectedFieldChoices.map(choice => (
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
                    onChange={e => setFormScanCustomFieldValue(e.target.value)}
                    placeholder="Enter value..."
                    className={INPUT_CLASSES}
                  />
                )}
                <p className="text-xs text-info-foreground">
                  Prefixes with this custom field value will be scanned
                </p>
              </div>
            )}
          </div>
        )}

        {/* Location mode */}
        {formScanConditionType === 'location' && (
          <div className="space-y-2">
            <Label htmlFor="scan-location" className="text-sm text-info-foreground">
              Location
            </Label>
            <Select
              value={formScanLocationName}
              onValueChange={setFormScanLocationName}
              disabled={loadingLocations}
            >
              <SelectTrigger className={SELECT_TRIGGER_CLASSES}>
                <SelectValue
                  placeholder={loadingLocations ? 'Loading...' : 'Select location...'}
                />
              </SelectTrigger>
              <SelectContent>
                {locations.map(loc => (
                  <SelectItem key={loc.id} value={loc.name}>
                    {loc.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-info-foreground">
              Prefixes assigned to this location will be scanned
            </p>
          </div>
        )}

        {/* CIDR mode */}
        {formScanConditionType === 'cidr' && (
          <div className="space-y-2">
            <Label htmlFor="scan-cidr" className="text-sm text-info-foreground">
              CIDR
            </Label>
            <Input
              id="scan-cidr"
              type="text"
              value={formScanCidr}
              onChange={e => setFormScanCidr(e.target.value)}
              placeholder="e.g. 10.0.0.0/8"
              className={INPUT_CLASSES}
            />
            <p className="text-xs text-info-foreground">
              Prefixes matching this CIDR notation will be scanned
            </p>
          </div>
        )}

        {/* Response Custom Field */}
        <div className="grid grid-cols-2 gap-4 pt-2 border-t border-info-border">
          <div className="space-y-2">
            <Label
              htmlFor="response-custom-field-name"
              className="text-sm text-info-foreground"
            >
              Write Response to
            </Label>
            <Select
              value={formScanResponseCustomFieldName}
              onValueChange={setFormScanResponseCustomFieldName}
              disabled={loadingCustomFields}
            >
              <SelectTrigger className={SELECT_TRIGGER_CLASSES}>
                <SelectValue
                  placeholder={
                    loadingCustomFields ? 'Loading...' : 'Select custom field...'
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {customFields.map(field => (
                  <SelectItem key={field.key} value={field.key}>
                    {field.label} ({field.type.label})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-info-foreground">
              Optional: Write scan results to this custom field (content_type: ipam.prefix)
            </p>
          </div>
        </div>

        {/* Set Reachable IP to Active */}
        <div className="pt-2 border-t border-info-border">
          <div className="flex items-center space-x-3">
            <Switch
              id="scan-set-reachable-ip-active"
              checked={formScanSetReachableIpActive}
              onCheckedChange={setFormScanSetReachableIpActive}
            />
            <Label
              htmlFor="scan-set-reachable-ip-active"
              className="text-sm text-info-foreground cursor-pointer"
            >
              Set reachable IP to Active
            </Label>
          </div>
          <p className="text-xs text-info-foreground mt-1">
            When enabled, all reachable IP addresses will be updated with status=Active
          </p>
        </div>
      </div>

      {/* Scan Options Section */}
      <div className="rounded-lg border border-info-border bg-info/30 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Radar className="h-4 w-4 text-info-foreground" />
          <Label className="text-sm font-semibold text-info-foreground">Scan Options</Label>
        </div>

        <div className="flex items-center space-x-3">
          <Switch
            id="scan-resolve-dns"
            checked={formScanResolveDns}
            onCheckedChange={setFormScanResolveDns}
          />
          <Label
            htmlFor="scan-resolve-dns"
            className="text-sm text-info-foreground cursor-pointer"
          >
            Resolve DNS
          </Label>
        </div>
        <p className="text-xs text-info-foreground">
          When enabled, DNS names will be resolved during network scanning.
        </p>

        <div className="grid grid-cols-2 gap-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="scan-ping-count" className="text-sm text-info-foreground">
              Ping Count
            </Label>
            <Input
              id="scan-ping-count"
              type="number"
              min="1"
              max="10"
              value={formScanPingCount}
              onChange={e => setFormScanPingCount(e.target.value)}
              placeholder="3"
              className={INPUT_CLASSES}
            />
            <p className="text-xs text-info-foreground">
              Number of ping attempts per host (1-10)
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="scan-timeout-ms" className="text-sm text-info-foreground">
              Timeout (ms)
            </Label>
            <Input
              id="scan-timeout-ms"
              type="number"
              min="100"
              max="30000"
              value={formScanTimeoutMs}
              onChange={e => setFormScanTimeoutMs(e.target.value)}
              placeholder="1000"
              className={INPUT_CLASSES}
            />
            <p className="text-xs text-info-foreground">
              Timeout in milliseconds (100-30000)
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="scan-retries" className="text-sm text-info-foreground">
              Retries
            </Label>
            <Input
              id="scan-retries"
              type="number"
              min="0"
              max="5"
              value={formScanRetries}
              onChange={e => setFormScanRetries(e.target.value)}
              placeholder="2"
              className={INPUT_CLASSES}
            />
            <p className="text-xs text-info-foreground">Number of retry attempts (0-5)</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="scan-max-ips" className="text-sm text-info-foreground">
              Max IPs per Scan
            </Label>
            <Input
              id="scan-max-ips"
              type="number"
              min="0"
              value={formScanMaxIps}
              onChange={e => setFormScanMaxIps(e.target.value)}
              placeholder="No limit"
              className={INPUT_CLASSES}
            />
            <p className="text-xs text-info-foreground">
              Maximum number of IPs to scan. Larger jobs will be split.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="scan-interval-ms" className="text-sm text-info-foreground">
              Interval (ms)
            </Label>
            <Input
              id="scan-interval-ms"
              type="number"
              min="0"
              max="10000"
              value={formScanIntervalMs}
              onChange={e => setFormScanIntervalMs(e.target.value)}
              placeholder="100"
              className={INPUT_CLASSES}
            />
            <p className="text-xs text-info-foreground">
              Interval between scans in milliseconds (0-10000)
            </p>
          </div>
        </div>
      </div>
    </>
  )
}
