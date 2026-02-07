'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { FileCode, Globe, Terminal, HelpCircle, BookOpen, Copy, Check } from 'lucide-react'

function CodeExample({ title, code, language = 'jinja2' }: { title: string; code: string; language?: string }) {
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
          <Badge variant="outline" className="text-xs">{language}</Badge>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopy}
            className="h-7 px-2"
          >
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

export function HelpAndExamplesContent() {
  return (
    <div className="space-y-8">
      {/* Introduction */}
      <div className="shadow-lg border-0 p-0 bg-white rounded-lg overflow-hidden">
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 py-2 px-4 border-b">
          <div className="flex items-center gap-2 text-lg font-semibold">
            <BookOpen className="h-5 w-5 text-blue-600" />
            <span>Template System Overview</span>
          </div>
        </div>
        <div className="p-6 space-y-4">
          <p className="text-gray-700">
            The Template System allows you to create reusable configuration templates using <strong>Jinja2</strong> syntax.
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
              <h4 className="font-semibold text-green-800 mb-2">Custom Variables</h4>
              <p className="text-sm text-green-700">
                Define your own variables that can be filled in when rendering the template.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Jinja2 Basics */}
      <div className="shadow-lg border-0 p-0 bg-white rounded-lg overflow-hidden">
        <div className="bg-gradient-to-r from-slate-50 to-slate-100 py-2 px-4 border-b">
          <div className="flex items-center gap-2 text-lg font-semibold">
            <FileCode className="h-5 w-5 text-slate-600" />
            <span>Jinja2 Template Basics</span>
          </div>
        </div>
        <div className="p-6 space-y-6">
          <div className="space-y-4">
            <h4 className="font-semibold text-gray-800">Variable Syntax</h4>
            <p className="text-gray-600 text-sm">
              Use double curly braces to output variables. Variables are organized into namespaces:
            </p>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="p-3 bg-gray-50 rounded-lg border">
                <code className="text-sm text-blue-600">{'{{ nautobot.hostname }}'}</code>
                <p className="text-xs text-gray-500 mt-1">Data from Nautobot device</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg border">
                <code className="text-sm text-blue-600">{'{{ user_variables.vlan_id }}'}</code>
                <p className="text-xs text-gray-500 mt-1">Custom user-defined variable</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg border">
                <code className="text-sm text-blue-600">{'{{ pre_run.parsed[0].interface }}'}</code>
                <p className="text-xs text-gray-500 mt-1">Parsed output from pre-run command</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg border">
                <code className="text-sm text-blue-600">{'{{ pre_run.raw }}'}</code>
                <p className="text-xs text-gray-500 mt-1">Raw output from pre-run command</p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="font-semibold text-gray-800">Control Structures</h4>
            <div className="grid md:grid-cols-2 gap-4">
              <CodeExample
                title="For Loop"
                code={`{% for interface in nautobot.interfaces %}
interface {{ interface.name }}
 description {{ interface.description }}
{% endfor %}`}
              />
              <CodeExample
                title="Conditional (If/Else)"
                code={`{% if nautobot.primary_ip4 %}
ip address {{ nautobot.primary_ip4.address }}
{% else %}
! No IP configured
{% endif %}`}
              />
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="font-semibold text-gray-800">Filters</h4>
            <p className="text-gray-600 text-sm">
              Jinja2 filters transform values. Use the pipe character (<code>|</code>) to apply them:
            </p>
            <div className="grid md:grid-cols-3 gap-3">
              <div className="p-3 bg-gray-50 rounded-lg border text-sm">
                <code className="text-blue-600">{'{{ name | upper }}'}</code>
                <p className="text-xs text-gray-500 mt-1">Convert to uppercase</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg border text-sm">
                <code className="text-blue-600">{'{{ name | lower }}'}</code>
                <p className="text-xs text-gray-500 mt-1">Convert to lowercase</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg border text-sm">
                <code className="text-blue-600">{'{{ items | length }}'}</code>
                <p className="text-xs text-gray-500 mt-1">Get list length</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg border text-sm">
                <code className="text-blue-600">{'{{ value | default("N/A") }}'}</code>
                <p className="text-xs text-gray-500 mt-1">Default if undefined</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg border text-sm">
                <code className="text-blue-600">{'{{ ip | ipaddr("address") }}'}</code>
                <p className="text-xs text-gray-500 mt-1">Extract IP address</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg border text-sm">
                <code className="text-blue-600">{'{{ list | join(", ") }}'}</code>
                <p className="text-xs text-gray-500 mt-1">Join list items</p>
              </div>
            </div>
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
            When &quot;Use Nautobot Context&quot; is enabled, device information is available under the <code className="bg-gray-100 px-1 rounded">nautobot</code> namespace.
            Select a device when rendering to populate this data.
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
                  <code>nautobot.primary_ip6.address</code> - Primary IPv6
                </div>
                <div className="p-2 bg-blue-50 rounded border border-blue-200">
                  <code>nautobot.platform.name</code> - Platform (e.g., cisco_ios)
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
                  <code>nautobot.tenant.name</code> - Tenant
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
            title="Example: Generate SNMP Configuration from Nautobot"
            code={`! SNMP Configuration for {{ nautobot.name }}
! Location: {{ nautobot.location.name | default("Unknown") }}
! Role: {{ nautobot.role.name | default("Unknown") }}

snmp-server community {{ user_variables.snmp_community }} RO
snmp-server location {{ nautobot.location.name | default("Not Set") }}
snmp-server contact {{ nautobot.tenant.name | default("NOC") }}

{% if nautobot.custom_fields.snmp_trap_server %}
snmp-server host {{ nautobot.custom_fields.snmp_trap_server }} traps
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
            Pre-run commands allow you to execute a command on the device <strong>before</strong> rendering the template.
            The command output is automatically parsed using <strong>TextFSM</strong> (when a parser is available) and
            made available as template variables.
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
! Generated from live device data

{% for intf in pre_run.parsed %}
{% if intf.status == 'down' and intf.protocol == 'down' %}
! Interface {{ intf.interface }} is DOWN - consider shutdown
interface {{ intf.interface }}
 description UNUSED - {{ intf.interface }}
 shutdown
{% endif %}
{% endfor %}`}
          />

          <CodeExample
            title="Example: Document current VLAN configuration"
            code={`{# Pre-run command: show vlan brief #}
! VLAN Documentation for {{ nautobot.name }}
! Exported: {{ now | default("N/A") }}

{% for vlan in pre_run.parsed %}
! VLAN {{ vlan.vlan_id }}: {{ vlan.name }}
!   Status: {{ vlan.status }}
!   Ports: {{ vlan.ports | default("none") }}
{% endfor %}`}
          />
        </div>
      </div>

      {/* Complete Examples */}
      <div className="shadow-lg border-0 p-0 bg-white rounded-lg overflow-hidden">
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 py-2 px-4 border-b">
          <div className="flex items-center gap-2 text-lg font-semibold">
            <FileCode className="h-5 w-5 text-green-600" />
            <span>Complete Template Examples</span>
          </div>
        </div>
        <div className="p-6 space-y-6">
          <CodeExample
            title="Basic Switch Port Configuration"
            code={`! Port Configuration Template
! Device: {{ nautobot.name }}
! Generated for: {{ user_variables.purpose | default("General Use") }}

interface {{ user_variables.interface }}
 description {{ user_variables.description }}
 switchport mode access
 switchport access vlan {{ user_variables.vlan_id }}
 spanning-tree portfast
 no shutdown`}
          />

          <CodeExample
            title="Backup Configuration with Nautobot Metadata"
            code={`! ==========================================
! Configuration Backup
! Device: {{ nautobot.name }}
! Location: {{ nautobot.location.name }}
! Platform: {{ nautobot.platform.name | default("unknown") }}
! Role: {{ nautobot.role.name }}
! Serial: {{ nautobot.serial | default("N/A") }}
! ==========================================

! Management Access
{% if nautobot.primary_ip4 %}
interface Vlan1
 ip address {{ nautobot.primary_ip4.address | ipaddr('address') }} {{ nautobot.primary_ip4.address | ipaddr('netmask') }}
{% endif %}

! Interfaces
{% for intf in nautobot.interfaces %}
{% if intf.enabled %}
interface {{ intf.name }}
{% if intf.description %}
 description {{ intf.description }}
{% endif %}
 no shutdown
{% endif %}
{% endfor %}`}
          />

          <CodeExample
            title="NTP Configuration with Custom Variables"
            code={`! NTP Configuration for {{ nautobot.name }}
! Timezone: {{ user_variables.timezone | default("UTC") }}

clock timezone {{ user_variables.timezone | default("UTC") }} {{ user_variables.utc_offset | default("0") }}

{% for ntp_server in user_variables.ntp_servers.split(",") %}
ntp server {{ ntp_server | trim }}
{% endfor %}

ntp update-calendar
ntp logging`}
          />

          <CodeExample
            title="ACL Generation from Pre-run Data"
            code={`{# Pre-run command: show ip access-lists #}
! Current ACL Audit for {{ nautobot.name }}
! This template documents existing ACLs

{% if pre_run.parsed %}
{% for acl in pre_run.parsed %}
! ACL Name: {{ acl.name }}
! Type: {{ acl.type | default("standard") }}
! Entries: {{ acl.entries | length if acl.entries else 0 }}
!
ip access-list {{ acl.type | default("standard") }} {{ acl.name }}
{% for entry in acl.entries | default([]) %}
 {{ entry.action }} {{ entry.source }} {{ entry.destination | default("") }}
{% endfor %}
!
{% endfor %}
{% else %}
! No ACLs found on device
{% endif %}`}
          />
        </div>
      </div>

      {/* Tips and Best Practices */}
      <div className="shadow-lg border-0 p-0 bg-white rounded-lg overflow-hidden">
        <div className="bg-gradient-to-r from-purple-50 to-violet-50 py-2 px-4 border-b">
          <div className="flex items-center gap-2 text-lg font-semibold">
            <HelpCircle className="h-5 w-5 text-purple-600" />
            <span>Tips & Best Practices</span>
          </div>
        </div>
        <div className="p-6">
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h4 className="font-semibold text-gray-800 border-b pb-2">Do</h4>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">•</span>
                  Use <code className="bg-gray-100 px-1 rounded">| default(&quot;value&quot;)</code> for optional fields
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">•</span>
                  Add comments to explain template sections
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">•</span>
                  Test templates with &quot;Test Template&quot; before deploying
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">•</span>
                  Use descriptive variable names
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">•</span>
                  Check for empty lists before iterating
                </li>
              </ul>
            </div>
            <div className="space-y-4">
              <h4 className="font-semibold text-gray-800 border-b pb-2">Avoid</h4>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-start gap-2">
                  <span className="text-red-500 mt-0.5">•</span>
                  Hardcoding values that should be variables
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-500 mt-0.5">•</span>
                  Assuming fields always exist (use <code>| default</code>)
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-500 mt-0.5">•</span>
                  Storing sensitive data in templates (use credentials)
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-500 mt-0.5">•</span>
                  Creating overly complex nested loops
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-500 mt-0.5">•</span>
                  Ignoring whitespace control (<code>{'{%-'}</code> and <code>{'-%}'}</code>)
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <h4 className="font-semibold text-blue-800 mb-2">Pro Tip: Whitespace Control</h4>
            <p className="text-sm text-blue-700 mb-3">
              Use <code className="bg-blue-100 px-1 rounded">{'{%-'}</code> and <code className="bg-blue-100 px-1 rounded">{'-%}'}</code> to remove
              whitespace before/after template tags:
            </p>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-white p-3 rounded border">
                <p className="text-xs text-gray-500 mb-1">With whitespace issues:</p>
                <pre className="text-xs font-mono text-gray-700">{`{% for i in items %}
{{ i }}
{% endfor %}`}</pre>
              </div>
              <div className="bg-white p-3 rounded border">
                <p className="text-xs text-gray-500 mb-1">Clean output:</p>
                <pre className="text-xs font-mono text-gray-700">{`{%- for i in items %}
{{ i }}
{%- endfor %}`}</pre>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
