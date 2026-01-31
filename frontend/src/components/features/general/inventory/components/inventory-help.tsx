/**
 * Inventory Builder Help and Examples Component
 * Comprehensive documentation and usage examples for the inventory builder
 */

'use client'

import { BookOpen, Filter, Layers, Binary, FileCode, Globe, AlertCircle } from 'lucide-react'

// Simple code example component
function CodeExample({ title, code }: { title: string; code: string }) {
  return (
    <div className="space-y-2">
      <h5 className="text-sm font-medium text-gray-700">{title}</h5>
      <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-xs">
        <code>{code}</code>
      </pre>
    </div>
  )
}

export function InventoryHelpContent() {
  return (
    <div className="space-y-8">
      {/* Introduction */}
      <div className="shadow-lg border-0 p-0 bg-white rounded-lg overflow-hidden">
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 py-2 px-4 border-b">
          <div className="flex items-center gap-2 text-lg font-semibold">
            <BookOpen className="h-5 w-5 text-blue-600" />
            <span>Inventory Builder Overview</span>
          </div>
        </div>
        <div className="p-6 space-y-4">
          <p className="text-gray-700">
            The <strong>Inventory Builder</strong> is a powerful device selection system that uses logical operations 
            (AND/OR/NOT) to create dynamic device inventories. Build complex queries using a tree-based structure with 
            nested groups and real-time preview of matching devices from Nautobot.
          </p>
          <div className="grid md:grid-cols-3 gap-4 mt-4">
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <h4 className="font-semibold text-blue-800 mb-2">🎯 Logical Conditions</h4>
              <p className="text-sm text-blue-700">
                Create filters using fields like role, location, status, or custom fields with operators like equals, contains, not equals.
              </p>
            </div>
            <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
              <h4 className="font-semibold text-purple-800 mb-2">📦 Nested Groups</h4>
              <p className="text-sm text-purple-700">
                Organize conditions into groups with their own logic (AND/OR) and nest groups within groups for complex queries.
              </p>
            </div>
            <div className="p-4 bg-green-50 rounded-lg border border-green-200">
              <h4 className="font-semibold text-green-800 mb-2">💾 Save & Reuse</h4>
              <p className="text-sm text-green-700">
                Save your inventory queries for later use and share them with your team (global scope) or keep them private.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Root Logic Explanation */}
      <div className="shadow-lg border-0 p-0 bg-white rounded-lg overflow-hidden">
        <div className="bg-gradient-to-r from-purple-50 to-purple-100 py-2 px-4 border-b">
          <div className="flex items-center gap-2 text-lg font-semibold">
            <Binary className="h-5 w-5 text-purple-600" />
            <span>Root Logic Toggle (AND/OR)</span>
          </div>
        </div>
        <div className="p-6 space-y-6">
          <p className="text-gray-600 text-sm">
            The <strong>Root Logic</strong> determines how multiple top-level conditions and groups are combined. 
            You can toggle between <code className="bg-gray-100 px-2 py-1 rounded">AND</code> and{' '}
            <code className="bg-gray-100 px-2 py-1 rounded">OR</code> logic at the root level.
          </p>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <h4 className="font-semibold text-blue-800 mb-2 flex items-center gap-2">
                <span className="bg-blue-600 text-white text-xs px-2 py-1 rounded">AND</span>
                Root Logic
              </h4>
              <p className="text-sm text-blue-700 mb-2">
                All conditions must be true. Results are the <strong>intersection</strong> of matching devices.
              </p>
              <div className="text-xs text-blue-600 space-y-1">
                <div>✓ Role = Router <strong>AND</strong></div>
                <div>✓ Location = DC1 <strong>AND</strong></div>
                <div>✓ Status = Active</div>
                <div className="mt-2 font-semibold">→ Only devices matching ALL three conditions</div>
              </div>
            </div>

            <div className="p-4 bg-green-50 rounded-lg border border-green-200">
              <h4 className="font-semibold text-green-800 mb-2 flex items-center gap-2">
                <span className="bg-green-600 text-white text-xs px-2 py-1 rounded">OR</span>
                Root Logic
              </h4>
              <p className="text-sm text-green-700 mb-2">
                Any condition can be true. Results are the <strong>union</strong> of matching devices.
              </p>
              <div className="text-xs text-green-600 space-y-1">
                <div>✓ Role = Router <strong>OR</strong></div>
                <div>✓ Location = DC1 <strong>OR</strong></div>
                <div>✓ Status = Active</div>
                <div className="mt-2 font-semibold">→ Devices matching ANY of the three conditions</div>
              </div>
            </div>
          </div>

          <div className="p-4 bg-amber-50 rounded-lg border-l-4 border-amber-500">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />
              <div>
                <h4 className="font-semibold text-amber-800 mb-1">How to Toggle Root Logic</h4>
                <p className="text-sm text-amber-700">
                  Click the <strong>AND</strong> or <strong>OR</strong> button at the top of the condition tree. 
                  This changes how all top-level items are combined. Groups can have their own internal logic.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Grouping Mechanism */}
      <div className="shadow-lg border-0 p-0 bg-white rounded-lg overflow-hidden">
        <div className="bg-gradient-to-r from-indigo-50 to-blue-100 py-2 px-4 border-b">
          <div className="flex items-center gap-2 text-lg font-semibold">
            <Layers className="h-5 w-5 text-indigo-600" />
            <span>Grouping Mechanism</span>
          </div>
        </div>
        <div className="p-6 space-y-6">
          <p className="text-gray-600 text-sm">
            Groups allow you to organize conditions and apply different logical operations. You can nest groups 
            within groups to create sophisticated queries with parenthetical logic.
          </p>

          <div className="space-y-4">
            <h4 className="font-semibold text-gray-800">Group Properties</h4>
            <div className="grid md:grid-cols-2 gap-3">
              <div className="p-3 bg-indigo-50 rounded-lg border border-indigo-200">
                <h5 className="font-semibold text-indigo-800 text-sm mb-1">Group Logic (AND/OR/NOT)</h5>
                <p className="text-xs text-indigo-700">
                  Determines how the group relates to other items at the same level. 
                  Choose AND, OR, or NOT when creating the group.
                </p>
              </div>
              <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                <h5 className="font-semibold text-blue-800 text-sm mb-1">Internal Logic (AND/OR)</h5>
                <p className="text-xs text-blue-700">
                  Controls how conditions within the group are combined. 
                  You can change this by clicking the logic button inside the group.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="font-semibold text-gray-800">Creating Groups</h4>
            <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
              <li>Click the <strong>&quot;Add Group&quot;</strong> button</li>
              <li>Select the group logic: <strong>AND</strong>, <strong>OR</strong>, or <strong>NOT</strong></li>
              <li>The group appears in the tree with its own container</li>
              <li>Add conditions inside the group or nest another group</li>
              <li>Toggle the internal logic (AND/OR) by clicking the button inside the group</li>
            </ol>
          </div>

          <div className="p-4 bg-slate-50 rounded-lg border">
            <h5 className="font-semibold text-slate-800 mb-3">Visual Example: Group Structure</h5>
            <div className="space-y-2 text-sm font-mono">
              <div className="bg-white p-2 rounded border-l-4 border-blue-500">
                <strong>Root (AND)</strong>
                <div className="ml-4 mt-1 space-y-1">
                  <div>├─ Condition: role = router</div>
                  <div>├─ Condition: location = DC1</div>
                  <div className="bg-purple-50 p-2 rounded border-l-4 border-purple-500 mt-2">
                    <strong>└─ Group (NOT, Internal: OR)</strong>
                    <div className="ml-4 mt-1 space-y-1">
                      <div>├─ Condition: status = down</div>
                      <div>└─ Condition: status = maintenance</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <p className="text-xs text-gray-600 mt-3">
              This query means: <em>&quot;Get routers in DC1, but exclude those that are down OR in maintenance&quot;</em>
            </p>
          </div>
        </div>
      </div>

      {/* Available Fields and Operators */}
      <div className="shadow-lg border-0 p-0 bg-white rounded-lg overflow-hidden">
        <div className="bg-gradient-to-r from-slate-50 to-slate-100 py-2 px-4 border-b">
          <div className="flex items-center gap-2 text-lg font-semibold">
            <Filter className="h-5 w-5 text-slate-600" />
            <span>Available Fields and Operators</span>
          </div>
        </div>
        <div className="p-6 space-y-6">
          <div className="space-y-4">
            <h4 className="font-semibold text-gray-800">Device Fields</h4>
            <div className="grid md:grid-cols-3 gap-3 text-sm">
              <div className="p-2 bg-blue-50 rounded border border-blue-200">
                <strong>Name</strong> - Device hostname
              </div>
              <div className="p-2 bg-blue-50 rounded border border-blue-200">
                <strong>Location</strong> - Site/Location (hierarchical)
              </div>
              <div className="p-2 bg-blue-50 rounded border border-blue-200">
                <strong>Role</strong> - Device role (router, switch, etc.)
              </div>
              <div className="p-2 bg-blue-50 rounded border border-blue-200">
                <strong>Status</strong> - Device status (active, offline, etc.)
              </div>
              <div className="p-2 bg-blue-50 rounded border border-blue-200">
                <strong>Manufacturer</strong> - Device manufacturer
              </div>
              <div className="p-2 bg-blue-50 rounded border border-blue-200">
                <strong>Device Type</strong> - Model/type
              </div>
              <div className="p-2 bg-blue-50 rounded border border-blue-200">
                <strong>Platform</strong> - OS platform
              </div>
              <div className="p-2 bg-blue-50 rounded border border-blue-200">
                <strong>Tag</strong> - Device tags
              </div>
              <div className="p-2 bg-blue-50 rounded border border-blue-200">
                <strong>Has Primary IP</strong> - Has primary IP assigned
              </div>
              <div className="p-2 bg-green-50 rounded border border-green-200 md:col-span-3">
                <strong>Custom Fields</strong> - Any custom fields defined in Nautobot (dynamically loaded)
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="font-semibold text-gray-800">Operators</h4>
            <div className="grid md:grid-cols-2 gap-3 text-sm">
              <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                <strong className="text-green-800">equals</strong>
                <p className="text-xs text-green-700 mt-1">Exact match (case-insensitive)</p>
              </div>
              <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                <strong className="text-green-800">contains</strong>
                <p className="text-xs text-green-700 mt-1">Partial match (case-insensitive)</p>
              </div>
              <div className="p-3 bg-red-50 rounded-lg border border-red-200">
                <strong className="text-red-800">not_equals</strong>
                <p className="text-xs text-red-700 mt-1">Does not match exactly</p>
              </div>
              <div className="p-3 bg-red-50 rounded-lg border border-red-200">
                <strong className="text-red-800">not_contains</strong>
                <p className="text-xs text-red-700 mt-1">Does not contain the value</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Usage Examples */}
      <div className="shadow-lg border-0 p-0 bg-white rounded-lg overflow-hidden">
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 py-2 px-4 border-b">
          <div className="flex items-center gap-2 text-lg font-semibold">
            <FileCode className="h-5 w-5 text-green-600" />
            <span>Usage Examples</span>
          </div>
        </div>
        <div className="p-6 space-y-8">
          {/* Example 1 */}
          <div className="space-y-3">
            <h4 className="font-semibold text-gray-800 flex items-center gap-2">
              <span className="bg-green-600 text-white text-xs px-2 py-1 rounded">Example 1</span>
              Simple Filter - All Routers
            </h4>
            <div className="p-4 bg-green-50 rounded-lg border border-green-200">
              <p className="text-sm text-green-800 mb-3">
                <strong>Goal:</strong> Find all devices with role &quot;router&quot;
              </p>
              <div className="space-y-2 text-sm text-green-700">
                <div><strong>Steps:</strong></div>
                <ol className="list-decimal list-inside space-y-1 ml-2">
                  <li>Select field: <code className="bg-white px-1 rounded">Role</code></li>
                  <li>Select operator: <code className="bg-white px-1 rounded">equals</code></li>
                  <li>Enter value: <code className="bg-white px-1 rounded">router</code></li>
                  <li>Click <strong>&quot;Add Condition&quot;</strong></li>
                  <li>Click <strong>&quot;Preview Devices&quot;</strong> to see results</li>
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
            <h4 className="font-semibold text-gray-800 flex items-center gap-2">
              <span className="bg-blue-600 text-white text-xs px-2 py-1 rounded">Example 2</span>
              Multiple Conditions with AND Logic
            </h4>
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-sm text-blue-800 mb-3">
                <strong>Goal:</strong> Find routers in DC1 that are active
              </p>
              <div className="space-y-2 text-sm text-blue-700">
                <div><strong>Steps:</strong></div>
                <ol className="list-decimal list-inside space-y-1 ml-2">
                  <li>Add condition: <code className="bg-white px-1 rounded">role equals router</code></li>
                  <li>Add condition: <code className="bg-white px-1 rounded">location equals DC1</code></li>
                  <li>Add condition: <code className="bg-white px-1 rounded">status equals active</code></li>
                  <li>Ensure root logic is <strong>AND</strong> (default)</li>
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
            <h4 className="font-semibold text-gray-800 flex items-center gap-2">
              <span className="bg-purple-600 text-white text-xs px-2 py-1 rounded">Example 3</span>
              Multiple Conditions with OR Logic
            </h4>
            <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
              <p className="text-sm text-purple-800 mb-3">
                <strong>Goal:</strong> Find devices that are either routers OR switches
              </p>
              <div className="space-y-2 text-sm text-purple-700">
                <div><strong>Steps:</strong></div>
                <ol className="list-decimal list-inside space-y-1 ml-2">
                  <li>Add condition: <code className="bg-white px-1 rounded">role equals router</code></li>
                  <li>Add condition: <code className="bg-white px-1 rounded">role equals switch</code></li>
                  <li>Click the <strong>AND</strong> button at the top to toggle it to <strong>OR</strong></li>
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
            <h4 className="font-semibold text-gray-800 flex items-center gap-2">
              <span className="bg-red-600 text-white text-xs px-2 py-1 rounded">Example 4</span>
              Using NOT Groups (Exclusion)
            </h4>
            <div className="p-4 bg-red-50 rounded-lg border border-red-200">
              <p className="text-sm text-red-800 mb-3">
                <strong>Goal:</strong> Find all routers in DC1, but exclude those that are down or in maintenance
              </p>
              <div className="space-y-2 text-sm text-red-700">
                <div><strong>Steps:</strong></div>
                <ol className="list-decimal list-inside space-y-1 ml-2">
                  <li>Add condition: <code className="bg-white px-1 rounded">role equals router</code></li>
                  <li>Add condition: <code className="bg-white px-1 rounded">location equals DC1</code></li>
                  <li>Click <strong>&quot;Add Group&quot;</strong> and select <strong>NOT</strong></li>
                  <li>Inside the NOT group, add: <code className="bg-white px-1 rounded">status equals down</code></li>
                  <li>In the same group, add: <code className="bg-white px-1 rounded">status equals maintenance</code></li>
                  <li>Toggle the group&apos;s internal logic to <strong>OR</strong></li>
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
            <h4 className="font-semibold text-gray-800 flex items-center gap-2">
              <span className="bg-indigo-600 text-white text-xs px-2 py-1 rounded">Example 5</span>
              Complex Nested Groups
            </h4>
            <div className="p-4 bg-indigo-50 rounded-lg border border-indigo-200">
              <p className="text-sm text-indigo-800 mb-3">
                <strong>Goal:</strong> Find devices that are (routers in DC1 OR switches in DC2) AND have primary IP
              </p>
              <div className="space-y-2 text-sm text-indigo-700">
                <div><strong>Steps:</strong></div>
                <ol className="list-decimal list-inside space-y-1 ml-2">
                  <li>Set root logic to <strong>AND</strong></li>
                  <li>Create an <strong>OR Group</strong></li>
                  <li>Inside the OR group, create an <strong>AND Group</strong>:
                    <ul className="list-disc list-inside ml-4 mt-1">
                      <li>Add: <code className="bg-white px-1 rounded">role equals router</code></li>
                      <li>Add: <code className="bg-white px-1 rounded">location equals DC1</code></li>
                    </ul>
                  </li>
                  <li>Inside the same OR group, create another <strong>AND Group</strong>:
                    <ul className="list-disc list-inside ml-4 mt-1">
                      <li>Add: <code className="bg-white px-1 rounded">role equals switch</code></li>
                      <li>Add: <code className="bg-white px-1 rounded">location equals DC2</code></li>
                    </ul>
                  </li>
                  <li>At root level, add: <code className="bg-white px-1 rounded">has_primary equals true</code></li>
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
            <h4 className="font-semibold text-gray-800 flex items-center gap-2">
              <span className="bg-amber-600 text-white text-xs px-2 py-1 rounded">Example 6</span>
              Using Custom Fields
            </h4>
            <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
              <p className="text-sm text-amber-800 mb-3">
                <strong>Goal:</strong> Find devices with specific SNMP credentials
              </p>
              <div className="space-y-2 text-sm text-amber-700">
                <div><strong>Steps:</strong></div>
                <ol className="list-decimal list-inside space-y-1 ml-2">
                  <li>Select field: <code className="bg-white px-1 rounded">Custom Fields</code></li>
                  <li>Wait for custom fields to load from Nautobot</li>
                  <li>Select custom field: <code className="bg-white px-1 rounded">snmp_credentials</code></li>
                  <li>Select operator: <code className="bg-white px-1 rounded">equals</code></li>
                  <li>Select or enter value: <code className="bg-white px-1 rounded">prod-snmp-v3</code></li>
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
      <div className="shadow-lg border-0 p-0 bg-white rounded-lg overflow-hidden">
        <div className="bg-gradient-to-r from-yellow-50 to-amber-50 py-2 px-4 border-b">
          <div className="flex items-center gap-2 text-lg font-semibold">
            <Globe className="h-5 w-5 text-amber-600" />
            <span>Tips and Best Practices</span>
          </div>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="p-4 bg-blue-50 rounded-lg border-l-4 border-blue-500">
              <h5 className="font-semibold text-blue-800 mb-2">💡 Start Simple</h5>
              <p className="text-sm text-blue-700">
                Begin with a single condition and preview results. Gradually add more conditions or groups to refine your selection.
              </p>
            </div>
            <div className="p-4 bg-green-50 rounded-lg border-l-4 border-green-500">
              <h5 className="font-semibold text-green-800 mb-2">💾 Save Your Work</h5>
              <p className="text-sm text-green-700">
                Save frequently-used queries with descriptive names. Use &quot;global&quot; scope to share with your team.
              </p>
            </div>
            <div className="p-4 bg-purple-50 rounded-lg border-l-4 border-purple-500">
              <h5 className="font-semibold text-purple-800 mb-2">🎯 Use NOT Wisely</h5>
              <p className="text-sm text-purple-700">
                NOT groups are powerful for exclusions. Combine them with OR logic inside to exclude multiple conditions at once.
              </p>
            </div>
            <div className="p-4 bg-amber-50 rounded-lg border-l-4 border-amber-500">
              <h5 className="font-semibold text-amber-800 mb-2">📊 Preview Often</h5>
              <p className="text-sm text-amber-700">
                Click &quot;Preview Devices&quot; frequently to verify your query is returning the expected results before generating inventory.
              </p>
            </div>
            <div className="p-4 bg-red-50 rounded-lg border-l-4 border-red-500">
              <h5 className="font-semibold text-red-800 mb-2">🔍 Check Device Count</h5>
              <p className="text-sm text-red-700">
                Watch the device count in the preview. If it&apos;s too high or too low, adjust your conditions accordingly.
              </p>
            </div>
            <div className="p-4 bg-indigo-50 rounded-lg border-l-4 border-indigo-500">
              <h5 className="font-semibold text-indigo-800 mb-2">🏗️ Structure Complex Queries</h5>
              <p className="text-sm text-indigo-700">
                For very complex queries, use nested groups to maintain clarity and make it easier to modify later.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
