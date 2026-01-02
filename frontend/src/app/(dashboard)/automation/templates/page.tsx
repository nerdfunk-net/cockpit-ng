'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useApi } from '@/hooks/use-api'
import { useAuthStore } from '@/lib/auth-store'
import { FileCode, Plus, Edit, Trash2, Eye, Search, RefreshCw, User, Calendar, Globe, Lock, Terminal, Key, ChevronDown, ChevronUp, HelpCircle, BookOpen, Copy, Check } from 'lucide-react'

// Import Netmiko components and hooks for template editing
import { useVariableManager } from '@/components/features/network/automation/netmiko/hooks/use-variable-manager'
import { VariableManagerPanel } from '@/components/features/network/automation/netmiko/components/variable-manager-panel'
import { TemplateRenderResultDialog, type TemplateRenderResult } from '@/components/features/network/automation/netmiko/dialogs/template-render-result-dialog'
import { NautobotDataDialog } from '@/components/features/network/automation/netmiko/dialogs/nautobot-data-dialog'

interface Template {
  id: number
  name: string
  description: string
  content: string
  scope: 'global' | 'private'
  variables?: Record<string, string>
  use_nautobot_context?: boolean
  pre_run_command?: string
  created_by?: string
  category: string
  template_type: string
  source: string
  updated_at: string
}

// DeviceSearchResult interface for device selection in Create Template tab
interface DeviceSearchResult {
  id: string
  name: string
  primary_ip4?: { address: string } | string
  location?: { name: string }
}

// Code example component with copy functionality
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

