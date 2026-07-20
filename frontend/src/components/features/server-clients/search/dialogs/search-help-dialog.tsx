'use client'

import { HelpCircle } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { StatusAlert } from '@/components/shared/status-alert'

interface SearchHelpDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

function ExampleBlock({
  title,
  description,
  steps,
}: {
  title: string
  description: string
  steps: string[]
}) {
  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium text-primary">{title}</h4>
      <p className="text-xs text-muted-foreground">{description}</p>
      <div className="bg-muted border border-border rounded-md p-3 space-y-1.5">
        <ol className="text-xs text-foreground list-decimal list-inside space-y-1">
          {steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </div>
    </div>
  )
}

export function SearchHelpDialog({ open, onOpenChange }: SearchHelpDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[54rem] !max-w-[54rem] w-[85vw] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <HelpCircle className="h-5 w-5 text-primary" />
            <span>Server Search Help</span>
          </DialogTitle>
          <DialogDescription>
            How to build nested AND / OR / NOT queries against server inventory
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-foreground">Overview</h3>
            <p className="text-sm text-muted-foreground">
              Server Search finds managed servers from Ansible-gathered facts stored in
              Cockpit. You build a query as a tree of <strong>rules</strong> and{' '}
              <strong>groups</strong>. Each group combines its children with{' '}
              <strong>AND</strong> or <strong>OR</strong>, and can optionally apply{' '}
              <strong>NOT</strong> to invert the whole group.
            </p>
            <StatusAlert variant="info">
              Values come from the last successful facts gather. Servers without facts
              for a field (for example missing disk size or usage) will not match
              comparisons on that field. Disk usage changes whenever facts are
              refreshed.
            </StatusAlert>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-foreground">Available fields</h3>
            <div className="rounded-lg border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr className="text-left">
                    <th className="px-3 py-2 font-medium">Field</th>
                    <th className="px-3 py-2 font-medium">Operators</th>
                    <th className="px-3 py-2 font-medium">Notes</th>
                  </tr>
                </thead>
                <tbody className="text-muted-foreground">
                  <tr className="border-t border-border">
                    <td className="px-3 py-2 text-foreground">RAM (GB)</td>
                    <td className="px-3 py-2">
                      <code className="bg-muted px-1 rounded">&gt;</code>{' '}
                      <code className="bg-muted px-1 rounded">&lt;</code>{' '}
                      <code className="bg-muted px-1 rounded">=</code>
                    </td>
                    <td className="px-3 py-2">
                      Enter gigabytes in the UI (e.g. <code className="bg-muted px-1 rounded">8</code>
                      ). Converted to MB for search.
                    </td>
                  </tr>
                  <tr className="border-t border-border">
                    <td className="px-3 py-2 text-foreground">CPU</td>
                    <td className="px-3 py-2">
                      <code className="bg-muted px-1 rounded">&gt;</code>{' '}
                      <code className="bg-muted px-1 rounded">&lt;</code>{' '}
                      <code className="bg-muted px-1 rounded">=</code>
                    </td>
                    <td className="px-3 py-2">Processor / vCPU count</td>
                  </tr>
                  <tr className="border-t border-border">
                    <td className="px-3 py-2 text-foreground">Disk count</td>
                    <td className="px-3 py-2">
                      <code className="bg-muted px-1 rounded">&gt;</code>{' '}
                      <code className="bg-muted px-1 rounded">&lt;</code>{' '}
                      <code className="bg-muted px-1 rounded">=</code>
                    </td>
                    <td className="px-3 py-2">
                      Number of real <code className="bg-muted px-1 rounded">/dev/</code>{' '}
                      mounts (not partitions on tmpfs)
                    </td>
                  </tr>
                  <tr className="border-t border-border">
                    <td className="px-3 py-2 text-foreground">Disk size (GB)</td>
                    <td className="px-3 py-2">
                      <code className="bg-muted px-1 rounded">&gt;</code>{' '}
                      <code className="bg-muted px-1 rounded">&lt;</code>{' '}
                      <code className="bg-muted px-1 rounded">=</code>
                    </td>
                    <td className="px-3 py-2">
                      Sum of real-mount sizes, rounded up to whole GB
                    </td>
                  </tr>
                  <tr className="border-t border-border">
                    <td className="px-3 py-2 text-foreground">Disk usage (%)</td>
                    <td className="px-3 py-2">
                      <code className="bg-muted px-1 rounded">&gt;</code>{' '}
                      <code className="bg-muted px-1 rounded">&lt;</code>{' '}
                      <code className="bg-muted px-1 rounded">=</code>
                    </td>
                    <td className="px-3 py-2">
                      Snapshot from last facts gather:{' '}
                      ceil(used / total × 100) across real mounts. Changes when facts
                      are refreshed.
                    </td>
                  </tr>
                  <tr className="border-t border-border">
                    <td className="px-3 py-2 text-foreground">OS Family</td>
                    <td className="px-3 py-2">
                      <code className="bg-muted px-1 rounded">=</code>{' '}
                      <code className="bg-muted px-1 rounded">in</code>
                    </td>
                    <td className="px-3 py-2">
                      e.g. Debian, RedHat, Suse — pick from the dropdown
                    </td>
                  </tr>
                  <tr className="border-t border-border">
                    <td className="px-3 py-2 text-foreground">Distribution</td>
                    <td className="px-3 py-2">
                      <code className="bg-muted px-1 rounded">=</code>{' '}
                      <code className="bg-muted px-1 rounded">in</code>
                    </td>
                    <td className="px-3 py-2">
                      Distro name, e.g. Ubuntu, Debian, Rocky
                    </td>
                  </tr>
                  <tr className="border-t border-border">
                    <td className="px-3 py-2 text-foreground">Distribution version</td>
                    <td className="px-3 py-2">
                      <code className="bg-muted px-1 rounded">=</code>{' '}
                      <code className="bg-muted px-1 rounded">in</code>
                    </td>
                    <td className="px-3 py-2">
                      Version string, e.g. 22.04, 24.04, 9.4
                    </td>
                  </tr>
                  <tr className="border-t border-border">
                    <td className="px-3 py-2 text-foreground">Virtual Machine</td>
                    <td className="px-3 py-2">
                      <code className="bg-muted px-1 rounded">=</code>
                    </td>
                    <td className="px-3 py-2">Yes or No</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-foreground">
              Combinators: AND, OR, and NOT
            </h3>
            <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
              <li>
                <strong className="text-foreground">AND</strong> — every rule/group in
                the parent must match
              </li>
              <li>
                <strong className="text-foreground">OR</strong> — at least one
                rule/group in the parent must match
              </li>
              <li>
                <strong className="text-foreground">NOT</strong> — toggles inversion for
                the entire group (useful to exclude VMs or a distro family)
              </li>
              <li>
                Use <strong className="text-foreground">Group</strong> to nest another
                AND/OR block inside the current one (up to 5 levels deep)
              </li>
            </ul>
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground">Examples</h3>

            <ExampleBlock
              title="Example 1: More than 8 GB RAM and runs Debian family"
              description="Classic capacity + OS filter. Root group uses AND."
              steps={[
                'Set the root Match to AND',
                'Rule 1: RAM (GB)  >  8',
                'Click Rule, then set Rule 2: OS Family  =  Debian',
                'Click Search',
              ]}
            />

            <ExampleBlock
              title="Example 2: Ubuntu 22.04 virtual machines with at least 4 CPUs"
              description="Combines distribution name, version, VM flag, and CPU count."
              steps={[
                'Root Match: AND',
                'Rule: Distribution  =  Ubuntu',
                'Rule: Distribution version  =  22.04',
                'Rule: Virtual Machine  =  Yes',
                'Rule: CPU  >  3   (or  =  4 if you want exactly four)',
              ]}
            />

            <ExampleBlock
              title="Example 3: Large storage — either many disks or large total size"
              description="Root AND with an nested OR group for alternative disk criteria."
              steps={[
                'Root Match: AND',
                'Optional: Virtual Machine  =  No  (physical hosts only)',
                'Click Group — set that group Match to OR',
                'Inside the group: Disk count  >  4',
                'Inside the group: Disk size (GB)  >  500',
              ]}
            />

            <ExampleBlock
              title="Example 4: Everything except virtual machines"
              description="Use NOT on a small group that would otherwise match VMs."
              steps={[
                'Root Match: AND, leave NOT off on the root',
                'Click Group — enable NOT on that group',
                'Inside the NOT group (Match AND): Virtual Machine  =  Yes',
                'Result: servers that are not VMs',
              ]}
            />

            <ExampleBlock
              title="Example 5: Nested OR of two capacity profiles"
              description="(RAM > 16 GB AND RedHat) OR (Ubuntu 24.04)"
              steps={[
                'Root Match: OR',
                'Add Group A (AND): RAM (GB)  >  16 , OS Family  =  RedHat',
                'Add Group B (AND): Distribution  =  Ubuntu , Distribution version  =  24.04',
                'A server matches if it satisfies either group',
              ]}
            />

            <ExampleBlock
              title="Example 6: Multiple distributions with in"
              description="Match any of several distribution names in one rule."
              steps={[
                'Rule: Distribution  in  Ubuntu, Debian, Rocky',
                'Enter values as a comma-separated list when using the in operator',
                'Combine with other AND rules as needed (e.g. RAM > 4)',
              ]}
            />

            <ExampleBlock
              title="Example 7: High disk usage"
              description="Find servers that are more than 80% full (snapshot from last facts gather)."
              steps={[
                'Root Match: AND',
                'Rule: Disk usage (%)  >  80',
                'Optional: add OS Family or Virtual Machine filters',
                'Re-gather facts to refresh usage before relying on the value',
              ]}
            />
          </div>

          <div className="space-y-2 border-t border-border pt-4">
            <h3 className="text-sm font-semibold text-foreground">Tips</h3>
            <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
              <li>
                Dropdown options for OS Family, Distribution, and Version are filled
                from distinct values already present in your inventory
              </li>
              <li>
                Prefer <strong className="text-foreground">OS Family = Debian</strong>{' '}
                when you want all Debian-family hosts (Ubuntu + Debian), and{' '}
                <strong className="text-foreground">Distribution = Ubuntu</strong> when
                you need Ubuntu only
              </li>
              <li>
                <strong className="text-foreground">Reset</strong> clears the query tree
                and results so you can start over
              </li>
              <li>
                Re-gather Ansible facts on a server if search fields look empty or
                outdated
              </li>
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
