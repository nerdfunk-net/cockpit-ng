import { FileCode, Terminal, HelpCircle, BookOpen, Server, Settings } from 'lucide-react'
import { CodeExample } from './code-example'

export function GeneralTab() {
  return (
    <div className="space-y-6">
      {/* Introduction */}
      <div className="shadow-lg border-0 p-0 bg-white rounded-lg overflow-hidden">
        <div className="bg-gradient-to-r from-purple-50 to-violet-50 py-2 px-4 border-b">
          <div className="flex items-center gap-2 text-lg font-semibold">
            <BookOpen className="h-5 w-5 text-purple-600" />
            <span>Template Editor Overview</span>
          </div>
        </div>
        <div className="p-6 space-y-4">
          <p className="text-gray-700">
            The Template Editor is a powerful tool for creating and managing <strong>Jinja2</strong> templates
            for both network automation (Netmiko) and agent-based deployments. Templates support dynamic
            variables, Nautobot integration, and category-specific features.
          </p>

          <div className="grid md:grid-cols-2 gap-4 mt-4">
            <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
              <h4 className="font-semibold text-purple-800 mb-2 flex items-center gap-2">
                <Terminal className="h-4 w-4" />
                Netmiko Templates
              </h4>
              <p className="text-sm text-purple-700">
                Execute network configuration commands via SSH/Telnet. Supports pre-run commands with
                TextFSM parsing and device-specific rendering.
              </p>
            </div>
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <h4 className="font-semibold text-blue-800 mb-2 flex items-center gap-2">
                <Server className="h-4 w-4" />
                Agent Templates
              </h4>
              <p className="text-sm text-blue-700">
                Deploy configuration files to remote agents. Supports inventory-based device data,
                SNMP mappings, and file path specifications.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Key Features */}
      <div className="shadow-lg border-0 p-0 bg-white rounded-lg overflow-hidden">
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 py-2 px-4 border-b">
          <div className="flex items-center gap-2 text-lg font-semibold">
            <Settings className="h-5 w-5 text-blue-600" />
            <span>Key Features</span>
          </div>
        </div>
        <div className="p-6 space-y-6">
          <div className="space-y-4">
            <h4 className="font-semibold text-gray-800">Variables System</h4>
            <p className="text-gray-600 text-sm">
              Templates can access variables from four different sources during rendering:
            </p>
            <div className="grid md:grid-cols-2 gap-3 text-sm mt-3">
              <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                <p className="font-semibold text-green-800 mb-1">Custom Variables</p>
                <p className="text-green-700 text-xs">
                  Define your own variables with manual or derived values. Perfect for configuration parameters
                  that vary between template renderings.
                </p>
              </div>
              <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                <p className="font-semibold text-amber-800 mb-1">YAML Files</p>
                <p className="text-amber-700 text-xs">
                  Load structured data from YAML configuration files. Useful for complex variable structures,
                  lookup tables, and dynamic data management.
                </p>
              </div>
              <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                <p className="font-semibold text-blue-800 mb-1">Nautobot Variables</p>
                <p className="text-blue-700 text-xs">
                  Access device data directly from Nautobot including hostname, IP addresses, interfaces,
                  custom fields, and other device properties.
                </p>
              </div>
              <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
                <p className="font-semibold text-purple-800 mb-1">Inventory Variables</p>
                <p className="text-purple-700 text-xs">
                  In Agent mode, access inventory data including device lists, SNMP mappings, and
                  multi-device management capabilities.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="font-semibold text-gray-800">Nautobot Integration</h4>
            <p className="text-gray-600 text-sm">
              Pull device information directly from Nautobot as your source of truth:
            </p>
            <div className="grid md:grid-cols-2 gap-3 text-sm">
              <div className="p-2 bg-blue-50 rounded border border-blue-200">
                Device properties (hostname, IPs, platform)
              </div>
              <div className="p-2 bg-blue-50 rounded border border-blue-200">
                Location and tenant information
              </div>
              <div className="p-2 bg-blue-50 rounded border border-blue-200">
                Interfaces and IP addresses
              </div>
              <div className="p-2 bg-blue-50 rounded border border-blue-200">
                Custom fields and metadata
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="font-semibold text-gray-800">Live Preview</h4>
            <p className="text-gray-600 text-sm">
              Test your templates with actual data before deployment. The &quot;Show Rendered Template&quot;
              button renders your template with current variable values and displays the output.
            </p>
          </div>
        </div>
      </div>

      {/* Jinja2 Basics */}
      <div className="shadow-lg border-0 p-0 bg-white rounded-lg overflow-hidden">
        <div className="bg-gradient-to-r from-slate-50 to-slate-100 py-2 px-4 border-b">
          <div className="flex items-center gap-2 text-lg font-semibold">
            <FileCode className="h-5 w-5 text-slate-600" />
            <span>Jinja2 Syntax Basics</span>
          </div>
        </div>
        <div className="p-6 space-y-6">
          <div className="space-y-4">
            <h4 className="font-semibold text-gray-800">Variable Output</h4>
            <div className="p-3 bg-gray-50 rounded-lg border">
              <code className="text-sm text-blue-600">{'{{ variable_name }}'}</code>
              <p className="text-xs text-gray-500 mt-1">Double curly braces output variable values</p>
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="font-semibold text-gray-800">Control Structures</h4>
            <div className="grid md:grid-cols-2 gap-4">
              <CodeExample
                title="For Loop"
                code={`{% for item in list %}
  {{ item }}
{% endfor %}`}
              />
              <CodeExample
                title="Conditional"
                code={`{% if condition %}
  {{ value }}
{% else %}
  Default
{% endif %}`}
              />
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="font-semibold text-gray-800">Filters</h4>
            <p className="text-gray-600 text-sm">
              Transform values using filters with the pipe character:
            </p>
            <div className="grid md:grid-cols-3 gap-3">
              <div className="p-3 bg-gray-50 rounded-lg border text-sm">
                <code className="text-blue-600">{'{{ name | upper }}'}</code>
                <p className="text-xs text-gray-500 mt-1">Uppercase</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg border text-sm">
                <code className="text-blue-600">{'{{ items | length }}'}</code>
                <p className="text-xs text-gray-500 mt-1">Length</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg border text-sm">
                <code className="text-blue-600">{'{{ val | default("N/A") }}'}</code>
                <p className="text-xs text-gray-500 mt-1">Default value</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Best Practices */}
      <div className="shadow-lg border-0 p-0 bg-white rounded-lg overflow-hidden">
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 py-2 px-4 border-b">
          <div className="flex items-center gap-2 text-lg font-semibold">
            <HelpCircle className="h-5 w-5 text-green-600" />
            <span>Best Practices</span>
          </div>
        </div>
        <div className="p-6">
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h4 className="font-semibold text-gray-800 border-b pb-2">Recommended</h4>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">✓</span>
                  Use descriptive variable names
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">✓</span>
                  Add comments to explain template logic
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">✓</span>
                  Test templates before deployment
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">✓</span>
                  Use default filters for optional fields
                </li>
              </ul>
            </div>
            <div className="space-y-4">
              <h4 className="font-semibold text-gray-800 border-b pb-2">Avoid</h4>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-start gap-2">
                  <span className="text-red-500 mt-0.5">✗</span>
                  Hardcoding values that should be variables
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-500 mt-0.5">✗</span>
                  Assuming fields always exist
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-500 mt-0.5">✗</span>
                  Storing sensitive data in templates
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-500 mt-0.5">✗</span>
                  Overly complex nested loops
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
