import { useCallback, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Network } from 'lucide-react'
import type { SNMPMapping, SNMPMappingFormData } from '../types'
import { DEFAULT_SNMP_FORM } from '../utils/constants'

interface SNMPMappingDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mapping: SNMPMapping | null
  formData: SNMPMappingFormData
  onFormChange: (data: SNMPMappingFormData) => void
  onSave: () => void
  isSaving?: boolean
}

export function SNMPMappingDialog({
  open,
  onOpenChange,
  mapping,
  formData,
  onFormChange,
  onSave,
  isSaving = false,
}: SNMPMappingDialogProps) {
  // Reset form when dialog opens with no mapping (creating new)
  useEffect(() => {
    if (open && !mapping) {
      onFormChange(DEFAULT_SNMP_FORM)
    }
  }, [open, mapping, onFormChange])

  const handleSave = useCallback(() => {
    onSave()
  }, [onSave])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-0">
        <DialogHeader className="panel-header px-6 py-4 rounded-t-lg sticky top-0">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Network className="h-5 w-5" />
            {mapping ? 'Edit' : 'Add'} SNMP Credential
          </DialogTitle>
          <DialogDescription className="text-panel-header-muted">
            Configure SNMP credentials for compliance checks
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-6 px-6 pb-6">
          {/* SNMP Name */}
          <div className="space-y-2">
            <Label
              htmlFor="snmp-name"
              className="text-sm font-semibold text-foreground flex items-center gap-1"
            >
              SNMP Mapping Name
              <span className="text-destructive">*</span>
            </Label>
            <Input
              id="snmp-name"
              value={formData.name}
              onChange={e => onFormChange({ ...formData, name: e.target.value })}
              placeholder="snmp-prod-1"
              className="bg-muted border-border focus:border-primary focus:ring-ring/30"
            />
            <p className="text-xs text-muted-foreground">
              A unique identifier for this SNMP credential (e.g.,
              &quot;snmp-prod-1&quot;, &quot;lab-snmpv3&quot;). SNMP credentials are
              device-type independent.
            </p>
          </div>

          {/* SNMP Version */}
          <div className="space-y-2">
            <Label
              htmlFor="snmp-version"
              className="text-sm font-semibold text-foreground flex items-center gap-1"
            >
              SNMP Version
              <span className="text-destructive">*</span>
            </Label>
            <Select
              value={formData.snmp_version}
              onValueChange={(value: 'v1' | 'v2c' | 'v3') =>
                onFormChange({ ...formData, snmp_version: value })
              }
            >
              <SelectTrigger className="bg-muted border-border focus:border-primary focus:ring-ring/30">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="v1">SNMP v1</SelectItem>
                <SelectItem value="v2c">SNMP v2c</SelectItem>
                <SelectItem value="v3">SNMP v3 (Recommended)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {(formData.snmp_version === 'v1' || formData.snmp_version === 'v2c') && (
            <div className="space-y-2 p-4 bg-warning border border-warning-border rounded-md">
              <Label
                htmlFor="snmp-community"
                className="text-sm font-semibold text-foreground flex items-center gap-1"
              >
                Community String
                <span className="text-destructive">*</span>
              </Label>
              <Input
                id="snmp-community"
                type="password"
                value={formData.snmp_community}
                onChange={e =>
                  onFormChange({ ...formData, snmp_community: e.target.value })
                }
                placeholder="public"
                className="bg-card border-warning-border focus:border-primary focus:ring-ring/30"
              />
              <p className="text-xs text-warning-foreground">
                Community string for SNMP v1 or v2c authentication (usually
                &quot;public&quot; for read-only)
              </p>
            </div>
          )}

          {formData.snmp_version === 'v3' && (
            <div className="space-y-4 p-4 bg-info border border-info-border rounded-md">
              <div className="space-y-2">
                <Label
                  htmlFor="snmp-v3-user"
                  className="text-sm font-semibold text-foreground flex items-center gap-1"
                >
                  SNMPv3 User
                  <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="snmp-v3-user"
                  value={formData.snmp_v3_user}
                  onChange={e =>
                    onFormChange({ ...formData, snmp_v3_user: e.target.value })
                  }
                  placeholder="snmpuser"
                  className="bg-card border-info-border focus:border-primary focus:ring-ring/30"
                />
                <p className="text-xs text-info-foreground">
                  Username for SNMPv3 authentication
                </p>
              </div>

              {/* Authentication Section */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-foreground">Authentication</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label
                      htmlFor="auth-protocol"
                      className="text-sm font-medium text-foreground"
                    >
                      Auth Protocol
                    </Label>
                    <Select
                      value={formData.snmp_v3_auth_protocol}
                      onValueChange={value =>
                        onFormChange({
                          ...formData,
                          snmp_v3_auth_protocol: value,
                        })
                      }
                    >
                      <SelectTrigger className="bg-card border-info-border focus:border-primary focus:ring-ring/30">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="MD5">MD5 (Less Secure)</SelectItem>
                        <SelectItem value="SHA">SHA</SelectItem>
                        <SelectItem value="SHA-224">SHA-224</SelectItem>
                        <SelectItem value="SHA-256">SHA-256 (Recommended)</SelectItem>
                        <SelectItem value="SHA-384">SHA-384</SelectItem>
                        <SelectItem value="SHA-512">SHA-512</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label
                      htmlFor="auth-password"
                      className="text-sm font-medium text-foreground"
                    >
                      Auth Password
                    </Label>
                    <Input
                      id="auth-password"
                      type="password"
                      value={formData.snmp_v3_auth_password}
                      onChange={e =>
                        onFormChange({
                          ...formData,
                          snmp_v3_auth_password: e.target.value,
                        })
                      }
                      placeholder={mapping ? '(unchanged)' : 'Authentication password'}
                      className="bg-card border-info-border focus:border-primary focus:ring-ring/30"
                    />
                  </div>
                </div>
              </div>

              {/* Privacy Section */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-foreground">
                  Privacy (Encryption)
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label
                      htmlFor="priv-protocol"
                      className="text-sm font-medium text-foreground"
                    >
                      Priv Protocol
                    </Label>
                    <Select
                      value={formData.snmp_v3_priv_protocol}
                      onValueChange={value =>
                        onFormChange({
                          ...formData,
                          snmp_v3_priv_protocol: value,
                        })
                      }
                    >
                      <SelectTrigger className="bg-card border-info-border focus:border-primary focus:ring-ring/30">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="DES">DES (Legacy)</SelectItem>
                        <SelectItem value="AES">AES-128</SelectItem>
                        <SelectItem value="AES-192">AES-192</SelectItem>
                        <SelectItem value="AES-256">AES-256 (Recommended)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label
                      htmlFor="priv-password"
                      className="text-sm font-medium text-foreground"
                    >
                      Priv Password
                    </Label>
                    <Input
                      id="priv-password"
                      type="password"
                      value={formData.snmp_v3_priv_password}
                      onChange={e =>
                        onFormChange({
                          ...formData,
                          snmp_v3_priv_password: e.target.value,
                        })
                      }
                      placeholder={mapping ? '(unchanged)' : 'Privacy password'}
                      className="bg-card border-info-border focus:border-primary focus:ring-ring/30"
                    />
                  </div>
                </div>
                <p className="text-xs text-info-foreground">
                  Privacy protocol encrypts SNMP messages for enhanced security
                </p>
              </div>
            </div>
          )}

          {/* Description */}
          <div className="space-y-2">
            <Label
              htmlFor="snmp-description"
              className="text-sm font-semibold text-foreground"
            >
              Description
            </Label>
            <Textarea
              id="snmp-description"
              value={formData.description}
              onChange={e => onFormChange({ ...formData, description: e.target.value })}
              placeholder="Describe this SNMP mapping (optional)"
              className="bg-muted border-border focus:border-primary focus:ring-ring/30 min-h-[80px]"
            />
            <p className="text-xs text-muted-foreground">
              Add notes about when to use this mapping or special configuration details
            </p>
          </div>
        </div>
        <DialogFooter className="gap-2 px-6 pb-6 pt-4 border-t">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving}
          >
            {mapping ? 'Update' : 'Add'} Mapping
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
