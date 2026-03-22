'use client'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { HelpCircle } from 'lucide-react'

interface HelpModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function HelpModal({ open, onOpenChange }: HelpModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5 text-blue-500" />
            Device Onboarding Help
          </DialogTitle>
          <DialogDescription>
            Learn how to onboard network devices to Nautobot
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          {/* Overview */}
          <section>
            <h3 className="font-semibold text-base mb-2">What is Device Onboarding?</h3>
            <p className="text-muted-foreground">
              Device onboarding is the process of automatically discovering and adding network devices
              to Nautobot. The system connects to devices via SSH, retrieves their configuration,
              and creates the device record along with its interfaces, IP addresses, and network data.
            </p>
          </section>

          {/* Process */}
          <section>
            <h3 className="font-semibold text-base mb-2">Onboarding Process</h3>
            <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
              <li>Enter the device IP address(es) and select configuration options</li>
              <li>Click &quot;Onboard Device&quot; to submit (you&apos;ll be prompted to confirm if no tags/custom fields are added)</li>
              <li>A Celery background task is created and a progress modal appears showing real-time updates</li>
              <li>The task triggers Nautobot&apos;s device onboarding job</li>
              <li>Nautobot connects to the device via SSH using the specified credentials</li>
              <li>Device information is discovered (hostname, platform, interfaces, etc.)</li>
              <li>After successful onboarding, tags and custom fields are applied to the device</li>
              <li>If enabled, additional network data is synchronized (cables, software, VLANs, VRFs)</li>
            </ol>
            <p className="text-muted-foreground text-sm mt-2">
              Note: The progress modal displays each step in real-time, including job status and any errors encountered.
            </p>
          </section>

          {/* Network Scanning */}
          <section>
            <h3 className="font-semibold text-base mb-2">Network Scanning</h3>
            <p className="text-muted-foreground mb-2">
              Use the &quot;Scan Network&quot; button to discover reachable hosts before onboarding:
            </p>
            <ol className="list-decimal list-inside space-y-1 text-muted-foreground text-sm">
              <li>Click &quot;Scan Network&quot; in the top right corner</li>
              <li>Enter one or more network addresses using CIDR notation (e.g., <code className="bg-muted px-1 rounded">192.168.1.0/24</code>)</li>
              <li>The system uses fping to quickly scan for reachable hosts</li>
              <li>Select the IP addresses you want to onboard from the results</li>
              <li>Click &quot;Add to Onboarding&quot; to populate the IP addresses field</li>
            </ol>
            <p className="text-muted-foreground text-sm mt-2">
              Note: Network scanning only checks host reachability via ping. It does not attempt device authentication.
            </p>
          </section>

          {/* Multiple IPs */}
          <section>
            <h3 className="font-semibold text-base mb-2">Multiple Device Onboarding</h3>
            <p className="text-muted-foreground">
              You can onboard multiple devices at once by entering comma-separated IP addresses
              (e.g., <code className="bg-muted px-1 rounded">192.168.1.1, 192.168.1.2, 192.168.1.3</code>).
              All devices will be onboarded with the same configuration settings.
            </p>
          </section>

          {/* Required Fields */}
          <section>
            <h3 className="font-semibold text-base mb-2">Required Fields</h3>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li><strong>IP Address(es)</strong> — Management IP of the device(s)</li>
              <li><strong>Location</strong> — Physical location in Nautobot hierarchy</li>
              <li><strong>Namespace</strong> — IP namespace for address management</li>
              <li><strong>Device Role</strong> — Function of the device (e.g., Router, Switch)</li>
              <li><strong>Device Status</strong> — Operational status (e.g., Active, Planned)</li>
              <li><strong>Secret Group</strong> — Credentials for SSH access</li>
              <li><strong>Interface Status</strong> — Default status for discovered interfaces</li>
              <li><strong>IP Address Status</strong> — Status for discovered IP addresses</li>
              <li><strong>Prefix Status</strong> — Status for discovered prefixes</li>
            </ul>
          </section>

          {/* Optional Features */}
          <section>
            <h3 className="font-semibold text-base mb-2">Optional Features</h3>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li><strong>Platform</strong> — Auto-detect or specify device OS (Cisco IOS, Junos, etc.)</li>
              <li><strong>Tags</strong> — Apply Nautobot tags to categorize devices (opens modal to select tags)</li>
              <li><strong>Custom Fields</strong> — Set custom field values for additional metadata (opens modal)</li>
              <li><strong>SSH Port</strong> — Non-standard SSH port (default: 22)</li>
              <li><strong>Timeout</strong> — SSH connection timeout in seconds (default: 30)</li>
              <li><strong>Onboarding Timeout</strong> — Maximum time to wait for onboarding job completion (default: 120s, increase for slower devices or when using auto-detect)</li>
            </ul>
          </section>

          {/* Sync Options */}
          <section>
            <h3 className="font-semibold text-base mb-2">Sync Options</h3>
            <p className="text-muted-foreground mb-2">
              Select which additional network data to synchronize after device onboarding completes.
              All options are enabled by default:
            </p>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li><strong>Cables</strong> — Discover cable connections via LLDP/CDP</li>
              <li><strong>Software</strong> — Retrieve software version information</li>
              <li><strong>VLANs</strong> — Import VLAN configurations</li>
              <li><strong>VRFs</strong> — Import VRF routing instances</li>
            </ul>
            <p className="text-muted-foreground text-sm mt-2">
              You can uncheck any options you don&apos;t need to speed up the onboarding process.
            </p>
          </section>

          {/* Bulk Upload */}
          <section>
            <h3 className="font-semibold text-base mb-2">Bulk CSV Upload</h3>
            <p className="text-muted-foreground">
              For onboarding many devices, use the &quot;Bulk Upload CSV&quot; feature. The CSV file
              should contain columns for IP addresses and optionally override settings per device.
              Supported columns include: <code className="bg-muted px-1 rounded">ipaddress</code>,{' '}
              <code className="bg-muted px-1 rounded">location</code>,{' '}
              <code className="bg-muted px-1 rounded">device_role</code>,{' '}
              <code className="bg-muted px-1 rounded">tags</code> (semicolon-separated),
              and custom fields with <code className="bg-muted px-1 rounded">cf_</code> prefix.
            </p>
          </section>

          {/* Supported Platforms */}
          <section>
            <h3 className="font-semibold text-base mb-2">Supported Platforms</h3>
            <p className="text-muted-foreground">
              The onboarding process supports devices that can be accessed via SSH and are compatible
              with Nautobot&apos;s network automation. Common platforms include:
            </p>
            <div className="flex flex-wrap gap-2 mt-2">
              {['Cisco IOS', 'Cisco IOS-XE', 'Cisco NX-OS', 'Arista EOS', 'Juniper Junos',
                'Palo Alto PAN-OS', 'Linux', 'Fortinet FortiOS'].map(platform => (
                <span key={platform} className="bg-muted px-2 py-1 rounded text-xs">
                  {platform}
                </span>
              ))}
            </div>
          </section>

          {/* Tips */}
          <section className="bg-blue-50 dark:bg-blue-950/30 p-3 rounded-lg">
            <h3 className="font-semibold text-base mb-2 text-blue-900 dark:text-blue-100">💡 Tips</h3>
            <ul className="list-disc list-inside space-y-1 text-blue-800 dark:text-blue-200 text-xs">
              <li>Use &quot;Check IP&quot; to verify if an IP address already exists in Nautobot</li>
              <li>Use &quot;Device Name Search&quot; to check if a device name is already taken</li>
              <li>Platform auto-detection works for most common network devices</li>
              <li>Ensure the Secret Group has valid SSH credentials for the target devices</li>
              <li>For devices behind NAT, specify the correct reachable IP address</li>
            </ul>
          </section>

          {/* Close Button */}
          <div className="flex justify-end pt-2">
            <Button onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
