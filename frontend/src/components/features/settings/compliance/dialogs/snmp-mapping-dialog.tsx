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
        <DialogHeader className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white px-6 py-4 rounded-t-lg sticky top-0">
          <DialogTitle className="flex items-center gap-2 text-white text-lg">
            <Network className="h-5 w-5" />
            {mapping ? 'Edit' : 'Add'} SNMP Credential
          </DialogTitle>
          <DialogDescription className="text-blue-50">
            Configure SNMP credentials for compliance checks
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-6 px-6 pb-6">
          {/* SNMP Name */}
          <div className="space-y-2">
            <Label
              htmlFor="snmp-name"
              className="text-sm font-semibold text-gray-700 flex items-center gap-1"
            >
              SNMP Mapping Name
              <span className="text-red-500">*</span>
            </Label>
            <Input
              id="snmp-name"
              value={formData.name}
              onChange={(e) =>
                onFormChange({ ...formData, name: e.target.value })
              }
              placeholder="snmp-prod-1"
              className="bg-gray-50 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500">
              A unique identifier for this SNMP credential (e.g.,
              &quot;snmp-prod-1&quot;, &quot;lab-snmpv3&quot;). SNMP credentials
              are device-type independent.
            </p>
          </div>

          {/* SNMP Version */}
          <div className="space-y-2">
            <Label
              htmlFor="snmp-version"
              className="text-sm font-semibold text-gray-700 flex items-center gap-1"
            >
              SNMP Version
              <span className="text-red-500">*</span>
            </Label>
            <Select
              value={formData.snmp_version}
              onValueChange={(value: 'v1' | 'v2c' | 'v3') =>
                onFormChange({ ...formData, snmp_version: value })
              }
            >
              <SelectTrigger className="bg-gray-50 border-gray-300 focus:border-blue-500 focus:ring-blue-500">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="v1">SNMP v1</SelectItem>
                <SelectItem value="v2c">SNMP v2c</SelectItem>
                <SelectItem value="v3">SNMP v3 (Recommended)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {(formData.snmp_version === 'v1' ||
            formData.snmp_version === 'v2c') && (
            <div className="space-y-2 p-4 bg-amber-50 border border-amber-200 rounded-md">
              <Label
                htmlFor="snmp-community"
                className="text-sm font-semibold text-gray-700 flex items-center gap-1"
              >
                Community String
                <span className="text-red-500">*</span>
              </Label>
              <Input
                id="snmp-community"
                type="password"
                value={formData.snmp_community}
                onChange={(e) =>
                  onFormChange({ ...formData, snmp_community: e.target.value })
                }
                placeholder="public"
                className="bg-white border-amber-300 focus:border-amber-500 focus:ring-amber-500"
              />
              <p className="text-xs text-amber-700">
                Community string for SNMP v1 or v2c authentication (usually
                &quot;public&quot; for read-only)
              </p>
            </div>
          )}

          {formData.snmp_version === 'v3' && (
            <div className="space-y-4 p-4 bg-blue-50 border border-blue-200 rounded-md">
              <div className="space-y-2">
                <Label
                  htmlFor="snmp-v3-user"
                  className="text-sm font-semibold text-gray-700 flex items-center gap-1"
                >
                  SNMPv3 User
                  <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="snmp-v3-user"
                  value={formData.snmp_v3_user}
                  onChange={(e) =>
                    onFormChange({ ...formData, snmp_v3_user: e.target.value })
                  }
                  placeholder="snmpuser"
                  className="bg-white border-blue-300 focus:border-blue-500 focus:ring-blue-500"
                />
                <p className="text-xs text-blue-700">
                  Username for SNMPv3 authentication
                </p>
              </div>

              {/* Authentication Section */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-gray-700">
                  Authentication
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label
                      htmlFor="auth-protocol"
                      className="text-sm font-medium text-gray-700"
                    >
                      Auth Protocol
                    </Label>
                    <Select
                      value={formData.snmp_v3_auth_protocol}
                      onValueChange={(value) =>
                        onFormChange({
                          ...formData,
                          snmp_v3_auth_protocol: value,
                        })
                      }
                    >
                      <SelectTrigger className="bg-white border-blue-300 focus:border-blue-500 focus:ring-blue-500">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="MD5">MD5 (Less Secure)</SelectItem>
                        <SelectItem value="SHA">SHA</SelectItem>
                        <SelectItem value="SHA-224">SHA-224</SelectItem>
                        <SelectItem value="SHA-256">
                          SHA-256 (Recommended)
                        </SelectItem>
                        <SelectItem value="SHA-384">SHA-384</SelectItem>
                        <SelectItem value="SHA-512">SHA-512</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label
                      htmlFor="auth-password"
                      className="text-sm font-medium text-gray-700"
                    >
                      Auth Password
                    </Label>
                    <Input
                      id="auth-password"
                      type="password"
                      value={formData.snmp_v3_auth_password}
                      onChange={(e) =>
                        onFormChange({
                          ...formData,
                          snmp_v3_auth_password: e.target.value,
                        })
                      }
                      placeholder={
                        mapping ? '(unchanged)' : 'Authentication password'
                      }
                      className="bg-white border-blue-300 focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Privacy Section */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-gray-700">
                  Privacy (Encryption)
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label
                      htmlFor="priv-protocol"
                      className="text-sm font-medium text-gray-700"
                    >
                      Priv Protocol
                    </Label>
                    <Select
                      value={formData.snmp_v3_priv_protocol}
                      onValueChange={(value) =>
                        onFormChange({
                          ...formData,
                          snmp_v3_priv_protocol: value,
                        })
                      }
                    >
                      <SelectTrigger className="bg-white border-blue-300 focus:border-blue-500 focus:ring-blue-500">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="DES">DES (Legacy)</SelectItem>
                        <SelectItem value="AES">AES-128</SelectItem>
                        <SelectItem value="AES-192">AES-192</SelectItem>
                        <SelectItem value="AES-256">
                          AES-256 (Recommended)
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label
                      htmlFor="priv-password"
                      className="text-sm font-medium text-gray-700"
                    >
                      Priv Password
                    </Label>
                    <Input
                      id="priv-password"
                      type="password"
                      value={formData.snmp_v3_priv_password}
                      onChange={(e) =>
                        onFormChange({
                          ...formData,
                          snmp_v3_priv_password: e.target.value,
                        })
                      }
                      placeholder={mapping ? '(unchanged)' : 'Privacy password'}
                      className="bg-white border-blue-300 focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <p className="text-xs text-blue-700">
                  Privacy protocol encrypts SNMP messages for enhanced security
                </p>
              </div>
            </div>
          )}

          {/* Description */}
          <div className="space-y-2">
            <Label
              htmlFor="snmp-description"
              className="text-sm font-semibold text-gray-700"
            >
              Description
            </Label>
            <Textarea
              id="snmp-description"
              value={formData.description}
              onChange={(e) =>
                onFormChange({ ...formData, description: e.target.value })
              }
              placeholder="Describe this SNMP mapping (optional)"
              className="bg-gray-50 border-gray-300 focus:border-blue-500 focus:ring-blue-500 min-h-[80px]"
            />
            <p className="text-xs text-gray-500">
              Add notes about when to use this mapping or special configuration
              details
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
            className="bg-blue-600 hover:bg-blue-700 text-white"
            disabled={isSaving}
          >
            {mapping ? 'Update' : 'Add'} Mapping
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
