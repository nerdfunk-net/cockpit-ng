'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  FileCode,
  Terminal,
  Globe,
  HelpCircle,
  BookOpen,
  Copy,
  Check,
  Server,
  Settings,
  Database,
} from 'lucide-react'

interface TemplateEditorHelpDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

function CodeExample({
  title,
  code,
  language = 'jinja2',
}: {
  title: string
  code: string
  language?: string
}) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="rounded-lg border border-slate-200 overflow-hidden">
      <div className="flex items-center justify-between bg-slate-100 px-4 py-2 border-b border-slate-200">
        <span className="text-sm font-medium text-slate-700">{title}</span>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            {language}
          </Badge>
          <Button variant="ghost" size="sm" onClick={handleCopy} className="h-7 px-2">
            {copied ? (
              <Check className="h-3.5 w-3.5 text-green-600" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
      </div>
      <pre className="bg-slate-900 text-green-400 p-4 text-sm font-mono overflow-x-auto whitespace-pre-wrap">
        {code}
      </pre>
    </div>
  )
}

function GeneralTab() {
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

function NetmikoTab() {
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

function AgentTab() {
  return (
    <div className="space-y-6">
      {/* Introduction */}
      <div className="shadow-lg border-0 p-0 bg-white rounded-lg overflow-hidden">
        <div className="bg-gradient-to-r from-indigo-50 to-purple-50 py-2 px-4 border-b">
          <div className="flex items-center gap-2 text-lg font-semibold">
            <Server className="h-5 w-5 text-indigo-600" />
            <span>Agent Templates Overview</span>
          </div>
        </div>
        <div className="p-6 space-y-4">
          <p className="text-gray-700">
            Agent templates are designed for deploying configuration files to remote agents. These templates
            leverage <strong>Jinja2</strong> syntax and can access inventory data, SNMP mappings, and device
            details from Nautobot to generate configuration files tailored to specific devices or environments.
          </p>
          <div className="grid md:grid-cols-3 gap-4 mt-4">
            <div className="p-4 bg-indigo-50 rounded-lg border border-indigo-200">
              <h4 className="font-semibold text-indigo-800 mb-2">Inventory Integration</h4>
              <p className="text-sm text-indigo-700">
                Select an inventory to access device lists and detailed device information for template rendering.
              </p>
            </div>
            <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
              <h4 className="font-semibold text-purple-800 mb-2">SNMP Mappings</h4>
              <p className="text-sm text-purple-700">
                Automatically include SNMP OID mappings for network monitoring and device discovery.
              </p>
            </div>
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <h4 className="font-semibold text-blue-800 mb-2">File Path Support</h4>
              <p className="text-sm text-blue-700">
                Specify the destination file path where the rendered template will be deployed on the agent.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Available Variables */}
      <div className="shadow-lg border-0 p-0 bg-white rounded-lg overflow-hidden">
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 py-2 px-4 border-b">
          <div className="flex items-center gap-2 text-lg font-semibold">
            <Database className="h-5 w-5 text-blue-600" />
            <span>Available System Variables</span>
          </div>
        </div>
        <div className="p-6 space-y-6">
          <p className="text-gray-600 text-sm">
            Agent templates have access to multiple variable sources including inventory data, custom variables, and YAML files:
          </p>

          <div className="space-y-4">
            <h4 className="font-semibold text-gray-800">Custom Variables & YAML Files</h4>
            <p className="text-gray-600 text-sm">
              Just like Netmiko templates, you can define custom variables and load YAML files:
            </p>
            <div className="grid md:grid-cols-2 gap-3 text-sm">
              <div className="p-3 bg-green-50 rounded-lg border">
                <code className="text-green-600">{'{{ custom_var }}'}</code>
                <p className="text-xs text-gray-500 mt-1">Your own custom variables</p>
              </div>
              <div className="p-3 bg-amber-50 rounded-lg border">
                <code className="text-amber-600">{'{{ yaml_data.config }}'}</code>
                <p className="text-xs text-gray-500 mt-1">Data loaded from YAML files</p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="font-semibold text-gray-800">Inventory Variables</h4>
            <p className="text-gray-600 text-sm">
              When an inventory is selected, device information becomes available:
            </p>
            <div className="grid md:grid-cols-2 gap-3 text-sm">
              <div className="p-3 bg-blue-50 rounded-lg border">
                <code className="text-blue-600">{'{{ devices }}'}</code>
                <p className="text-xs text-gray-500 mt-1">List of all devices in the inventory</p>
              </div>
              <div className="p-3 bg-blue-50 rounded-lg border">
                <code className="text-blue-600">{'{{ device_details }}'}</code>
                <p className="text-xs text-gray-500 mt-1">Detailed information for devices (when Use Nautobot Context is enabled)</p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="font-semibold text-gray-800">SNMP Mapping Variable</h4>
            <p className="text-gray-600 text-sm">
              When &quot;Pass SNMP Mapping&quot; is enabled:
            </p>
            <div className="p-3 bg-purple-50 rounded-lg border">
              <code className="text-blue-600">{'{{ snmp_mapping }}'}</code>
              <p className="text-xs text-gray-500 mt-1">
                Dictionary containing SNMP OID mappings for device types and monitoring
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="font-semibold text-gray-800">Path Variable</h4>
            <p className="text-gray-600 text-sm">
              The file path specified in the template options:
            </p>
            <div className="p-3 bg-green-50 rounded-lg border">
              <code className="text-blue-600">{'{{ path }}'}</code>
              <p className="text-xs text-gray-500 mt-1">
                Destination file path for the rendered configuration
              </p>
            </div>
          </div>

          <CodeExample
            title="Example: Device List Structure"
            code={`{# devices variable contains: #}
[
  {
    "id": 123,
    "name": "router-01",
    "primary_ip4": "192.168.1.1"
  },
  {
    "id": 124,
    "name": "switch-01",
    "primary_ip4": "192.168.1.2"
  }
]`}
          />
        </div>
      </div>

      {/* Device Details */}
      <div className="shadow-lg border-0 p-0 bg-white rounded-lg overflow-hidden">
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 py-2 px-4 border-b">
          <div className="flex items-center gap-2 text-lg font-semibold">
            <Globe className="h-5 w-5 text-green-600" />
            <span>Device Details (Nautobot Context)</span>
          </div>
        </div>
        <div className="p-6 space-y-6">
          <p className="text-gray-600 text-sm">
            When &quot;Use Nautobot Context&quot; is enabled, the <code className="bg-gray-100 px-1 rounded">device_details</code> variable
            contains comprehensive device information from Nautobot, including interfaces, custom fields, and more.
          </p>

          <div className="space-y-4">
            <h4 className="font-semibold text-gray-800">Common Device Detail Fields</h4>
            <div className="grid md:grid-cols-2 gap-3 text-sm">
              <div className="space-y-2">
                <div className="p-2 bg-green-50 rounded border border-green-200">
                  <code>device_details.name</code> - Hostname
                </div>
                <div className="p-2 bg-green-50 rounded border border-green-200">
                  <code>device_details.primary_ip4</code> - Primary IPv4
                </div>
                <div className="p-2 bg-green-50 rounded border border-green-200">
                  <code>device_details.platform.name</code> - Platform
                </div>
                <div className="p-2 bg-green-50 rounded border border-green-200">
                  <code>device_details.location.name</code> - Location
                </div>
              </div>
              <div className="space-y-2">
                <div className="p-2 bg-green-50 rounded border border-green-200">
                  <code>device_details.role.name</code> - Device role
                </div>
                <div className="p-2 bg-green-50 rounded border border-green-200">
                  <code>device_details.interfaces</code> - Interface list
                </div>
                <div className="p-2 bg-green-50 rounded border border-green-200">
                  <code>device_details.custom_fields</code> - Custom data
                </div>
                <div className="p-2 bg-green-50 rounded border border-green-200">
                  <code>device_details.serial</code> - Serial number
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Examples */}
      <div className="shadow-lg border-0 p-0 bg-white rounded-lg overflow-hidden">
        <div className="bg-gradient-to-r from-violet-50 to-purple-50 py-2 px-4 border-b">
          <div className="flex items-center gap-2 text-lg font-semibold">
            <FileCode className="h-5 w-5 text-violet-600" />
            <span>Agent Template Examples</span>
          </div>
        </div>
        <div className="p-6 space-y-6">
          <CodeExample
            title="Generate Inventory File"
            code={`# Generated inventory file
# Path: {{ path }}
# Device count: {{ devices | length }}

{% for device in devices %}
[{{ device.name }}]
host={{ device.primary_ip4 }}
id={{ device.id }}
{% endfor %}`}
          />

          <CodeExample
            title="Monitoring Configuration with SNMP Mappings"
            code={`# Monitoring configuration
# Generated from inventory

{% for device in devices %}
device:
  name: {{ device.name }}
  ip: {{ device.primary_ip4 }}
  {% if snmp_mapping %}
  snmp_community: {{ user_variables.snmp_community | default("public") }}
  {% endif %}
{% endfor %}

{% if snmp_mapping %}
# SNMP OID Mappings
snmp_oids:
{% for vendor, oids in snmp_mapping.items() %}
  {{ vendor }}:
{% for oid_name, oid_value in oids.items() %}
    {{ oid_name }}: {{ oid_value }}
{% endfor %}
{% endfor %}
{% endif %}`}
          />

          <CodeExample
            title="Device Configuration with Nautobot Details"
            code={`# Device-specific configuration
{% if device_details %}
# Device: {{ device_details.name }}
# Location: {{ device_details.location.name }}
# Platform: {{ device_details.platform.name }}

[device]
hostname={{ device_details.name }}
management_ip={{ device_details.primary_ip4.address }}
location={{ device_details.location.name }}
role={{ device_details.role.name }}

# Interfaces
{% for interface in device_details.interfaces %}
{% if interface.enabled %}
[interface.{{ interface.name }}]
name={{ interface.name }}
{% if interface.description %}
description={{ interface.description }}
{% endif %}
{% if interface.ip_addresses %}
{% for ip in interface.ip_addresses %}
ip={{ ip.address }}
{% endfor %}
{% endif %}
{% endif %}
{% endfor %}
{% endif %}`}
          />

          <CodeExample
            title="Multi-Device Configuration File"
            code={`# Multi-device configuration
# Total devices: {{ devices | length }}
# Deployment path: {{ path }}

{% for device in devices %}
# === {{ device.name }} ===
[device_{{ loop.index }}]
name={{ device.name }}
address={{ device.primary_ip4 }}
id={{ device.id }}
sequence={{ loop.index }}

{% endfor %}`}
          />
        </div>
      </div>

      {/* Best Practices */}
      <div className="shadow-lg border-0 p-0 bg-white rounded-lg overflow-hidden">
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 py-2 px-4 border-b">
          <div className="flex items-center gap-2 text-lg font-semibold">
            <HelpCircle className="h-5 w-5 text-amber-600" />
            <span>Agent Template Best Practices</span>
          </div>
        </div>
        <div className="p-6 space-y-4">
          <ul className="space-y-3 text-sm text-gray-600">
            <li className="flex items-start gap-2">
              <span className="text-blue-500 mt-0.5">•</span>
              <span>
                <strong>Select appropriate inventory:</strong> Always choose the correct inventory that contains
                the devices you want to configure.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-500 mt-0.5">•</span>
              <span>
                <strong>Specify file paths:</strong> Provide clear destination paths for where configuration
                files should be deployed on the agent.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-500 mt-0.5">•</span>
              <span>
                <strong>Use Nautobot Context wisely:</strong> Enable this option only when you need detailed
                device information to avoid unnecessary API calls.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-500 mt-0.5">•</span>
              <span>
                <strong>Check for empty lists:</strong> Always verify that device lists are not empty before
                iterating to avoid generating empty configuration files.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-500 mt-0.5">•</span>
              <span>
                <strong>Format output appropriately:</strong> Consider the target system&apos;s configuration
                format (INI, YAML, JSON, etc.) when generating files.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-500 mt-0.5">•</span>
              <span>
                <strong>Test rendering:</strong> Always use the preview function to verify your template
                generates the expected output before deployment.
              </span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  )
}

export function TemplateEditorHelpDialog({
  open,
  onOpenChange,
}: TemplateEditorHelpDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!max-w-[1400px] w-[95vw] max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <HelpCircle className="h-6 w-6 text-purple-600" />
            Template Editor Help
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-6">
          <Tabs defaultValue="general" className="h-full flex flex-col">
            <TabsList className="grid w-full grid-cols-3 mb-4 mt-4 shrink-0">
              <TabsTrigger value="general">General</TabsTrigger>
              <TabsTrigger value="netmiko">Netmiko</TabsTrigger>
              <TabsTrigger value="agent">Agent</TabsTrigger>
            </TabsList>
            <div className="flex-1">
              <TabsContent value="general" className="mt-0">
                <GeneralTab />
              </TabsContent>
              <TabsContent value="netmiko" className="mt-0">
                <NetmikoTab />
              </TabsContent>
              <TabsContent value="agent" className="mt-0">
                <AgentTab />
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  )
}
