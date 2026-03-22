import { FileCode, Globe, HelpCircle, Server, Database } from 'lucide-react'
import { CodeExample } from './code-example'

export function AgentTab() {
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