// Help and Examples content component
function HelpAndExamplesContent() {
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
              <h4 className="font-semibold text-blue-800 mb-2">📋 Nautobot Integration</h4>
              <p className="text-sm text-blue-700">
                Access device information like hostname, IP addresses, interfaces, and custom fields directly from Nautobot.
              </p>
            </div>
            <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
              <h4 className="font-semibold text-amber-800 mb-2">⚡ Pre-run Commands</h4>
              <p className="text-sm text-amber-700">
                Execute commands on devices before rendering. Output is parsed with TextFSM and available as variables.
              </p>
            </div>
            <div className="p-4 bg-green-50 rounded-lg border border-green-200">
              <h4 className="font-semibold text-green-800 mb-2">🔧 Custom Variables</h4>
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
              <h4 className="font-semibold text-gray-800 border-b pb-2">✅ Do</h4>
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
              <h4 className="font-semibold text-gray-800 border-b pb-2">❌ Avoid</h4>
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
            <h4 className="font-semibold text-blue-800 mb-2">💡 Pro Tip: Whitespace Control</h4>
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

function UserTemplatesContent() {
  const { apiCall } = useApi()
  const user = useAuthStore((state) => state.user)
  const username = user?.username
  const permissions = typeof user?.permissions === 'number' ? user.permissions : 0
  const isAdmin = (permissions & 16) !== 0 // Check admin permission bit

  // State
  const [templates, setTemplates] = useState<Template[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('list')
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null)
  const [message, setMessage] = useState('')
  const [viewingTemplate, setViewingTemplate] = useState<Template | null>(null)
  const [showViewDialog, setShowViewDialog] = useState(false)

  // Form state - Default scope based on admin status
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    content: '',
    scope: (isAdmin ? 'global' : 'private') as 'global' | 'private'
  })

  // Use variable manager for template variables
  const variableManager = useVariableManager()

  // Device search state for Create Template tab
  const [deviceSearchTerm, setDeviceSearchTerm] = useState('')
  const [devices, setDevices] = useState<DeviceSearchResult[]>([])
  const [isLoadingDevices, setIsLoadingDevices] = useState(false)
  const [showDeviceDropdown, setShowDeviceDropdown] = useState(false)
  const [selectedDevice, setSelectedDevice] = useState<DeviceSearchResult | null>(null)

  // Dialog state for Nautobot data
  const [showNautobotDataDialog, setShowNautobotDataDialog] = useState(false)
  const [nautobotData, setNautobotData] = useState<Record<string, unknown> | null>(null)

  // Template rendering state
  const [isRenderingTemplate, setIsRenderingTemplate] = useState(false)
  const [showRenderResultDialog, setShowRenderResultDialog] = useState(false)
  const [renderResult, setRenderResult] = useState<TemplateRenderResult | null>(null)

  // Pre-run command state
  const [preRunCommand, setPreRunCommand] = useState('')
  const [selectedCredentialId, setSelectedCredentialId] = useState<number | null>(null)
  const [storedCredentials, setStoredCredentials] = useState<Array<{ id: number; name: string; username: string }>>([])
  const [isPreRunPanelExpanded, setIsPreRunPanelExpanded] = useState(false)

  useEffect(() => {
    loadTemplates()
    loadCredentials()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadTemplates = async () => {
    setLoading(true)
    try {
      const response = await apiCall<{ templates: Template[] }>('templates?category=netmiko')
      setTemplates(response.templates || [])
    } catch (error) {
      console.error('Error loading templates:', error)
      showMessage('Failed to load templates')
    } finally {
      setLoading(false)
    }
  }

  const loadCredentials = async () => {
    try {
      const response = await apiCall<Array<{ id: number; name: string; username: string; type: string }>>('credentials?include_expired=false')
      // Filter for SSH credentials only
      const sshCredentials = response.filter(cred => cred.type === 'ssh')
      setStoredCredentials(sshCredentials)
    } catch (error) {
      console.error('Error loading credentials:', error)
      setStoredCredentials([])
    }
  }

  const showMessage = (msg: string) => {
    setMessage(msg)
    setTimeout(() => setMessage(''), 5000)
  }

  const handleFormChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      content: '',
      scope: isAdmin ? 'global' : 'private'
    })
    // Reset variables to one empty variable
    variableManager.setVariables([{ id: crypto.randomUUID(), name: '', value: '' }])
    variableManager.setUseNautobotContext(false)
    // Reset device selection
    setSelectedDevice(null)
    setDeviceSearchTerm('')
    setEditingTemplate(null)
    // Reset pre-run command
    setPreRunCommand('')
    setSelectedCredentialId(null)
    setIsPreRunPanelExpanded(false)
  }

  // Load devices when search term changes (min 3 chars)
  useEffect(() => {
    const loadDevices = async () => {
      // Don't load if search is too short
      if (deviceSearchTerm.length < 3) {
        setDevices([])
        setShowDeviceDropdown(false)
        return
      }

      // Don't load if a device is already selected (prevents reopening after selection)
      if (selectedDevice) {
        return
      }

      setIsLoadingDevices(true)
      try {
        const response = await apiCall<{ devices: DeviceSearchResult[] }>(
          `nautobot/devices?filter_type=name__ic&filter_value=${encodeURIComponent(deviceSearchTerm)}`
        )
        setDevices(response.devices || [])
        setShowDeviceDropdown(true)
      } catch (error) {
        console.error('Error loading devices:', error)
        setDevices([])
      } finally {
        setIsLoadingDevices(false)
      }
    }

    const debounceTimer = setTimeout(loadDevices, 300)
    return () => clearTimeout(debounceTimer)
  }, [deviceSearchTerm, apiCall, selectedDevice])

  const handleDeviceSelect = (device: DeviceSearchResult) => {
    setSelectedDevice(device)
    setDeviceSearchTerm(device.name)
    setShowDeviceDropdown(false)
  }

  const handleClearDevice = () => {
    setSelectedDevice(null)
    setDeviceSearchTerm('')
  }

  const handleShowNautobotData = async () => {
    if (!selectedDevice) {
      showMessage('Please select a device first')
      return
    }

    try {
      const response = await apiCall<Record<string, unknown>>(`nautobot/devices/${selectedDevice.id}/details`)
      setNautobotData(response)
      setShowNautobotDataDialog(true)
    } catch (error) {
      console.error('Error fetching Nautobot data:', error)
      showMessage('Error fetching Nautobot data: ' + (error as Error).message)
    }
  }

  const handleRenderTemplate = async () => {
    if (!formData.content.trim()) {
      showMessage('Please enter template content first')
      return
    }

    if (!selectedDevice) {
      showMessage('Please select a device to render the template')
      return
    }

    // If pre-run command is set, credential is required
    if (preRunCommand.trim() && !selectedCredentialId) {
      showMessage('Please select credentials for the pre-run command')
      return
    }

    setIsRenderingTemplate(true)
    const varsObject = variablesToObject()
    
    try {
      const response = await apiCall<{
        rendered_content: string
        variables_used: string[]
        context_data?: Record<string, unknown>
        warnings?: string[]
        pre_run_output?: string
        pre_run_parsed?: Array<Record<string, unknown>>
      }>('templates/render', {
        method: 'POST',
        body: {
          template_content: formData.content,
          category: 'netmiko',
          device_id: selectedDevice.id,
          user_variables: varsObject,
          use_nautobot_context: variableManager.useNautobotContext,
          ...(preRunCommand.trim() && {
            pre_run_command: preRunCommand.trim(),
            credential_id: selectedCredentialId
          })
        }
      })

      // Show result in the enhanced dialog
      setRenderResult({
        success: true,
        rendered_content: response.rendered_content,
        variables_used: response.variables_used,
        context_data: response.context_data,
        warnings: response.warnings
      })
      setShowRenderResultDialog(true)
    } catch (error: unknown) {
      console.error('Error rendering template:', error)

      // Extract error message (apiCall might wrap the error)
      let errorMessage = 'Unknown error'
      let errorDetails: string[] = []
      
      if (error && typeof error === 'object') {
        if ('message' in error && typeof error.message === 'string') {
          errorMessage = error.message
        } else if ('detail' in error && typeof error.detail === 'string') {
          errorMessage = error.detail
        }
        
        // Try to extract more details
        if ('details' in error && Array.isArray(error.details)) {
          errorDetails = error.details
        }
      }

      // Show error in the enhanced dialog instead of just a toast
      setRenderResult({
        success: false,
        error_title: 'Template Rendering Failed',
        error_message: errorMessage,
        error_details: errorDetails.length > 0 ? errorDetails : undefined,
        // Include context data if available (for debugging)
        context_data: {
          user_variables: varsObject,
          use_nautobot_context: variableManager.useNautobotContext,
          device_id: selectedDevice.id
        }
      })
      setShowRenderResultDialog(true)
    } finally {
      setIsRenderingTemplate(false)
    }
  }

  // Helper: Convert variables array to object for backend
  const variablesToObject = (): Record<string, string> => {
    const varsObject: Record<string, string> = {}
    variableManager.variables.forEach(v => {
      if (v.name && variableManager.validateVariableName(v.name)) {
        varsObject[v.name] = v.value
      }
    })
    return varsObject
  }

  // Helper: Convert variables object to array for UI
  const objectToVariables = (obj: Record<string, string> | undefined) => {
    if (!obj || Object.keys(obj).length === 0) {
      return [{ id: crypto.randomUUID(), name: '', value: '' }]
    }
    return Object.entries(obj).map(([name, value]) => ({
      id: crypto.randomUUID(),
      name,
      value
    }))
  }

  const handleCreateTemplate = async () => {
    if (!formData.name.trim() || !formData.content.trim()) {
      showMessage('Please fill in name and content')
      return
    }

    try {
      const templateData = {
        name: formData.name,
        source: 'webeditor',
        template_type: 'jinja2',
        category: 'netmiko',
        description: formData.description,
        content: formData.content,
        scope: formData.scope,
        variables: variablesToObject(),
        use_nautobot_context: variableManager.useNautobotContext,
        pre_run_command: preRunCommand || undefined
      }

      await apiCall('templates', {
        method: 'POST',
        body: templateData
      })

      showMessage('Template created successfully!')
      resetForm()
      setActiveTab('list')
      await loadTemplates()
    } catch (error) {
      console.error('Error creating template:', error)
      showMessage('Failed to create template: ' + (error as Error).message)
    }
  }

  const handleUpdateTemplate = async () => {
    if (!editingTemplate) return

    try {
      await apiCall(`templates/${editingTemplate.id}`, {
        method: 'PUT',
        body: {
          name: formData.name,
          description: formData.description,
          content: formData.content,
          scope: formData.scope,
          variables: variablesToObject(),
          use_nautobot_context: variableManager.useNautobotContext,
          pre_run_command: preRunCommand || undefined
        }
      })

      showMessage('Template updated successfully!')
      resetForm()
      setActiveTab('list')
      await loadTemplates()
    } catch (error) {
      console.error('Error updating template:', error)
      showMessage('Failed to update template: ' + (error as Error).message)
    }
  }

  const handleEditTemplate = async (template: Template) => {
    try {
      // Load full template content
      const response = await apiCall<Template>(`templates/${template.id}`)

      setFormData({
        name: response.name,
        description: response.description || '',
        content: response.content || '',
        scope: response.scope || 'global'
      })
      // Load variables into variable manager
      variableManager.setVariables(objectToVariables(response.variables))
      variableManager.setUseNautobotContext(response.use_nautobot_context || false)

      // Load pre-run command if present
      setPreRunCommand(response.pre_run_command || '')
      // Expand the panel if there's a saved pre-run command
      if (response.pre_run_command) {
        setIsPreRunPanelExpanded(true)
      }

      setEditingTemplate(template)
      setActiveTab('create')
    } catch (error) {
      console.error('Error loading template:', error)
      showMessage('Failed to load template for editing')
    }
  }

  const handleDeleteTemplate = async (templateId: number) => {
    if (!confirm('Are you sure you want to delete this template?')) return

    try {
      await apiCall(`templates/${templateId}`, {
        method: 'DELETE'
      })

      showMessage('Template deleted successfully!')
      await loadTemplates()
    } catch (error) {
      console.error('Error deleting template:', error)
      showMessage('Failed to delete template: ' + (error as Error).message)
    }
  }

  const handleViewTemplate = async (templateId: number) => {
    try {
      const response = await apiCall<Template>(`templates/${templateId}`)
      setViewingTemplate(response)
      setShowViewDialog(true)
    } catch (error) {
      console.error('Error viewing template:', error)
      showMessage('Failed to view template')
    }
  }

  // Check if user can edit a template (only their own templates)
  const canEditTemplate = (template: Template): boolean => {
    return template.created_by === username
  }

  const filteredTemplates = templates.filter(t =>
    t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.description?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-gray-200 pb-4">
        <div className="flex items-center space-x-3">
          <div className="bg-blue-100 p-2 rounded-lg">
            <FileCode className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Netmiko Templates</h1>
            <p className="text-gray-600 mt-1">Create and manage your Jinja2 templates for network automation</p>
          </div>
        </div>
      </div>

      {/* Status Message */}
      {message && (
        <div className={`p-4 rounded-lg border ${
          message.includes('success')
            ? 'bg-green-50 border-green-200 text-green-800'
            : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          {message}
        </div>
      )}

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="list">My Templates</TabsTrigger>
          <TabsTrigger value="create">{editingTemplate ? 'Edit Template' : 'Create Template'}</TabsTrigger>
          <TabsTrigger value="help">Help & Examples</TabsTrigger>
        </TabsList>

        {/* List Tab */}
        <TabsContent value="list" className="space-y-4">
          <div className="shadow-lg border-0 p-0 bg-white rounded-lg">
            <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4 flex items-center justify-between rounded-t-lg">
              <div className="flex items-center space-x-2">
                <FileCode className="h-4 w-4" />
                <span className="text-sm font-medium">Templates</span>
              </div>
            </div>
            <div className="p-6 bg-gradient-to-b from-white to-gray-50">
              {/* Search */}
              <div className="mb-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    placeholder="Search templates..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              {/* Templates List */}
              <div className="space-y-3">
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <RefreshCw className="h-6 w-6 animate-spin text-blue-600" />
                    <span className="ml-2 text-gray-600">Loading templates...</span>
                  </div>
                ) : filteredTemplates.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    No templates found. Create your first template!
                  </div>
                ) : (
                  filteredTemplates.map(template => (
                    <Card key={template.id} className="hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h3 className="font-semibold text-lg">{template.name}</h3>
                              <Badge variant={template.scope === 'global' ? 'default' : 'outline'}>
                                {template.scope}
                              </Badge>
                            </div>
                            {template.description && (
                              <p className="text-sm text-gray-600 mb-2">{template.description}</p>
                            )}
                            <p className="text-xs text-gray-500">
                              Updated: {new Date(template.updated_at).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleViewTemplate(template.id)}
                              title="View"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {canEditTemplate(template) && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleEditTemplate(template)}
                                title="Edit"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            )}
                            {canEditTemplate(template) && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleDeleteTemplate(template.id)}
                                title="Delete"
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Create/Edit Tab */}
        <TabsContent value="create" className="space-y-4">
          <div className="shadow-lg border-0 p-0 bg-white rounded-lg">
            <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4 flex items-center justify-between rounded-t-lg">
              <div className="flex items-center space-x-2">
                {editingTemplate ? <Edit className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                <span className="text-sm font-medium">
                  {editingTemplate ? 'Edit Template' : 'Create Template'}
                </span>
              </div>
            </div>
            <div className="p-6 bg-gradient-to-b from-white to-gray-50 space-y-4">
              {/* Name */}
              <div className="space-y-2">
                <Label htmlFor="name">Template Name *</Label>
                <Input
                  id="name"
                  placeholder="e.g., interface-configuration"
                  value={formData.name}
                  onChange={(e) => handleFormChange('name', e.target.value)}
                  className="border-2 border-slate-300 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 shadow-sm"
                />
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  placeholder="Brief description of this template"
                  value={formData.description}
                  onChange={(e) => handleFormChange('description', e.target.value)}
                  className="border-2 border-slate-300 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 shadow-sm"
                />
              </div>

              {/* Run before Template Panel - Collapsible */}
              <div className="border-2 border-slate-200 rounded-lg overflow-hidden">
                <button
                  type="button"
                  onClick={() => setIsPreRunPanelExpanded(!isPreRunPanelExpanded)}
                  className="w-full bg-gradient-to-r from-slate-100 to-slate-200 hover:from-slate-200 hover:to-slate-300 text-slate-700 py-2 px-4 flex items-center justify-between transition-colors"
                >
                  <div className="flex items-center space-x-2">
                    <Terminal className="h-4 w-4 text-slate-600" />
                    <span className="text-sm font-medium">Run before Template (Optional)</span>
                    {preRunCommand.trim() && (
                      <Badge variant="secondary" className="ml-2 bg-slate-300 text-slate-700 text-xs">
                        Command set
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500 hidden sm:inline">
                      Execute a command and use output in template
                    </span>
                    {isPreRunPanelExpanded ? (
                      <ChevronUp className="h-4 w-4 text-slate-500" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-slate-500" />
                    )}
                  </div>
                </button>
                {isPreRunPanelExpanded && (
                  <div className="p-4 bg-slate-50 space-y-4 border-t border-slate-200">
                    <p className="text-sm text-slate-600">
                      Run a command on the device before rendering. The output is available as{' '}
                      <code className="bg-slate-200 px-1 rounded text-slate-800">{'{{ pre_run_output }}'}</code> (raw) and{' '}
                      <code className="bg-slate-200 px-1 rounded text-slate-800">{'{{ pre_run_parsed }}'}</code> (TextFSM parsed).
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="pre-run-command">Command</Label>
                        <Input
                          id="pre-run-command"
                          placeholder="e.g., show interfaces status"
                          value={preRunCommand}
                          onChange={(e) => setPreRunCommand(e.target.value)}
                          className="border-2 border-slate-300 bg-white focus:border-slate-500 focus:ring-2 focus:ring-slate-200 shadow-sm"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="pre-run-credential">Credentials {preRunCommand.trim() && '*'}</Label>
                        <Select
                          value={selectedCredentialId?.toString() ?? ''}
                          onValueChange={(value) => setSelectedCredentialId(value ? parseInt(value, 10) : null)}
                        >
                          <SelectTrigger className={`border-2 bg-white shadow-sm ${preRunCommand.trim() ? 'border-slate-400' : 'border-slate-300'} focus:border-slate-500 focus:ring-2 focus:ring-slate-200`}>
                            <SelectValue placeholder="Select credentials..." />
                          </SelectTrigger>
                          <SelectContent>
                            {storedCredentials.map((cred) => (
                              <SelectItem key={cred.id} value={cred.id.toString()}>
                                <div className="flex items-center gap-2">
                                  <Key className="h-3 w-3 text-slate-600" />
                                  {cred.name} ({cred.username})
                                </div>
                              </SelectItem>
                            ))}
                            {storedCredentials.length === 0 && (
                              <div className="px-2 py-1 text-sm text-gray-500">No SSH credentials found</div>
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    {preRunCommand.trim() && !selectedCredentialId && (
                      <p className="text-xs text-slate-600">
                        ⚠️ Credentials required to execute pre-run command
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Template Content */}
              <div className="space-y-2">
                <Label htmlFor="content">Template Content (Jinja2) *</Label>
                <Textarea
                  id="content"
                  placeholder="Enter your Jinja2 template here...&#10;&#10;Example:&#10;interface {{ user_variables.interface_name }}&#10; description {{ nautobot.name }}"
                  value={formData.content}
                  onChange={(e) => handleFormChange('content', e.target.value)}
                  rows={15}
                  className="font-mono text-sm border-2 border-slate-300 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 shadow-sm"
                />
                <p className="text-xs text-gray-500">
                  Use <code className="bg-gray-100 px-1 rounded">{'{{ user_variables.var_name }}'}</code> for user variables
                  and <code className="bg-gray-100 px-1 rounded">{'{{ nautobot.field }}'}</code> for device data
                </p>
              </div>

              {/* Template Variables Panel */}
              <VariableManagerPanel
                variables={variableManager.variables}
                useNautobotContext={variableManager.useNautobotContext}
                setUseNautobotContext={variableManager.setUseNautobotContext}
                addVariable={variableManager.addVariable}
                removeVariable={variableManager.removeVariable}
                updateVariable={variableManager.updateVariable}
                validateVariableName={variableManager.validateVariableName}
              />

              {/* Device Selection for Nautobot Data Preview - Testing Section */}
              <div className="space-y-2 p-4 bg-amber-50 border-2 border-amber-200 rounded-lg">
                <div className="flex items-center justify-between">
                  <Label htmlFor="device-search" className="text-sm font-medium text-amber-900">
                    Device (Optional - for previewing Nautobot data)
                  </Label>
                  {selectedDevice && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={handleShowNautobotData}
                      className="h-7 text-xs"
                    >
                      <Eye className="h-3 w-3 mr-1" />
                      Show Nautobot Data
                    </Button>
                  )}
                </div>
                <div className="relative">
                  <Input
                    id="device-search"
                    placeholder="Type at least 3 characters to search devices..."
                    value={deviceSearchTerm}
                    onChange={(e) => setDeviceSearchTerm(e.target.value)}
                    className="border-2 border-slate-300 bg-white focus:border-blue-500"
                  />
                  {isLoadingDevices && (
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                      <RefreshCw className="h-4 w-4 animate-spin text-gray-400" />
                    </div>
                  )}

                  {showDeviceDropdown && devices.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border-2 border-blue-300 rounded-md shadow-lg max-h-60 overflow-auto">
                      {devices.map(device => (
                        <button
                          key={device.id}
                          type="button"
                          onClick={() => handleDeviceSelect(device)}
                          className="w-full px-4 py-2 text-left hover:bg-blue-50 transition-colors border-b last:border-b-0"
                        >
                          <div className="font-medium text-sm">{device.name}</div>
                          {device.primary_ip4 && (
                            <div className="text-xs text-gray-500">
                              {typeof device.primary_ip4 === 'object' ? device.primary_ip4.address : device.primary_ip4}
                              {device.location && ` • ${device.location.name}`}
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  )}

                  {showDeviceDropdown && devices.length === 0 && deviceSearchTerm.length >= 3 && !isLoadingDevices && (
                    <div className="absolute z-10 w-full mt-1 bg-white border-2 border-gray-300 rounded-md shadow-lg px-4 py-2 text-sm text-gray-500">
                      No devices found matching &quot;{deviceSearchTerm}&quot;
                    </div>
                  )}
                </div>

                {selectedDevice && (
                  <div className="p-3 bg-white border-2 border-amber-300 rounded-md">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-sm text-amber-900">{selectedDevice.name}</div>
                        {selectedDevice.primary_ip4 && (
                          <div className="text-xs text-amber-700">
                            {typeof selectedDevice.primary_ip4 === 'object'
                              ? selectedDevice.primary_ip4.address
                              : selectedDevice.primary_ip4}
                            {selectedDevice.location && ` • ${selectedDevice.location.name}`}
                          </div>
                        )}
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleClearDevice}
                        className="text-amber-600 hover:text-amber-800 h-7 text-xs"
                      >
                        Clear
                      </Button>
                    </div>
                  </div>
                )}

                {/* Test Template Button - Inside Testing Section */}
                <div className="pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleRenderTemplate}
                    disabled={!formData.content.trim() || !selectedDevice || isRenderingTemplate}
                    className="w-full border-2 border-amber-600 text-amber-800 hover:bg-amber-600 hover:text-white font-semibold"
                  >
                    {isRenderingTemplate ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Testing...
                      </>
                    ) : (
                      <>
                        <Eye className="h-4 w-4 mr-2" />
                        Test Template
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {/* Scope - Only show for admin users */}
              {isAdmin && (
                <div className="flex items-center space-x-2 p-4 bg-blue-50 border-2 border-blue-200 rounded-lg">
                  <Checkbox
                    id="scope"
                    checked={formData.scope === 'global'}
                    onCheckedChange={(checked) => handleFormChange('scope', checked ? 'global' : 'private')}
                  />
                  <div className="flex-1">
                    <label htmlFor="scope" className="text-sm font-medium cursor-pointer text-blue-900">
                      Make this template global
                    </label>
                    <p className="text-xs text-blue-700 mt-1">
                      Global templates are visible to all users. Uncheck to keep it private (visible only to you).
                    </p>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-4">
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={() => {
                      resetForm()
                      setActiveTab('list')
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={editingTemplate ? handleUpdateTemplate : handleCreateTemplate}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {editingTemplate ? 'Update Template' : 'Create Template'}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Help & Examples Tab */}
        <TabsContent value="help" className="space-y-6">
          <HelpAndExamplesContent />
        </TabsContent>
      </Tabs>

      {/* View Template Dialog */}
      <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <FileCode className="h-6 w-6 text-blue-600" />
              {viewingTemplate?.name}
            </DialogTitle>
            <DialogDescription>
              Template details and content
            </DialogDescription>
          </DialogHeader>

          {viewingTemplate && (
            <div className="space-y-4">
              {/* Metadata Section - Compact */}
              <div className="grid grid-cols-4 gap-3">
                <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg border text-sm">
                  {viewingTemplate.scope === 'global' ? (
                    <>
                      <Globe className="h-4 w-4 text-blue-600 flex-shrink-0" />
                      <Badge variant="default" className="text-xs">Global</Badge>
                    </>
                  ) : (
                    <>
                      <Lock className="h-4 w-4 text-purple-600 flex-shrink-0" />
                      <Badge variant="outline" className="text-xs">Private</Badge>
                    </>
                  )}
                </div>

                <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg border text-sm">
                  <User className="h-4 w-4 text-gray-600 flex-shrink-0" />
                  <span className="text-gray-700 truncate">{viewingTemplate.created_by || 'Unknown'}</span>
                </div>

                <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg border text-sm">
                  <Calendar className="h-4 w-4 text-gray-600 flex-shrink-0" />
                  <span className="text-gray-700 truncate">
                    {new Date(viewingTemplate.updated_at).toLocaleDateString()}
                  </span>
                </div>

                <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg border text-sm">
                  <FileCode className="h-4 w-4 text-gray-600 flex-shrink-0" />
                  <span className="text-gray-700 truncate">{viewingTemplate.template_type}</span>
                </div>
              </div>

              {/* Description - Compact */}
              {viewingTemplate.description && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-gray-700">{viewingTemplate.description}</p>
                </div>
              )}

              {/* Template Content - Larger */}
              <Card className="flex-1">
                <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 py-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileCode className="h-4 w-4" />
                    Template Content
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="bg-gray-900 rounded-lg p-4 overflow-auto max-h-[500px]">
                    <pre className="text-sm text-green-400 font-mono whitespace-pre-wrap">
                      {viewingTemplate.content}
                    </pre>
                  </div>
                  <div className="mt-3 p-2 bg-blue-50 border border-blue-200 rounded-md">
                    <p className="text-xs text-blue-800">
                      <strong>Tip:</strong> Use{' '}
                      <code className="bg-blue-100 px-1 rounded">{'{{ user_variables.var_name }}'}</code> for
                      custom variables and{' '}
                      <code className="bg-blue-100 px-1 rounded">{'{{ nautobot.field }}'}</code> for device data
                      from Nautobot.
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Actions */}
              <div className="flex justify-end gap-3">
                {canEditTemplate(viewingTemplate) && (
                  <Button
                    onClick={() => {
                      setShowViewDialog(false)
                      handleEditTemplate(viewingTemplate)
                    }}
                    variant="outline"
                    className="gap-2"
                  >
                    <Edit className="h-4 w-4" />
                    Edit Template
                  </Button>
                )}
                <Button onClick={() => setShowViewDialog(false)}>
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Nautobot Data Dialog */}
      <NautobotDataDialog
        open={showNautobotDataDialog}
        onOpenChange={(open) => setShowNautobotDataDialog(open)}
        nautobotData={nautobotData}
      />

      {/* Template Render Result Dialog */}
      <TemplateRenderResultDialog
        open={showRenderResultDialog}
        onOpenChange={(open) => setShowRenderResultDialog(open)}
        result={renderResult}
      />
    </div>
  )
}

export default function UserTemplatesPage() {
  return <UserTemplatesContent />
}
