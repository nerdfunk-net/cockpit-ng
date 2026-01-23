import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { HelpCircle } from 'lucide-react'

interface SnmpHelpDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SnmpHelpDialog({ open, onOpenChange }: SnmpHelpDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[54rem] !max-w-[54rem] w-[85vw] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <HelpCircle className="h-5 w-5 text-blue-600" />
            <span>SNMP Mapping Configuration Help</span>
          </DialogTitle>
          <DialogDescription>
            Examples and guidelines for configuring SNMP credentials
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Overview */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-gray-900">Overview</h3>
            <p className="text-sm text-gray-600">
              The SNMP mapping configuration defines credentials for accessing network devices via SNMP.
              Each entry is identified by a unique ID and contains authentication details based on the SNMP version.
            </p>
          </div>

          {/* Configuration Examples */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-900">Configuration Examples</h3>

            {/* Example 1: SNMPv3 with Auth and Privacy */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-blue-700">
                Example 1: SNMPv3 with Authentication and Privacy
              </h4>
              <p className="text-xs text-gray-600">
                Most secure option - requires both authentication and encryption
              </p>
              <pre className="bg-gray-50 border border-gray-200 rounded-md p-3 text-xs font-mono overflow-x-auto">
{`snmp-id-1:
  version: v3
  type: v3_auth_privacy
  username: snmp_username
  group: snmp_group
  auth_protocol_long: SHA-2-256
  auth_protocol: SHA-2-256
  auth_password: snmp_password
  privacy_protocol_long: AES-256
  privacy_protocol: AES
  privacy_password: snmp_password
  privacy_option: 256`}
              </pre>
              <ul className="text-xs text-gray-600 list-disc list-inside space-y-1">
                <li><code className="bg-gray-100 px-1 rounded">version: v3</code> - Uses SNMP version 3</li>
                <li><code className="bg-gray-100 px-1 rounded">type: v3_auth_privacy</code> - Requires both authentication and privacy (encryption)</li>
                <li><code className="bg-gray-100 px-1 rounded">auth_protocol</code> - Authentication algorithm (SHA-2-256, MD5, etc.)</li>
                <li><code className="bg-gray-100 px-1 rounded">privacy_protocol</code> - Encryption algorithm (AES, DES, etc.)</li>
                <li><code className="bg-gray-100 px-1 rounded">privacy_option</code> - Key size for encryption (128, 192, 256)</li>
              </ul>
            </div>

            {/* Example 2: SNMPv3 with Auth only */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-blue-700">
                Example 2: SNMPv3 with Authentication Only
              </h4>
              <p className="text-xs text-gray-600">
                Provides authentication without encryption - less secure than auth_privacy
              </p>
              <pre className="bg-gray-50 border border-gray-200 rounded-md p-3 text-xs font-mono overflow-x-auto">
{`snmp-id-2:
  version: v3
  type: v3_auth_no_privacy
  username: snmp_username
  group: snmp_group
  auth_protocol_long: MD5-96
  auth_protocol: MD5
  auth_password: snmp_password`}
              </pre>
              <ul className="text-xs text-gray-600 list-disc list-inside space-y-1">
                <li><code className="bg-gray-100 px-1 rounded">type: v3_auth_no_privacy</code> - Authentication only, no encryption</li>
                <li>Privacy-related fields are omitted as encryption is not used</li>
                <li>More secure than SNMPv2c but less secure than v3_auth_privacy</li>
              </ul>
            </div>

            {/* Example 3: SNMPv2c */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-blue-700">
                Example 3: SNMPv2c with Community String
              </h4>
              <p className="text-xs text-gray-600">
                Legacy version - simple community-based authentication only
              </p>
              <pre className="bg-gray-50 border border-gray-200 rounded-md p-3 text-xs font-mono overflow-x-auto">
{`snmp-id-3:
  version: v2
  community: snmp_community`}
              </pre>
              <ul className="text-xs text-gray-600 list-disc list-inside space-y-1">
                <li><code className="bg-gray-100 px-1 rounded">version: v2</code> - Uses SNMP version 2c</li>
                <li><code className="bg-gray-100 px-1 rounded">community</code> - Community string (acts as password)</li>
                <li>Simplest configuration but least secure - no encryption or strong authentication</li>
                <li>Recommended only for legacy devices or isolated networks</li>
              </ul>
            </div>
          </div>

          {/* Best Practices */}
          <div className="space-y-2 border-t pt-4">
            <h3 className="text-sm font-semibold text-gray-900">Best Practices</h3>
            <ul className="text-sm text-gray-600 list-disc list-inside space-y-1">
              <li>Use SNMPv3 with auth_privacy whenever possible for maximum security</li>
              <li>Use strong, unique passwords for auth_password and privacy_password</li>
              <li>Each SNMP ID should have a unique identifier (e.g., snmp-id-1, snmp-id-2)</li>
              <li>Maintain consistent indentation (2 spaces) throughout the YAML file</li>
              <li>Test your configuration using the &quot;Check YAML&quot; button before saving</li>
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
