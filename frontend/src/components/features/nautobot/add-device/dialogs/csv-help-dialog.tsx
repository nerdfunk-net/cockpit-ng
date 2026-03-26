'use client'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { AlertCircle, HelpCircle } from 'lucide-react'

interface CSVHelpDialogProps {
  open: boolean
  onClose: () => void
}

export function CSVHelpDialog({ open, onClose }: CSVHelpDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5" />
            CSV File Format Guide
          </DialogTitle>
          <DialogDescription>
            Learn how to format your CSV file for device import
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4 text-sm">
          <div>
            <h4 className="font-semibold mb-2">File Format</h4>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li>First row must contain column headers</li>
              <li>Default delimiter: semicolon (;) - configurable in settings</li>
              <li>Multiple rows with the same device name will be merged</li>
              <li>One row per interface for devices with multiple interfaces</li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-2">Required Columns</h4>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li><code className="bg-muted px-1 py-0.5 rounded">name</code> (or device_name, hostname) - Device identifier</li>
              <li><code className="bg-muted px-1 py-0.5 rounded">device_type</code> (or model) - Device type/model</li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-2">Optional Device Columns</h4>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground text-xs">
              <li><code className="bg-muted px-1 py-0.5 rounded">role</code> - Device role</li>
              <li><code className="bg-muted px-1 py-0.5 rounded">location</code> (or site) - Location/site</li>
              <li><code className="bg-muted px-1 py-0.5 rounded">platform</code> (or os) - Platform/OS</li>
              <li><code className="bg-muted px-1 py-0.5 rounded">status</code> - Device status</li>
              <li><code className="bg-muted px-1 py-0.5 rounded">serial</code> - Serial number</li>
              <li><code className="bg-muted px-1 py-0.5 rounded">asset_tag</code> - Asset tag</li>
              <li><code className="bg-muted px-1 py-0.5 rounded">software_version</code> - Software version</li>
              <li><code className="bg-muted px-1 py-0.5 rounded">tags</code> - Comma-separated tags</li>
              <li><code className="bg-muted px-1 py-0.5 rounded">cf_*</code> - Custom fields (e.g., cf_net)</li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-2">Interface Columns (prefix with interface_)</h4>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground text-xs">
              <li><code className="bg-muted px-1 py-0.5 rounded">interface_name</code> - Interface name (required)</li>
              <li><code className="bg-muted px-1 py-0.5 rounded">interface_type</code> - Interface type (required)</li>
              <li><code className="bg-muted px-1 py-0.5 rounded">interface_ip_address</code> - IP with CIDR (e.g., 192.168.1.1/24)</li>
              <li><code className="bg-muted px-1 py-0.5 rounded">interface_description</code> - Interface description</li>
              <li><code className="bg-muted px-1 py-0.5 rounded">set_primary_ipv4</code> - Set as primary IP (true/false)</li>
              <li><code className="bg-muted px-1 py-0.5 rounded">interface_status</code> - Interface status</li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-2">Example CSV</h4>
            <div className="bg-muted p-3 rounded-md overflow-x-auto">
              <pre className="text-xs font-mono whitespace-pre">
{`name;device_type;serial;cf_net;tags;interface_name;interface_ip_address;interface_type;interface_description;set_primary_ipv4
test-1;virtual;12345;testnet;tag-1;eth0;192.168.100.1/24;1000BASE-T (1GE);testdescription-1;false
test-1;virtual;12345;testnet;tag-1;eth1;192.168.100.2/24;1000BASE-T (1GE);testdescription-2;true`}
              </pre>
            </div>
            <p className="text-muted-foreground text-xs mt-2">
              Note: This example shows a device &quot;test-1&quot; with two interfaces. Both rows have the same device_type, serial, etc., but different interface details.
            </p>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="flex gap-2">
              <AlertCircle className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-blue-800">
                <p className="font-semibold mb-1">Tips:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Device fields must be identical across all rows for the same device</li>
                  <li>If only one interface, set_primary_ipv4 will auto-set to true</li>
                  <li>Configure column mapping if your headers don&apos;t match the standard names</li>
                  <li>Use the mapping configuration to handle custom column names</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
