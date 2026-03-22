import { FileCode, Terminal, Globe, Database } from 'lucide-react'
import { CodeExample } from './code-example'

export function NetmikoTab() {
  return (
    <div className="space-y-6">
      {/* Introduction */}
      <div className="shadow-lg border-0 p-0 bg-white rounded-lg overflow-hidden">
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 py-2 px-4 border-b">
          <div className="flex items-center gap-2 text-lg font-semibold">
            <Terminal className="h-5 w-5 text-blue-600" />
            <span>Netmiko Templates Overview</span>
          </div>
        </div>
        <div className="p-6 space-y-4">
          <p className="text-gray-700">
            Netmiko templates allow you to create reusable configuration commands using <strong>Jinja2</strong> syntax.
            Templates can dynamically pull data from <strong>Nautobot</strong> (your source of truth for network devices)
            and can execute <strong>pre-run commands</strong> on devices to gather real-time information before rendering.
          </p>
          <div className="grid md:grid-cols-3 gap-4 mt-4">
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <h4 className="font-semibold text-blue-800 mb-2">Nautobot Integration</h4>
              <p className="text-sm text-blue-700">
                Access device information like hostname, IP addresses, interfaces, and custom fields directly from Nautobot.
              </p>
            </div>
            <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
              <h4 className="font-semibold text-amber-800 mb-2">Pre-run Commands</h4>
              <p className="text-sm text-amber-700">
                Execute commands on devices before rendering. Output is parsed with TextFSM and available as variables.
              </p>
            </div>
            <div className="p-4 bg-green-50 rounded-lg border border-green-200">
              <h4 className="font-semibold text-green-800 mb-2">Custom Variables & YAML Files</h4>
              <p className="text-sm text-green-700">
                Define custom variables manually or load structured data from YAML files. Combine sources to create
                flexible, data-driven templates.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Variables Sources */}
      <div className="shadow-lg border-0 p-0 bg-white rounded-lg overflow-hidden">
        <div className="bg-gradient-to-r from-indigo-50 to-indigo-100 py-2 px-4 border-b">
          <div className="flex items-center gap-2 text-lg font-semibold">
            <Database className="h-5 w-5 text-indigo-600" />
            <span>Variable Sources</span>
          </div>
        </div>
        <div className="p-6 space-y-6">
          <p className="text-gray-600 text-sm">
            Your templates can access variables from multiple sources. Each source provides different capabilities:
          </p>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="p-4 bg-green-50 rounded-lg border border-green-200">
              <h4 className="font-semibold text-green-800 mb-2 flex items-center gap-2">
                <span className="text-lg">📝</span>
                Custom Variables
              </h4>
              <p className="text-sm text-green-700 mb-3">
                Create your own variables that can be filled in during template rendering.
              </p>
              <div className="bg-white rounded border border-green-100 p-2 text-xs text-gray-700">
                <code className="text-green-600">{'{{ my_variable }}'}</code>
                <p className="text-gray-500 mt-1">User-defined value</p>
              </div>
            </div>

            <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
              <h4 className="font-semibold text-amber-800 mb-2 flex items-center gap-2">
                <span className="text-lg">📄</span>
                YAML Files
              </h4>
              <p className="text-sm text-amber-700 mb-3">
                Load structured configuration data from YAML files for complex variable hierarchies.
              </p>
              <div className="bg-white rounded border border-amber-100 p-2 text-xs text-gray-700">
                <code className="text-amber-600">{'{{ yaml_data.key }}'}</code>
                <p className="text-gray-500 mt-1">Loaded from YAML file</p>
              </div>
            </div>

            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <h4 className="font-semibold text-blue-800 mb-2 flex items-center gap-2">
                <span className="text-lg">🌐</span>
                Nautobot Variables
              </h4>
              <p className="text-sm text-blue-700 mb-3">
                Access device information directly from your Nautobot instance.
              </p>
              <div className="bg-white rounded border border-blue-100 p-2 text-xs text-gray-700">
                <code className="text-blue-600">{'{{ nautobot.name }}'}</code>
                <p className="text-gray-500 mt-1">Device data from Nautobot</p>
              </div>
            </div>

            <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
              <h4 className="font-semibold text-purple-800 mb-2 flex items-center gap-2">
                <span className="text-lg">📦</span>
                Inventory Variables
              </h4>
              <p className="text-sm text-purple-700 mb-3">
                In Agent mode, access device lists and SNMP mappings from inventories.
              </p>
              <div className="bg-white rounded border border-purple-100 p-2 text-xs text-gray-700">
                <code className="text-purple-600">{'{{ devices }}, {{ snmp_mapping }}'}</code>
                <p className="text-gray-500 mt-1">Inventory data (Agent mode)</p>
              </div>
            </div>
          </div>

          <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-sm text-blue-800">
              <strong>💡 Tip:</strong> You can combine multiple variable sources in the same template. For example,
              use Nautobot device data alongside custom variables for maximum flexibility.
            </p>
          </div>
        </div>
      </div>

      {/* Nautobot Context */}
      <div className="shadow-lg border-0 p-0 bg-white rounded-lg overflow-hidden">
        <div className="bg-gradient-to-r from-blue-50 to-blue-100 py-2 px-4 border-b">
          <div className="flex items-center gap-2 text-lg font-semibold">
            <Globe className="h-5 w-5 text-blue-600" />
            <span>Nautobot Context Variables</span>
          </div>
        </div>
        <div className="p-6 space-y-6">
          <p className="text-gray-600 text-sm">
            Device information is available under the <code className="bg-gray-100 px-1 rounded">nautobot</code> namespace
            when you select a test device for rendering.
          </p>

          <div className="space-y-4">
            <h4 className="font-semibold text-gray-800">Available Device Fields</h4>
            <div className="grid md:grid-cols-2 gap-3 text-sm">
              <div className="space-y-2">
                <div className="p-2 bg-blue-50 rounded border border-blue-200">
                  <code>nautobot.name</code> - Device hostname
                </div>
                <div className="p-2 bg-blue-50 rounded border border-blue-200">
                  <code>nautobot.primary_ip4.address</code> - Primary IPv4
                </div>
                <div className="p-2 bg-blue-50 rounded border border-blue-200">
                  <code>nautobot.platform.name</code> - Platform
                </div>
                <div className="p-2 bg-blue-50 rounded border border-blue-200">
                  <code>nautobot.role.name</code> - Device role
                </div>
              </div>
              <div className="space-y-2">
                <div className="p-2 bg-blue-50 rounded border border-blue-200">
                  <code>nautobot.location.name</code> - Location/Site
                </div>
                <div className="p-2 bg-blue-50 rounded border border-blue-200">
                  <code>nautobot.serial</code> - Serial number
                </div>
                <div className="p-2 bg-blue-50 rounded border border-blue-200">
                  <code>nautobot.interfaces</code> - List of interfaces
                </div>
                <div className="p-2 bg-blue-50 rounded border border-blue-200">
                  <code>nautobot.custom_fields.*</code> - Custom fields
                </div>
              </div>
            </div>
          </div>

          <CodeExample
            title="Example: Device Configuration with Nautobot Data"
            code={`! Configuration for {{ nautobot.name }}
! Location: {{ nautobot.location.name | default("Unknown") }}
! Role: {{ nautobot.role.name | default("Unknown") }}

hostname {{ nautobot.name }}

{% if nautobot.primary_ip4 %}
interface Vlan1
 ip address {{ nautobot.primary_ip4.address }}
{% endif %}`}
          />
        </div>
      </div>

      {/* Pre-run Commands */}
      <div className="shadow-lg border-0 p-0 bg-white rounded-lg overflow-hidden">
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 py-2 px-4 border-b">
          <div className="flex items-center gap-2 text-lg font-semibold">
            <Terminal className="h-5 w-5 text-amber-600" />
            <span>Pre-run Commands</span>
          </div>
        </div>
        <div className="p-6 space-y-6">
          <p className="text-gray-600 text-sm">
            Pre-run commands execute on the device <strong>before</strong> rendering the template.
            The command output is automatically parsed using <strong>TextFSM</strong> and available as template variables.
          </p>

          <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
            <h4 className="font-semibold text-amber-800 mb-2">How it works:</h4>
            <ol className="list-decimal list-inside text-sm text-amber-700 space-y-1">
              <li>Enter a command (e.g., <code className="bg-amber-100 px-1 rounded">show ip interface brief</code>)</li>
              <li>Select credentials for device authentication</li>
              <li>When you render the template, the command runs first</li>
              <li>Output is parsed with TextFSM and available as <code className="bg-amber-100 px-1 rounded">pre_run.parsed</code></li>
              <li>Raw output is available as <code className="bg-amber-100 px-1 rounded">pre_run.raw</code></li>
            </ol>
          </div>

          <div className="space-y-4">
            <h4 className="font-semibold text-gray-800">Pre-run Variables</h4>
            <div className="grid md:grid-cols-2 gap-3 text-sm">
              <div className="p-3 bg-gray-50 rounded-lg border">
                <code className="text-blue-600">{'{{ pre_run.parsed }}'}</code>
                <p className="text-xs text-gray-500 mt-1">List of parsed results (TextFSM output)</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg border">
                <code className="text-blue-600">{'{{ pre_run.raw }}'}</code>
                <p className="text-xs text-gray-500 mt-1">Raw command output as string</p>
              </div>
            </div>
          </div>

          <CodeExample
            title="Example: Configure interfaces based on current status"
            code={`{# Pre-run command: show ip interface brief #}
! Interface Status Report for {{ nautobot.name }}

{% for intf in pre_run.parsed %}
{% if intf.status == 'down' and intf.protocol == 'down' %}
interface {{ intf.interface }}
 description UNUSED
 shutdown
{% endif %}
{% endfor %}`}
          />
        </div>
      </div>

      {/* Complete Examples */}
      <div className="shadow-lg border-0 p-0 bg-white rounded-lg overflow-hidden">
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 py-2 px-4 border-b">
          <div className="flex items-center gap-2 text-lg font-semibold">
            <FileCode className="h-5 w-5 text-green-600" />
            <span>Complete Examples</span>
          </div>
        </div>
        <div className="p-6 space-y-6">
          <CodeExample
            title="Basic VLAN Configuration"
            code={`interface {{ user_variables.interface }}
 description {{ user_variables.description }}
 switchport mode access
 switchport access vlan {{ user_variables.vlan_id }}
 spanning-tree portfast
 no shutdown`}
          />

          <CodeExample
            title="NTP Configuration"
            code={`! NTP Configuration for {{ nautobot.name }}
clock timezone {{ user_variables.timezone | default("UTC") }} 0

{% for ntp_server in user_variables.ntp_servers.split(",") %}
ntp server {{ ntp_server | trim }}
{% endfor %}

ntp update-calendar`}
          />
        </div>
      </div>
    </div>
  )
}
