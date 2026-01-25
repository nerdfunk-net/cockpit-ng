import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { HelpCircle } from 'lucide-react'

interface CheckMKHelpDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CheckMKHelpDialog({ open, onOpenChange }: CheckMKHelpDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[54rem] !max-w-[54rem] w-[85vw] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <HelpCircle className="h-5 w-5 text-blue-600" />
            <span>CheckMK Configuration Help</span>
          </DialogTitle>
          <DialogDescription>
            Understanding the Nautobot to CheckMK synchronization and configuration options
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Overview */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-gray-900">Overview</h3>
            <p className="text-sm text-gray-600">
              The CheckMK configuration file controls how devices from Nautobot are synchronized to
              CheckMK. It defines site mappings, folder structures, host tag groups, and attribute
              mappings to ensure devices are correctly organized and monitored in CheckMK.
            </p>
          </div>

          {/* Synchronization Process */}
          <div className="space-y-3 border-t pt-4">
            <h3 className="text-sm font-semibold text-gray-900">Synchronization Process</h3>
            <p className="text-sm text-gray-600">
              The backend synchronization service performs the following operations:
            </p>
            <ul className="text-sm text-gray-600 list-disc list-inside space-y-1 ml-2">
              <li>
                <strong>Device Discovery:</strong> Retrieves all devices from Nautobot via GraphQL
              </li>
              <li>
                <strong>Normalization:</strong> Converts Nautobot device data to CheckMK format
                using the configuration rules
              </li>
              <li>
                <strong>Comparison:</strong> Compares normalized device data with existing CheckMK
                hosts
              </li>
              <li>
                <strong>Synchronization:</strong> Creates new hosts, updates existing ones, or
                identifies differences
              </li>
              <li>
                <strong>Validation:</strong> Ensures only specified attributes are compared (via
                the <code className="bg-gray-100 px-1 rounded">compare</code> section)
              </li>
            </ul>
          </div>

          {/* Configuration Sections */}
          <div className="space-y-4 border-t pt-4">
            <h3 className="text-sm font-semibold text-gray-900">Configuration Sections</h3>

            {/* monitored_site */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-blue-700">
                1. monitored_site - CheckMK Site Assignment
              </h4>
              <p className="text-xs text-gray-600">
                Determines which CheckMK site a device should be monitored from. Priority order:
                by_name &gt; by_nautobot &gt; by_ip &gt; by_location &gt; default
              </p>
              <pre className="bg-gray-50 border border-gray-200 rounded-md p-3 text-xs font-mono overflow-x-auto">
                {`monitored_site:
  default: cmk                    # Default site for all devices
  by_nautobot: checkmk_site       # Use custom field value from Nautobot
  by_location:
    building: site                # Map location "building" to site "site"
  by_ip:
    192.168.1.0/24: cmk          # Map IP range to site
  by_name:
    lab-2: cmk                    # Map specific device name to site`}
              </pre>
            </div>

            {/* folders */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-blue-700">
                2. folders - CheckMK Folder Structure
              </h4>
              <p className="text-xs text-gray-600">
                Defines folder placement for devices in CheckMK. Supports role-based configurations
                and template variables. Priority: by_name &gt; by_ip &gt; by_location &gt; default
              </p>
              <pre className="bg-gray-50 border border-gray-200 rounded-md p-3 text-xs font-mono overflow-x-auto">
                {`folders:
  server:                         # Role-specific folder config
    default: "/server/{_custom_field_data.net}/{location.name}"
  default:                        # Default folder config for other roles
    default: "/network/{_custom_field_data.net}/{location.name}"
    by_location:
      office: /testfolder
    by_ip:
      192.168.179.0/24: /testfolder/subfolder
      0.0.0.0/0: "/network/{_custom_field_data.net}/{location.name}"
    by_name:
      lab-2: /testfolder`}
              </pre>
              <p className="text-xs text-gray-500 mt-1">
                <strong>Template Variables:</strong> Use dot notation to access Nautobot fields:{' '}
                <code className="bg-gray-100 px-1 rounded">{'{location.name}'}</code>,{' '}
                <code className="bg-gray-100 px-1 rounded">{'{_custom_field_data.net}'}</code>
              </p>
            </div>

            {/* attr2htg */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-blue-700">
                3. attr2htg - Attribute to Host Tag Group Mapping
              </h4>
              <p className="text-xs text-gray-600">
                Maps Nautobot core attributes (status, role, location) to CheckMK host tag groups
              </p>
              <pre className="bg-gray-50 border border-gray-200 rounded-md p-3 text-xs font-mono overflow-x-auto">
                {`attr2htg:
  status.name: status             # Maps device status to tag_status in CheckMK`}
              </pre>
              <p className="text-xs text-gray-500 mt-1">
                Result: Creates <code className="bg-gray-100 px-1 rounded">tag_status</code>{' '}
                attribute with the device&apos;s status value
              </p>
            </div>

            {/* cf2htg */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-blue-700">
                4. cf2htg - Custom Field to Host Tag Group Mapping
              </h4>
              <p className="text-xs text-gray-600">
                Maps Nautobot custom fields to CheckMK host tag groups
              </p>
              <pre className="bg-gray-50 border border-gray-200 rounded-md p-3 text-xs font-mono overflow-x-auto">
                {`cf2htg:
  net: net                        # Maps custom field "net" to tag_net
  latency: latency                # Maps custom field "latency" to tag_latency`}
              </pre>
            </div>

            {/* tags2htg */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-blue-700">
                5. tags2htg - Tags to Host Tag Group Mapping
              </h4>
              <p className="text-xs text-gray-600">
                Maps Nautobot tags to CheckMK host tag groups. Value is &quot;true&quot; if tag
                exists, otherwise not set.
              </p>
              <pre className="bg-gray-50 border border-gray-200 rounded-md p-3 text-xs font-mono overflow-x-auto">
                {`tags2htg:
  tag-1: nb_tag                   # Creates tag_nb_tag="true" if "tag-1" exists`}
              </pre>
            </div>

            {/* additional_attributes */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-blue-700">
                6. additional_attributes - Static Attribute Assignment
              </h4>
              <p className="text-xs text-gray-600">
                Adds static attributes to devices based on name or IP address
              </p>
              <pre className="bg-gray-50 border border-gray-200 rounded-md p-3 text-xs font-mono overflow-x-auto">
                {`additional_attributes:
  by_ip:
    192.168.178.101:
      alias: test                 # Add alias for specific IP
  by_name:
    unknown-hostname:
      xxx: test                   # Add custom attribute for specific device`}
              </pre>
            </div>

            {/* mapping */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-blue-700">7. mapping - Field Value Mapping</h4>
              <p className="text-xs text-gray-600">
                Maps Nautobot field values to CheckMK attribute names
              </p>
              <pre className="bg-gray-50 border border-gray-200 rounded-md p-3 text-xs font-mono overflow-x-auto">
                {`mapping:
  name: alias                     # Maps device name to alias attribute
  location.name: location         # Maps location name to location attribute
  location.parent.name: city      # Maps parent location to city attribute`}
              </pre>
            </div>

            {/* compare */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-blue-700">8. compare - Comparison Scope</h4>
              <p className="text-xs text-gray-600">
                Defines which aspects should be compared during synchronization
              </p>
              <pre className="bg-gray-50 border border-gray-200 rounded-md p-3 text-xs font-mono overflow-x-auto">
                {`compare:
  - attributes                    # Compare device attributes
  - folder                        # Compare folder placement`}
              </pre>
            </div>

            {/* ignore_attributes */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-blue-700">
                9. ignore_attributes - Excluded from Comparison
              </h4>
              <p className="text-xs text-gray-600">
                Attributes that should be ignored during comparison (typically managed by CheckMK)
              </p>
              <pre className="bg-gray-50 border border-gray-200 rounded-md p-3 text-xs font-mono overflow-x-auto">
                {`ignore_attributes:
  - tag_address_family            # Don't compare this attribute`}
              </pre>
            </div>
          </div>

          {/* Backend Features */}
          <div className="space-y-3 border-t pt-4">
            <h3 className="text-sm font-semibold text-gray-900">Backend Features</h3>
            <ul className="text-sm text-gray-600 list-disc list-inside space-y-1 ml-2">
              <li>
                <strong>Priority-based Resolution:</strong> Multiple matching rules are evaluated
                in priority order
              </li>
              <li>
                <strong>Template Processing:</strong> Folder paths support Nautobot field
                interpolation using{' '}
                <code className="bg-gray-100 px-1 rounded">{'{field.name}'}</code> syntax
              </li>
              <li>
                <strong>SNMP Integration:</strong> Automatically maps SNMP credentials from custom
                fields using the SNMP mapping configuration
              </li>
              <li>
                <strong>IP Network Matching:</strong> Supports CIDR notation for IP-based rules
                (e.g., 192.168.1.0/24)
              </li>
              <li>
                <strong>Role-based Organization:</strong> Different folder structures for different
                device roles
              </li>
              <li>
                <strong>Selective Comparison:</strong> Only specified attributes are compared,
                preventing false positives
              </li>
              <li>
                <strong>Nested Field Access:</strong> Support for dot notation to access nested
                Nautobot fields
              </li>
            </ul>
          </div>

          {/* Best Practices */}
          <div className="space-y-3 border-t pt-4">
            <h3 className="text-sm font-semibold text-gray-900">Best Practices</h3>
            <ul className="text-sm text-gray-600 list-disc list-inside space-y-1 ml-2">
              <li>
                Always define a <code className="bg-gray-100 px-1 rounded">default</code> value for
                site and folder configurations
              </li>
              <li>Use role-based folder structures to organize devices logically</li>
              <li>
                Keep the <code className="bg-gray-100 px-1 rounded">compare</code> list minimal to
                avoid unnecessary sync operations
              </li>
              <li>
                Add CheckMK-managed attributes to{' '}
                <code className="bg-gray-100 px-1 rounded">ignore_attributes</code>
              </li>
              <li>
                Use IP ranges (CIDR notation) for network-based rules rather than individual IPs
              </li>
              <li>
                Test configuration changes using the &quot;Check YAML&quot; button before saving
              </li>
              <li>Document custom field requirements in your Nautobot configuration</li>
            </ul>
          </div>

          {/* Complete Example */}
          <div className="space-y-2 border-t pt-4">
            <h3 className="text-sm font-semibold text-gray-900">Complete Example</h3>
            <pre className="bg-gray-50 border border-gray-200 rounded-md p-3 text-xs font-mono overflow-x-auto">
              {`monitored_site:
  default: cmk
  by_nautobot: checkmk_site
  by_location:
    building: site
  by_ip:
    192.168.1.0/24: cmk
  by_name:
    lab-2: cmk

folders:
  server:
    default: "/server/{_custom_field_data.net}/{location.name}"
  default:
    default: "/network/{_custom_field_data.net}/{location.name}"
    by_location:
      office: /testfolder
    by_ip:
      192.168.179.0/24: /testfolder/subfolder
      0.0.0.0/0: "/network/{_custom_field_data.net}/{location.name}"
    by_name:
      lab-2: /testfolder

attr2htg:
  status.name: status

cf2htg:
  net: net
  latency: latency

tags2htg:
  tag-1: nb_tag

additional_attributes:
  by_ip:
    192.168.178.101:
      alias: test
  by_name:
    unknown-hostname:
      xxx: test

mapping:
  name: alias
  location.name: location
  location.parent.name: city

compare:
  - attributes
  - folder

ignore_attributes:
  - tag_address_family`}
            </pre>
          </div>
        </div>

        <div className="flex justify-end pt-4 border-t">
          <Button onClick={() => onOpenChange(false)}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
