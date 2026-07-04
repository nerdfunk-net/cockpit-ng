/**
 * Inventory Builder Help and Examples Component
 * Comprehensive documentation and usage examples for the inventory builder
 */

'use client'

import { BookOpen, Filter, Layers, Binary, FileCode, Globe } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { StatusAlert } from '@/components/shared/status-alert'

// Simple code example component
function CodeExample({ title, code }: { title: string; code: string }) {
  return (
    <div className="space-y-2">
      <h5 className="text-sm font-medium text-muted-foreground">{title}</h5>
      <pre className="bg-muted text-foreground p-4 rounded-lg overflow-x-auto text-xs">
        <code>{code}</code>
      </pre>
    </div>
  )
}

export function InventoryHelpContent() {
  return (
    <div className="space-y-8">
      {/* Introduction */}
      <div className="shadow-lg border-0 p-0 bg-card rounded-lg overflow-hidden">
        <div className="bg-info py-2 px-4 border-b">
          <div className="flex items-center gap-2 text-lg font-semibold">
            <BookOpen className="h-5 w-5 text-info-foreground" />
            <span>Inventory Builder Overview</span>
          </div>
        </div>
        <div className="p-6 space-y-4">
          <p className="text-muted-foreground">
            The <strong>Inventory Builder</strong> is a powerful device selection system
            that uses logical operations (AND/OR/NOT) to create dynamic device
            inventories. Build complex queries using a tree-based structure with nested
            groups and real-time preview of matching devices from Nautobot.
          </p>
          <div className="grid md:grid-cols-3 gap-4 mt-4">
            <div className="p-4 bg-info rounded-lg border border-info-border">
              <h4 className="font-semibold text-info-foreground mb-2">
                🎯 Logical Conditions
              </h4>
              <p className="text-sm text-info-foreground">
                Create filters using fields like role, location, status, or custom
                fields with operators like equals, contains, not equals.
              </p>
            </div>
            <div className="p-4 bg-muted rounded-lg border border-border">
              <h4 className="font-semibold text-foreground mb-2">📦 Nested Groups</h4>
              <p className="text-sm text-muted-foreground">
                Organize conditions into groups with their own logic (AND/OR) and nest
                groups within groups for complex queries.
              </p>
            </div>
            <div className="p-4 bg-success rounded-lg border border-success-border">
              <h4 className="font-semibold text-success-foreground mb-2">
                💾 Save &amp; Reuse
              </h4>
              <p className="text-sm text-success-foreground">
                Save your inventory queries for later use and share them with your team
                (global scope) or keep them private.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Root Logic Explanation */}
      <div className="shadow-lg border-0 p-0 bg-card rounded-lg overflow-hidden">
        <div className="bg-muted py-2 px-4 border-b">
          <div className="flex items-center gap-2 text-lg font-semibold">
            <Binary className="h-5 w-5 text-muted-foreground" />
            <span>Root Logic Toggle (AND/OR)</span>
          </div>
        </div>
        <div className="p-6 space-y-6">
          <p className="text-muted-foreground text-sm">
            The <strong>Root Logic</strong> determines how multiple top-level conditions
            and groups are combined. You can toggle between{' '}
            <code className="bg-muted px-2 py-1 rounded">AND</code> and{' '}
            <code className="bg-muted px-2 py-1 rounded">OR</code> logic at the root
            level.
          </p>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="p-4 bg-info rounded-lg border border-info-border">
              <h4 className="font-semibold text-info-foreground mb-2 flex items-center gap-2">
                <Badge>AND</Badge>
                Root Logic
              </h4>
              <p className="text-sm text-info-foreground mb-2">
                All conditions must be true. Results are the{' '}
                <strong>intersection</strong> of matching devices.
              </p>
              <div className="text-xs text-info-foreground space-y-1">
                <div>
                  ✓ Role = Router <strong>AND</strong>
                </div>
                <div>
                  ✓ Location = DC1 <strong>AND</strong>
                </div>
                <div>✓ Status = Active</div>
                <div className="mt-2 font-semibold">
                  → Only devices matching ALL three conditions
                </div>
              </div>
            </div>

            <div className="p-4 bg-success rounded-lg border border-success-border">
              <h4 className="font-semibold text-success-foreground mb-2 flex items-center gap-2">
                <Badge>OR</Badge>
                Root Logic
              </h4>
              <p className="text-sm text-success-foreground mb-2">
                Any condition can be true. Results are the <strong>union</strong> of
                matching devices.
              </p>
              <div className="text-xs text-success-foreground space-y-1">
                <div>
                  ✓ Role = Router <strong>OR</strong>
                </div>
                <div>
                  ✓ Location = DC1 <strong>OR</strong>
                </div>
                <div>✓ Status = Active</div>
                <div className="mt-2 font-semibold">
                  → Devices matching ANY of the three conditions
                </div>
              </div>
            </div>
          </div>

          <StatusAlert variant="warning">
            <h4 className="font-semibold mb-1">How to Toggle Root Logic</h4>
            <p className="text-sm">
              Click the <strong>AND</strong> or <strong>OR</strong> button at the top of
              the condition tree. This changes how all top-level items are combined.
              Groups can have their own internal logic.
            </p>
          </StatusAlert>
        </div>
      </div>

      {/* Grouping Mechanism */}
      <div className="shadow-lg border-0 p-0 bg-card rounded-lg overflow-hidden">
        <div className="bg-muted py-2 px-4 border-b">
          <div className="flex items-center gap-2 text-lg font-semibold">
            <Layers className="h-5 w-5 text-muted-foreground" />
            <span>Grouping Mechanism</span>
          </div>
        </div>
        <div className="p-6 space-y-6">
          <p className="text-muted-foreground text-sm">
            Groups allow you to organize conditions and apply different logical
            operations. You can nest groups within groups to create sophisticated
            queries with parenthetical logic.
          </p>

          <div className="space-y-4">
            <h4 className="font-semibold text-foreground">Group Properties</h4>
            <div className="grid md:grid-cols-2 gap-3">
              <div className="p-3 bg-muted rounded-lg border border-border">
                <h5 className="font-semibold text-foreground text-sm mb-1">
                  Group Logic (AND/OR/NOT)
                </h5>
                <p className="text-xs text-muted-foreground">
                  Determines how the group relates to other items at the same level.
                  Choose AND, OR, or NOT when creating the group.
                </p>
              </div>
              <div className="p-3 bg-muted rounded-lg border border-border">
                <h5 className="font-semibold text-foreground text-sm mb-1">
                  Internal Logic (AND/OR)
                </h5>
                <p className="text-xs text-muted-foreground">
                  Controls how conditions within the group are combined. You can change
                  this by clicking the logic button inside the group.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="font-semibold text-foreground">Creating Groups</h4>
            <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
              <li>
                Click the <strong>&quot;Add Group&quot;</strong> button
              </li>
              <li>
                Select the group logic: <strong>AND</strong>, <strong>OR</strong>, or{' '}
                <strong>NOT</strong>
              </li>
              <li>The group appears in the tree with its own container</li>
              <li>Add conditions inside the group or nest another group</li>
              <li>
                Toggle the internal logic (AND/OR) by clicking the button inside the
                group
              </li>
            </ol>
          </div>

          <div className="p-4 bg-muted rounded-lg border border-border">
            <h5 className="font-semibold text-foreground mb-3">
              Visual Example: Group Structure
            </h5>
            <div className="space-y-2 text-sm font-mono">
              <div className="bg-card p-2 rounded border-l-4 border-primary">
                <strong>Root (AND)</strong>
                <div className="ml-4 mt-1 space-y-1">
                  <div>├─ Condition: role = router</div>
                  <div>├─ Condition: location = DC1</div>
                  <div className="bg-error p-2 rounded border-l-4 border-error-border mt-2">
                    <strong className="text-error-foreground">
                      └─ Group (NOT, Internal: OR)
                    </strong>
                    <div className="ml-4 mt-1 space-y-1 text-error-foreground">
                      <div>├─ Condition: status = down</div>
                      <div>└─ Condition: status = maintenance</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              This query means:{' '}
              <em>
                &quot;Get routers in DC1, but exclude those that are down OR in
                maintenance&quot;
              </em>
            </p>
          </div>
        </div>
      </div>

      {/* Available Fields and Operators */}
      <div className="shadow-lg border-0 p-0 bg-card rounded-lg overflow-hidden">
        <div className="bg-muted py-2 px-4 border-b">
          <div className="flex items-center gap-2 text-lg font-semibold">
            <Filter className="h-5 w-5 text-muted-foreground" />
            <span>Available Fields and Operators</span>
          </div>
        </div>
        <div className="p-6 space-y-6">
          <div className="space-y-4">
            <h4 className="font-semibold text-foreground">Device Fields</h4>
            <div className="grid md:grid-cols-3 gap-3 text-sm">
              <div className="p-2 bg-muted rounded border border-border">
                <strong>Name</strong> - Device hostname
              </div>
              <div className="p-2 bg-muted rounded border border-border">
                <strong>Location</strong> - Site/Location (hierarchical)
              </div>
              <div className="p-2 bg-muted rounded border border-border">
                <strong>Role</strong> - Device role (router, switch, etc.)
              </div>
              <div className="p-2 bg-muted rounded border border-border">
                <strong>Status</strong> - Device status (active, offline, etc.)
              </div>
              <div className="p-2 bg-muted rounded border border-border">
                <strong>Manufacturer</strong> - Device manufacturer
              </div>
              <div className="p-2 bg-muted rounded border border-border">
                <strong>Device Type</strong> - Model/type
              </div>
              <div className="p-2 bg-muted rounded border border-border">
                <strong>Platform</strong> - OS platform
              </div>
              <div className="p-2 bg-muted rounded border border-border">
                <strong>Tag</strong> - Device tags
              </div>
              <div className="p-2 bg-muted rounded border border-border">
                <strong>Has Primary IP</strong> - Has primary IP assigned
              </div>
              <div className="p-2 bg-success rounded border border-success-border md:col-span-3">
                <strong>Custom Fields</strong> - Any custom fields defined in Nautobot
                (dynamically loaded)
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="font-semibold text-foreground">Operators</h4>
            <div className="grid md:grid-cols-2 gap-3 text-sm">
              <div className="p-3 bg-success rounded-lg border border-success-border">
                <strong className="text-success-foreground">equals</strong>
                <p className="text-xs text-success-foreground mt-1">
                  Exact match (case-insensitive)
                </p>
              </div>
              <div className="p-3 bg-success rounded-lg border border-success-border">
                <strong className="text-success-foreground">contains</strong>
                <p className="text-xs text-success-foreground mt-1">
                  Partial match (case-insensitive)
                </p>
              </div>
              <div className="p-3 bg-error rounded-lg border border-error-border">
                <strong className="text-error-foreground">not_equals</strong>
                <p className="text-xs text-error-foreground mt-1">
                  Does not match exactly
                </p>
              </div>
              <div className="p-3 bg-error rounded-lg border border-error-border">
                <strong className="text-error-foreground">not_contains</strong>
                <p className="text-xs text-error-foreground mt-1">
                  Does not contain the value
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Usage Examples */}
      <div className="shadow-lg border-0 p-0 bg-card rounded-lg overflow-hidden">
        <div className="bg-muted py-2 px-4 border-b">
          <div className="flex items-center gap-2 text-lg font-semibold">
            <FileCode className="h-5 w-5 text-muted-foreground" />
            <span>Usage Examples</span>
          </div>
        </div>
        <div className="p-6 space-y-8">
          {/* Example 1 */}
          <div className="space-y-3">
            <h4 className="font-semibold text-foreground flex items-center gap-2">
              <Badge>Example 1</Badge>
              Simple Filter - All Routers
            </h4>
            <div className="p-4 bg-success rounded-lg border border-success-border">
              <p className="text-sm text-success-foreground mb-3">
                <strong>Goal:</strong> Find all devices with role &quot;router&quot;
              </p>
              <div className="space-y-2 text-sm text-success-foreground">
                <div>
                  <strong>Steps:</strong>
                </div>
                <ol className="list-decimal list-inside space-y-1 ml-2">
                  <li>
                    Select field: <code className="bg-card px-1 rounded">Role</code>
                  </li>
                  <li>
                    Select operator:{' '}
                    <code className="bg-card px-1 rounded">equals</code>
                  </li>
                  <li>
                    Enter value: <code className="bg-card px-1 rounded">router</code>
                  </li>
                  <li>
                    Click <strong>&quot;Add Condition&quot;</strong>
                  </li>
                  <li>
                    Click <strong>&quot;Preview Devices&quot;</strong> to see results
                  </li>
                </ol>
              </div>
            </div>
            <CodeExample
              title="Resulting Query Logic"
              code={`Root (AND)
└─ role equals "router"

Result: All devices with role = router`}
            />
          </div>

          {/* Example 2 */}
          <div className="space-y-3">
            <h4 className="font-semibold text-foreground flex items-center gap-2">
              <Badge>Example 2</Badge>
              Multiple Conditions with AND Logic
            </h4>
            <div className="p-4 bg-info rounded-lg border border-info-border">
              <p className="text-sm text-info-foreground mb-3">
                <strong>Goal:</strong> Find routers in DC1 that are active
              </p>
              <div className="space-y-2 text-sm text-info-foreground">
                <div>
                  <strong>Steps:</strong>
                </div>
                <ol className="list-decimal list-inside space-y-1 ml-2">
                  <li>
                    Add condition:{' '}
                    <code className="bg-card px-1 rounded">role equals router</code>
                  </li>
                  <li>
                    Add condition:{' '}
                    <code className="bg-card px-1 rounded">location equals DC1</code>
                  </li>
                  <li>
                    Add condition:{' '}
                    <code className="bg-card px-1 rounded">status equals active</code>
                  </li>
                  <li>
                    Ensure root logic is <strong>AND</strong> (default)
                  </li>
                  <li>Preview to see devices matching all three conditions</li>
                </ol>
              </div>
            </div>
            <CodeExample
              title="Resulting Query Logic"
              code={`Root (AND)
├─ role equals "router"
├─ location equals "DC1"
└─ status equals "active"

Result: Only devices matching ALL conditions
        (Routers AND in DC1 AND active)`}
            />
          </div>

          {/* Example 3 */}
          <div className="space-y-3">
            <h4 className="font-semibold text-foreground flex items-center gap-2">
              <Badge>Example 3</Badge>
              Multiple Conditions with OR Logic
            </h4>
            <div className="p-4 bg-success rounded-lg border border-success-border">
              <p className="text-sm text-success-foreground mb-3">
                <strong>Goal:</strong> Find devices that are either routers OR switches
              </p>
              <div className="space-y-2 text-sm text-success-foreground">
                <div>
                  <strong>Steps:</strong>
                </div>
                <ol className="list-decimal list-inside space-y-1 ml-2">
                  <li>
                    Add condition:{' '}
                    <code className="bg-card px-1 rounded">role equals router</code>
                  </li>
                  <li>
                    Add condition:{' '}
                    <code className="bg-card px-1 rounded">role equals switch</code>
                  </li>
                  <li>
                    Click the <strong>AND</strong> button at the top to toggle it to{' '}
                    <strong>OR</strong>
                  </li>
                  <li>Preview to see all routers and switches combined</li>
                </ol>
              </div>
            </div>
            <CodeExample
              title="Resulting Query Logic"
              code={`Root (OR)
├─ role equals "router"
└─ role equals "switch"

Result: Devices matching ANY condition
        (All routers + All switches)`}
            />
          </div>

          {/* Example 4 */}
          <div className="space-y-3">
            <h4 className="font-semibold text-foreground flex items-center gap-2">
              <Badge>Example 4</Badge>
              Using NOT Groups (Exclusion)
            </h4>
            <div className="p-4 bg-error rounded-lg border border-error-border">
              <p className="text-sm text-error-foreground mb-3">
                <strong>Goal:</strong> Find all routers in DC1, but exclude those that
                are down or in maintenance
              </p>
              <div className="space-y-2 text-sm text-error-foreground">
                <div>
                  <strong>Steps:</strong>
                </div>
                <ol className="list-decimal list-inside space-y-1 ml-2">
                  <li>
                    Add condition:{' '}
                    <code className="bg-card px-1 rounded">role equals router</code>
                  </li>
                  <li>
                    Add condition:{' '}
                    <code className="bg-card px-1 rounded">location equals DC1</code>
                  </li>
                  <li>
                    Click <strong>&quot;Add Group&quot;</strong> and select{' '}
                    <strong>NOT</strong>
                  </li>
                  <li>
                    Inside the NOT group, add:{' '}
                    <code className="bg-card px-1 rounded">status equals down</code>
                  </li>
                  <li>
                    In the same group, add:{' '}
                    <code className="bg-card px-1 rounded">
                      status equals maintenance
                    </code>
                  </li>
                  <li>
                    Toggle the group&apos;s internal logic to <strong>OR</strong>
                  </li>
                  <li>Preview to see routers in DC1 excluding problematic ones</li>
                </ol>
              </div>
            </div>
            <CodeExample
              title="Resulting Query Logic"
              code={`Root (AND)
├─ role equals "router"
├─ location equals "DC1"
└─ NOT Group (Internal: OR)
   ├─ status equals "down"
   └─ status equals "maintenance"

Result: (Routers in DC1) - (down OR maintenance)
        = Routers in DC1 that are neither down nor in maintenance`}
            />
          </div>

          {/* Example 5 */}
          <div className="space-y-3">
            <h4 className="font-semibold text-foreground flex items-center gap-2">
              <Badge>Example 5</Badge>
              Complex Nested Groups
            </h4>
            <div className="p-4 bg-muted rounded-lg border border-border">
              <p className="text-sm text-foreground mb-3">
                <strong>Goal:</strong> Find devices that are (routers in DC1 OR switches
                in DC2) AND have primary IP
              </p>
              <div className="space-y-2 text-sm text-muted-foreground">
                <div>
                  <strong>Steps:</strong>
                </div>
                <ol className="list-decimal list-inside space-y-1 ml-2">
                  <li>
                    Set root logic to <strong>AND</strong>
                  </li>
                  <li>
                    Create an <strong>OR Group</strong>
                  </li>
                  <li>
                    Inside the OR group, create an <strong>AND Group</strong>:
                    <ul className="list-disc list-inside ml-4 mt-1">
                      <li>
                        Add:{' '}
                        <code className="bg-card px-1 rounded">
                          role equals router
                        </code>
                      </li>
                      <li>
                        Add:{' '}
                        <code className="bg-card px-1 rounded">
                          location equals DC1
                        </code>
                      </li>
                    </ul>
                  </li>
                  <li>
                    Inside the same OR group, create another <strong>AND Group</strong>:
                    <ul className="list-disc list-inside ml-4 mt-1">
                      <li>
                        Add:{' '}
                        <code className="bg-card px-1 rounded">
                          role equals switch
                        </code>
                      </li>
                      <li>
                        Add:{' '}
                        <code className="bg-card px-1 rounded">
                          location equals DC2
                        </code>
                      </li>
                    </ul>
                  </li>
                  <li>
                    At root level, add:{' '}
                    <code className="bg-card px-1 rounded">
                      has_primary equals true
                    </code>
                  </li>
                </ol>
              </div>
            </div>
            <CodeExample
              title="Resulting Query Logic"
              code={`Root (AND)
├─ OR Group
│  ├─ AND Group
│  │  ├─ role equals "router"
│  │  └─ location equals "DC1"
│  └─ AND Group
│     ├─ role equals "switch"
│     └─ location equals "DC2"
└─ has_primary equals "true"

Result: ((Routers in DC1) OR (Switches in DC2)) AND (has primary IP)
        = DC1 routers and DC2 switches that have primary IPs`}
            />
          </div>

          {/* Example 6 */}
          <div className="space-y-3">
            <h4 className="font-semibold text-foreground flex items-center gap-2">
              <Badge>Example 6</Badge>
              Using Custom Fields
            </h4>
            <div className="p-4 bg-warning rounded-lg border border-warning-border">
              <p className="text-sm text-warning-foreground mb-3">
                <strong>Goal:</strong> Find devices with specific SNMP credentials
              </p>
              <div className="space-y-2 text-sm text-warning-foreground">
                <div>
                  <strong>Steps:</strong>
                </div>
                <ol className="list-decimal list-inside space-y-1 ml-2">
                  <li>
                    Select field:{' '}
                    <code className="bg-card px-1 rounded">Custom Fields</code>
                  </li>
                  <li>Wait for custom fields to load from Nautobot</li>
                  <li>
                    Select custom field:{' '}
                    <code className="bg-card px-1 rounded">snmp_credentials</code>
                  </li>
                  <li>
                    Select operator:{' '}
                    <code className="bg-card px-1 rounded">equals</code>
                  </li>
                  <li>
                    Select or enter value:{' '}
                    <code className="bg-card px-1 rounded">prod-snmp-v3</code>
                  </li>
                  <li>Add the condition and preview</li>
                </ol>
              </div>
            </div>
            <CodeExample
              title="Resulting Query Logic"
              code={`Root (AND)
└─ cf_snmp_credentials equals "prod-snmp-v3"

Result: All devices with the specific SNMP credential configuration`}
            />
          </div>
        </div>
      </div>

      {/* Tips and Best Practices */}
      <div className="shadow-lg border-0 p-0 bg-card rounded-lg overflow-hidden">
        <div className="bg-warning py-2 px-4 border-b">
          <div className="flex items-center gap-2 text-lg font-semibold">
            <Globe className="h-5 w-5 text-warning-foreground" />
            <span>Tips and Best Practices</span>
          </div>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="p-4 bg-info rounded-lg border-l-4 border-info-border">
              <h5 className="font-semibold text-info-foreground mb-2">
                💡 Start Simple
              </h5>
              <p className="text-sm text-info-foreground">
                Begin with a single condition and preview results. Gradually add more
                conditions or groups to refine your selection.
              </p>
            </div>
            <div className="p-4 bg-success rounded-lg border-l-4 border-success-border">
              <h5 className="font-semibold text-success-foreground mb-2">
                💾 Save Your Work
              </h5>
              <p className="text-sm text-success-foreground">
                Save frequently-used queries with descriptive names. Use
                &quot;global&quot; scope to share with your team.
              </p>
            </div>
            <div className="p-4 bg-muted rounded-lg border-l-4 border-border">
              <h5 className="font-semibold text-foreground mb-2">
                🎯 Use NOT Wisely
              </h5>
              <p className="text-sm text-muted-foreground">
                NOT groups are powerful for exclusions. Combine them with OR logic
                inside to exclude multiple conditions at once.
              </p>
            </div>
            <div className="p-4 bg-warning rounded-lg border-l-4 border-warning-border">
              <h5 className="font-semibold text-warning-foreground mb-2">
                📊 Preview Often
              </h5>
              <p className="text-sm text-warning-foreground">
                Click &quot;Preview Devices&quot; frequently to verify your query is
                returning the expected results before generating inventory.
              </p>
            </div>
            <div className="p-4 bg-error rounded-lg border-l-4 border-error-border">
              <h5 className="font-semibold text-error-foreground mb-2">
                🔍 Check Device Count
              </h5>
              <p className="text-sm text-error-foreground">
                Watch the device count in the preview. If it&apos;s too high or too low,
                adjust your conditions accordingly.
              </p>
            </div>
            <div className="p-4 bg-muted rounded-lg border-l-4 border-border">
              <h5 className="font-semibold text-foreground mb-2">
                🏗️ Structure Complex Queries
              </h5>
              <p className="text-sm text-muted-foreground">
                For very complex queries, use nested groups to maintain clarity and make
                it easier to modify later.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
