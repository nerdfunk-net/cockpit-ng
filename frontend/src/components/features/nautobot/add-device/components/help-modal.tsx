'use client'

import { AlertCircle, HelpCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'

interface HelpModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function HelpModal({ open, onOpenChange }: HelpModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5 text-primary" />
            Add Device Help Guide
          </DialogTitle>
          <DialogDescription>
            Complete guide to adding network devices to Nautobot
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Overview */}
          <section>
            <h3 className="text-lg font-semibold mb-3">Overview</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              This form allows you to add network devices (routers, switches, firewalls) or bare metal servers
              to Nautobot. The workflow consists of three main sections: Device Information, Prefix Configuration,
              and Network Interfaces. You can validate your entries at any time using the &quot;Validate&quot; button before
              final submission.
            </p>
          </section>

          {/* Required Fields */}
          <section>
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-600" />
              Required Fields
            </h3>
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm text-red-900 font-medium mb-2">The following fields are mandatory:</p>
              <ul className="list-disc list-inside space-y-1 text-sm text-red-800">
                <li><strong>Device Name</strong> - Unique identifier for the device</li>
                <li><strong>Device Role</strong> - Purpose of the device (e.g., Router, Switch, Firewall)</li>
                <li><strong>Device Status</strong> - Operational status (e.g., Active, Planned, Staged)</li>
                <li><strong>Device Type</strong> - Hardware model (manufacturer and model number)</li>
                <li><strong>Location</strong> - Physical location in the hierarchy</li>
              </ul>
            </div>
          </section>

          {/* Optional Fields */}
          <section>
            <h3 className="text-lg font-semibold mb-3">Optional Fields</h3>
            <div className="space-y-3">
              <div className="bg-muted/50 rounded-lg p-3">
                <h4 className="font-medium text-sm mb-1">Platform</h4>
                <p className="text-sm text-muted-foreground">Operating system or platform (e.g., Cisco IOS, Juniper Junos)</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-3">
                <h4 className="font-medium text-sm mb-1">Software Version</h4>
                <p className="text-sm text-muted-foreground">Specific software/firmware version running on the device</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-3">
                <h4 className="font-medium text-sm mb-1">Serial Number</h4>
                <p className="text-sm text-muted-foreground">Hardware serial number for asset tracking</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-3">
                <h4 className="font-medium text-sm mb-1">Asset Tag</h4>
                <p className="text-sm text-muted-foreground">Organization-specific asset identifier</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-3">
                <h4 className="font-medium text-sm mb-1">Description / Comments</h4>
                <p className="text-sm text-muted-foreground">Additional notes or documentation about the device</p>
              </div>
            </div>
          </section>

          {/* Tags Feature */}
          <section>
            <h3 className="text-lg font-semibold mb-3">Tags</h3>
            <p className="text-sm text-muted-foreground mb-3">
              Tags allow you to categorize and organize devices with custom labels. Click the &quot;Manage Tags&quot;
              button in the Device Information section to open the tags modal.
            </p>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-900"><strong>How to use:</strong></p>
              <ol className="list-decimal list-inside space-y-1 text-sm text-blue-800 mt-2">
                <li>Click &quot;Manage Tags&quot; button</li>
                <li>Browse available tags or search for specific ones</li>
                <li>Click on tags to select/deselect them</li>
                <li>Selected tags will be displayed with a count badge</li>
                <li>Tags are applied when you submit the device</li>
              </ol>
            </div>
          </section>

          {/* Custom Fields Feature */}
          <section>
            <h3 className="text-lg font-semibold mb-3">Custom Fields</h3>
            <p className="text-sm text-muted-foreground mb-3">
              Custom fields allow you to store additional structured data specific to your organization&apos;s needs.
              These fields are defined by your Nautobot administrators.
            </p>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-900"><strong>How to use:</strong></p>
              <ol className="list-decimal list-inside space-y-1 text-sm text-blue-800 mt-2">
                <li>Click &quot;Manage Custom Fields&quot; button</li>
                <li>Fill in values for available custom fields</li>
                <li>Different field types: text, number, date, select, boolean, etc.</li>
                <li>Some custom fields may be required depending on your configuration</li>
                <li>Values are saved when you submit the device</li>
              </ol>
            </div>
          </section>

          {/* Prefix Configuration */}
          <section>
            <h3 className="text-lg font-semibold mb-3">Prefix Configuration</h3>
            <p className="text-sm text-muted-foreground">
              Configure automatic IP address assignment by specifying an IPv4 and/or IPv6 prefix. The system
              will automatically allocate the next available IP address from the specified prefix when creating
              interfaces. This is optional and can be left blank if you prefer to assign IPs manually.
            </p>
          </section>

          {/* Network Interfaces */}
          <section>
            <h3 className="text-lg font-semibold mb-3">Network Interfaces</h3>
            <p className="text-sm text-muted-foreground mb-3">
              Add network interfaces for your device. Each device can have multiple interfaces (e.g., Ethernet ports,
              management interfaces, loopbacks).
            </p>
            <div className="space-y-3">
              <div className="bg-muted/50 rounded-lg p-3">
                <h4 className="font-medium text-sm mb-2">Required Interface Fields:</h4>
                <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                  <li><strong>Name</strong> - Interface identifier (e.g., GigabitEthernet0/1, eth0)</li>
                  <li><strong>Type</strong> - Interface type (e.g., 1000BASE-T, SFP+, Virtual)</li>
                  <li><strong>Status</strong> - Operational status (e.g., Active, Planned, Disabled)</li>
                </ul>
              </div>
              <div className="bg-muted/50 rounded-lg p-3">
                <h4 className="font-medium text-sm mb-2">Optional Interface Fields:</h4>
                <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                  <li><strong>Description</strong> - Purpose or notes about the interface</li>
                  <li><strong>MAC Address</strong> - Hardware MAC address</li>
                  <li><strong>MTU</strong> - Maximum Transmission Unit size</li>
                  <li><strong>Enabled</strong> - Administrative status (up/down)</li>
                  <li><strong>Management Only</strong> - Mark if this is a dedicated management interface</li>
                </ul>
              </div>
            </div>
          </section>

          {/* IP Addresses */}
          <section>
            <h3 className="text-lg font-semibold mb-3">IP Addresses</h3>
            <p className="text-sm text-muted-foreground mb-3">
              Each interface can have multiple IP addresses assigned. IP addresses must be in CIDR notation.
            </p>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <p className="text-sm text-amber-900 font-medium mb-2">Required IP Address Fields:</p>
              <ul className="list-disc list-inside space-y-1 text-sm text-amber-800">
                <li><strong>Address</strong> - IP address in CIDR format (e.g., 192.168.1.10/24 or 2001:db8::1/64)</li>
                <li><strong>Namespace</strong> - IP namespace for address organization</li>
              </ul>
              <div className="mt-3 pt-3 border-t border-amber-300">
                <p className="text-sm text-amber-900 font-medium mb-1">Optional IP Address Fields:</p>
                <ul className="list-disc list-inside space-y-1 text-sm text-amber-800">
                  <li><strong>Role</strong> - Purpose of the IP (e.g., Loopback, Management, HSRP)</li>
                  <li><strong>Description</strong> - Additional notes about the IP address</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Primary IP */}
          <section>
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              Primary IP Address
            </h3>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <p className="text-sm text-amber-900">
                <strong>Important:</strong> Each device can have only <strong>ONE primary IPv4 address</strong> and
                <strong> ONE primary IPv6 address</strong>. The primary IP is the main address used to access
                and manage the device.
              </p>
              <p className="text-sm text-amber-800 mt-2">
                To set a primary IP, check the &quot;Primary&quot; checkbox for the desired IP address on each interface.
                If you mark multiple IPs as primary for the same IP version, the system will use the last one selected.
              </p>
            </div>
          </section>

          {/* Interface Properties */}
          <section>
            <h3 className="text-lg font-semibold mb-3">Interface Properties</h3>
            <p className="text-sm text-muted-foreground mb-3">
              Click the &quot;Properties&quot; button on any interface to configure advanced settings like VLAN assignments,
              untagged VLANs, and tagged VLANs for trunk ports.
            </p>
          </section>

          {/* Validation */}
          <section>
            <h3 className="text-lg font-semibold mb-3">Validation</h3>
            <p className="text-sm text-muted-foreground mb-3">
              Before submitting, you can click the &quot;Validate&quot; button to check if all required fields are properly
              filled out. The validation summary will show you:
            </p>
            <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
              <li>Status of all required device fields</li>
              <li>Interface validation (name, type, status)</li>
              <li>IP address validation (proper CIDR format, namespace)</li>
              <li>Count of any issues found</li>
            </ul>
          </section>

          {/* Workflow */}
          <section>
            <h3 className="text-lg font-semibold mb-3">Recommended Workflow</h3>
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <ol className="list-decimal list-inside space-y-2 text-sm text-green-900">
                <li>Fill in all required device information fields</li>
                <li>Optionally add tags and custom fields</li>
                <li>Configure prefix settings if you want automatic IP assignment</li>
                <li>Add network interfaces with names, types, and statuses</li>
                <li>Add IP addresses to interfaces in CIDR format</li>
                <li>Mark one IP as primary for device management access</li>
                <li>Configure advanced interface properties (VLANs) if needed</li>
                <li>Click &quot;Validate&quot; to check for errors</li>
                <li>Click &quot;Add Device&quot; to submit</li>
                <li>Review success message or error details</li>
              </ol>
            </div>
          </section>

          {/* CSV Import */}
          <section>
            <h3 className="text-lg font-semibold mb-3">CSV Import</h3>
            <p className="text-sm text-muted-foreground">
              For bulk device additions, use the &quot;Import from CSV&quot; button. You can upload a CSV file with
              multiple devices and their configurations. The import wizard will help you map CSV columns
              to device fields and validate the data before import.
            </p>
          </section>
        </div>

        <div className="flex justify-end pt-4 border-t">
          <Button onClick={() => onOpenChange(false)}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
