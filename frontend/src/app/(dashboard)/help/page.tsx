'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Plus,
  RefreshCw,
  Save,
  List,
  Database,
  FileText,
  GitBranch,
  Zap,
  Key,
  Shield,
  Eye,
  Minus,
  Terminal,
  CheckCircle,
  Search,
  Wrench,
  Server,
  Calendar,
  History,
  Download,
  Wifi,
  Plug,
  Settings,
  Edit,
  Network,
  BookOpen,
  Target,
  Layers,
  FileSpreadsheet,
  Camera,
  Activity,
  GitCommit,
  ArrowLeftRight,
  Monitor,
  ScrollText,
  Home,
} from 'lucide-react'

export default function HelpPage() {
  const scrollToSection = (id: string) => {
    const element = document.getElementById(id)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-slate-900 mb-3">
          Cockpit-NG Help & Documentation
        </h1>
        <p className="text-lg text-slate-600">
          A comprehensive network management dashboard for NetDevOps teams
        </p>
      </div>

      {/* Quick Navigation - Topics */}
      <Card className="mb-8 border-blue-200 bg-blue-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-blue-600" />
            Quick Navigation
          </CardTitle>
          <CardDescription>Jump to a specific topic</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            <button
              onClick={() => scrollToSection('overview')}
              className="text-left px-4 py-2 rounded-lg hover:bg-blue-100 transition-colors text-blue-700 font-medium"
            >
              📋 Overview
            </button>
            <button
              onClick={() => scrollToSection('general')}
              className="text-left px-4 py-2 rounded-lg hover:bg-blue-100 transition-colors text-blue-700 font-medium"
            >
              📦 General
            </button>
            <button
              onClick={() => scrollToSection('nautobot')}
              className="text-left px-4 py-2 rounded-lg hover:bg-blue-100 transition-colors text-blue-700 font-medium"
            >
              🔌 Nautobot Integration
            </button>
            <button
              onClick={() => scrollToSection('checkmk')}
              className="text-left px-4 py-2 rounded-lg hover:bg-blue-100 transition-colors text-blue-700 font-medium"
            >
              🛡️ CheckMK Integration
            </button>
            <button
              onClick={() => scrollToSection('agents')}
              className="text-left px-4 py-2 rounded-lg hover:bg-blue-100 transition-colors text-blue-700 font-medium"
            >
              🤖 Agents
            </button>
            <button
              onClick={() => scrollToSection('network')}
              className="text-left px-4 py-2 rounded-lg hover:bg-blue-100 transition-colors text-blue-700 font-medium"
            >
              🌐 Network Management
            </button>
            <button
              onClick={() => scrollToSection('jobs')}
              className="text-left px-4 py-2 rounded-lg hover:bg-blue-100 transition-colors text-blue-700 font-medium"
            >
              ⚙️ Job Automation
            </button>
            <button
              onClick={() => scrollToSection('settings')}
              className="text-left px-4 py-2 rounded-lg hover:bg-blue-100 transition-colors text-blue-700 font-medium"
            >
              🔧 Settings & Configuration
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Overview Section */}
      <section id="overview" className="mb-12 scroll-mt-6">
        <h2 className="text-3xl font-bold text-slate-900 mb-4 flex items-center gap-2">
          <Target className="h-8 w-8 text-blue-600" />
          Overview
        </h2>
        <Card>
          <CardHeader>
            <CardTitle>What is Cockpit-NG?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-slate-700 leading-relaxed">
              Cockpit-NG is a modern network management dashboard designed specifically for network engineers and NetDevOps teams.
              It provides a comprehensive platform for managing network devices, configurations, and automation workflows with
              seamless integration to industry-standard tools like Nautobot and CheckMK.
            </p>

            <div className="bg-slate-50 p-4 rounded-lg">
              <h3 className="font-semibold text-slate-900 mb-2">Key Features:</h3>
              <ul className="space-y-2 text-slate-700">
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                  <span><strong>Device Management:</strong> Add, onboard, sync, and offboard network devices</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                  <span><strong>Configuration Management:</strong> Backup, view, compare, and track device configuration changes</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                  <span><strong>Network Automation:</strong> Execute commands, manage inventories, and use templates</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                  <span><strong>Job Scheduling:</strong> Automate recurring tasks with flexible scheduling</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                  <span><strong>Compliance Checking:</strong> Monitor device compliance with defined rules</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                  <span><strong>RBAC:</strong> Role-based access control with granular permissions</span>
                </li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* General Section */}
      <section id="general" className="mb-12 scroll-mt-6">
        <h2 className="text-3xl font-bold text-slate-900 mb-4 flex items-center gap-2">
          <List className="h-8 w-8 text-blue-600" />
          General
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Home className="h-5 w-5 text-blue-600" />
                Home
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-700">
                The main dashboard showing a high-level summary of your network environment — connected
                systems status, recent job activity, and quick-access links to frequently used features.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <List className="h-5 w-5 text-blue-600" />
                Inventory
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-700 mb-3">
                Build and manage dynamic inventory for network automation and monitoring:
              </p>
              <ul className="space-y-1 text-sm text-slate-600">
                <li>• Generate Ansible inventory files dynamically from Nautobot</li>
                <li>• Create custom inventory groups using logical conditions</li>
                <li>• Apply filters to select specific devices</li>
                <li>• Export inventory to Git repositories</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ScrollText className="h-5 w-5 text-blue-600" />
                Logs
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-700">
                View application and audit logs. Track user actions, job executions, API calls,
                and system events across all modules for troubleshooting and accountability.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Nautobot Section */}
      <section id="nautobot" className="mb-12 scroll-mt-6">
        <h2 className="text-3xl font-bold text-slate-900 mb-4 flex items-center gap-2">
          <Database className="h-8 w-8 text-blue-600" />
          Nautobot Integration
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5 text-blue-600" />
                Add Device
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-700">
                Manually add individual physical network devices to Nautobot with complete device information including
                location, device type, role, platform, and network interfaces with IP addresses.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Monitor className="h-5 w-5 text-blue-600" />
                Add VM
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-700">
                Add virtual machines to Nautobot. Specify the VM name, cluster, role, platform,
                and assign virtual interfaces with IP addresses.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5 text-green-600" />
                Onboard Device
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-700">
                Streamlined device onboarding process that automatically discovers device information via SSH/SNMP and
                creates entries in Nautobot with minimal manual input.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <RefreshCw className="h-5 w-5 text-blue-600" />
                Sync Devices
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-700">
                Synchronize device data between Nautobot and your network infrastructure. Keep device information
                up-to-date across your entire inventory.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Minus className="h-5 w-5 text-red-600" />
                Offboarding
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-700">
                Safely remove devices from your infrastructure with guided offboarding workflows that ensure
                proper cleanup in Nautobot, CheckMK, and other integrated systems.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wrench className="h-5 w-5 text-orange-600" />
                Tools
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-slate-700">
                <li className="flex items-center gap-2">
                  <Search className="h-4 w-4 text-blue-600" />
                  <span><strong>Check IP & Names:</strong> Verify IP addresses and hostnames exist in Nautobot</span>
                </li>
                <li className="flex items-center gap-2">
                  <Edit className="h-4 w-4 text-blue-600" />
                  <span><strong>Bulk Edit:</strong> Update multiple device fields simultaneously</span>
                </li>
                <li className="flex items-center gap-2">
                  <FileSpreadsheet className="h-4 w-4 text-blue-600" />
                  <span><strong>CSV Updates:</strong> Bulk update device data by importing CSV files</span>
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="h-5 w-5 text-green-600" />
                Export
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-700">
                Export device data and inventory information from Nautobot in various formats for reporting,
                analysis, or integration with other tools.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* CheckMK Section */}
      <section id="checkmk" className="mb-12 scroll-mt-6">
        <h2 className="text-3xl font-bold text-slate-900 mb-4 flex items-center gap-2">
          <Shield className="h-8 w-8 text-blue-600" />
          CheckMK Integration
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <RefreshCw className="h-5 w-5 text-blue-600" />
                Sync Devices
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-700">
                Synchronize devices from Nautobot to CheckMK monitoring. Automatically creates hosts,
                applies monitoring configurations, and activates changes in CheckMK.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ArrowLeftRight className="h-5 w-5 text-purple-600" />
                Diff Viewer
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-700">
                Compare device data between Nautobot and CheckMK side-by-side. Identify discrepancies
                in host configurations, tags, and monitoring attributes before or after a sync.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Server className="h-5 w-5 text-orange-600" />
                Hosts & Inventory
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-700">
                Browse the CheckMK host inventory. View host details, monitoring status, applied tags,
                and attributes for all devices registered in CheckMK.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wrench className="h-5 w-5 text-purple-600" />
                Tools
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-700">
                Additional CheckMK utilities including bulk host operations, tag management,
                and tools for troubleshooting CheckMK integration issues.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Agents Section */}
      <section id="agents" className="mb-12 scroll-mt-6">
        <h2 className="text-3xl font-bold text-slate-900 mb-4 flex items-center gap-2">
          <Activity className="h-8 w-8 text-blue-600" />
          Agents
        </h2>
        <p className="text-slate-600 mb-4">
          Cockpit Agents are lightweight services deployed on remote network segments that execute
          tasks on behalf of the central Cockpit-NG server. They enable automation in environments
          where direct connectivity is limited.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-blue-600" />
                Operating
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-700 mb-3">
                Monitor and manage all deployed Cockpit agents in real time:
              </p>
              <ul className="space-y-1 text-sm text-slate-600">
                <li>• View online/offline status of each agent</li>
                <li>• Trigger a Git pull to update agent configuration</li>
                <li>• Restart agent Docker containers remotely</li>
                <li>• Ping agents to test connectivity</li>
                <li>• View command execution history per agent</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <GitCommit className="h-5 w-5 text-green-600" />
                Deploy
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-700 mb-3">
                Deploy automation tasks to one or more agents using Ansible playbooks:
              </p>
              <ul className="space-y-1 text-sm text-slate-600">
                <li>• Select target devices from Nautobot inventory</li>
                <li>• Choose an agent and Ansible playbook template</li>
                <li>• Override template variables before execution</li>
                <li>• Run a dry-run to preview changes</li>
                <li>• Execute and monitor deployment progress</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-orange-600" />
                Templates
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-700">
                Manage Ansible playbook templates used for agent deployments. Create, edit, and
                organize templates stored in Git repositories that define the tasks agents will execute.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Network Management Section */}
      <section id="network" className="mb-12 scroll-mt-6">
        <h2 className="text-3xl font-bold text-slate-900 mb-4 flex items-center gap-2">
          <Network className="h-8 w-8 text-blue-600" />
          Network Management
        </h2>

        <div className="space-y-6">
          {/* Configs Subsection */}
          <div>
            <h3 className="text-2xl font-semibold text-slate-800 mb-3 flex items-center gap-2">
              <FileText className="h-6 w-6 text-blue-600" />
              Configuration Management
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Eye className="h-5 w-5 text-blue-600" />
                    View Configs
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-slate-700 mb-3">
                    Browse and view device configurations stored in Git repositories:
                  </p>
                  <ul className="space-y-1 text-sm text-slate-600">
                    <li>• Navigate and search through configuration files</li>
                    <li>• View full file history and commit log</li>
                    <li>• Compare configuration versions side-by-side</li>
                    <li>• Identify differences between any two commits</li>
                  </ul>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Save className="h-5 w-5 text-green-600" />
                    Backup Configs
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-slate-700">
                    Trigger on-demand or scheduled backups of device configurations to Git repositories.
                    Maintains a full version history of every configuration change.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Automation Subsection */}
          <div>
            <h3 className="text-2xl font-semibold text-slate-800 mb-3 flex items-center gap-2">
              <Zap className="h-6 w-6 text-yellow-600" />
              Automation
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Terminal className="h-5 w-5 text-blue-600" />
                    Netmiko
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-slate-700">
                    Execute CLI commands on network devices using Netmiko. Run ad-hoc commands or
                    scripted operations across single or multiple devices simultaneously and view
                    the output in real time.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-orange-600" />
                    Templates
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-slate-700">
                    Manage Jinja2 configuration templates and TextFSM parsing templates stored in
                    Git repositories. Import, edit, and use templates in automation workflows.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Camera className="h-5 w-5 text-purple-600" />
                    Snapshots
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-slate-700">
                    Capture point-in-time snapshots of device state by running a set of show commands.
                    Compare snapshots taken at different times to identify configuration or state drift.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Tools & Compliance */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wifi className="h-5 w-5 text-blue-600" />
                  Network Tools
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-700 mb-3">
                  Diagnostic and testing tools for network operations:
                </p>
                <ul className="space-y-1 text-slate-700">
                  <li className="flex items-center gap-2">
                    <Wifi className="h-4 w-4 text-blue-600" />
                    <span><strong>Ping:</strong> Test ICMP reachability to one or more network devices</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  Compliance Check
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-700">
                  Run automated compliance checks against device configurations using regex-based rules
                  defined in Compliance Settings. View per-device pass/fail results and generate
                  compliance reports.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Jobs Section */}
      <section id="jobs" className="mb-12 scroll-mt-6">
        <h2 className="text-3xl font-bold text-slate-900 mb-4 flex items-center gap-2">
          <Calendar className="h-8 w-8 text-blue-600" />
          Job Automation & Scheduling
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-blue-600" />
                Job Templates
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-700 mb-3">
                Create and manage reusable job templates for common tasks:
              </p>
              <ul className="space-y-1 text-sm text-slate-600">
                <li>• Configuration backups</li>
                <li>• Device synchronization</li>
                <li>• Command execution via Netmiko</li>
                <li>• Compliance checks</li>
                <li>• Custom automation tasks</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-green-600" />
                Scheduler
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-700">
                Schedule jobs to run automatically at specified times or intervals using cron expressions
                or interval-based triggers. Manage active schedules and pause or resume them as needed.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5 text-orange-600" />
                View Job History
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-700">
                Monitor job execution history, view per-task logs, check success/failure status,
                and troubleshoot failed runs with full output and stack traces.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Settings Section */}
      <section id="settings" className="mb-12 scroll-mt-6">
        <h2 className="text-3xl font-bold text-slate-900 mb-4 flex items-center gap-2">
          <Settings className="h-8 w-8 text-blue-600" />
          Settings & Configuration
        </h2>

        <div className="space-y-6">
          {/* Common Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5 text-blue-600" />
                Common Settings
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-700 mb-3">
                Application-wide settings shared across multiple modules:
              </p>
              <ul className="space-y-1 text-sm text-slate-600">
                <li>• <strong>SNMP Mapping:</strong> Define a YAML mapping of device types to SNMP versions and community strings / v3 credentials used during onboarding and compliance checks</li>
              </ul>
            </CardContent>
          </Card>

          {/* Connections */}
          <div>
            <h3 className="text-xl font-semibold text-slate-800 mb-3 flex items-center gap-2">
              <Plug className="h-5 w-5 text-blue-600" />
              Connections
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Database className="h-5 w-5 text-blue-600" />
                    Nautobot
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-slate-700 mb-2">Configure the Nautobot API connection:</p>
                  <ul className="space-y-1 text-sm text-slate-600">
                    <li>• API base URL and authentication token</li>
                    <li>• Default device status, role, platform, and location</li>
                    <li>• Default IP namespace and secret group</li>
                    <li>• Custom field mappings for device attributes</li>
                    <li>• Connection test to verify settings</li>
                  </ul>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5 text-orange-600" />
                    CheckMK
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-slate-700 mb-2">Configure the CheckMK server connection:</p>
                  <ul className="space-y-1 text-sm text-slate-600">
                    <li>• CheckMK server URL and site name</li>
                    <li>• Automation user and password</li>
                    <li>• YAML-based host tag and folder configuration</li>
                    <li>• Connection test to verify credentials</li>
                  </ul>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5 text-green-600" />
                    Agents
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-slate-700 mb-2">Manage Cockpit Agent registrations:</p>
                  <ul className="space-y-1 text-sm text-slate-600">
                    <li>• Register new agents with name and connection details</li>
                    <li>• Configure the Git repository used by each agent</li>
                    <li>• Edit or remove existing agent registrations</li>
                    <li>• View agent API endpoints and credentials</li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Other Settings */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  Compliance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-700 mb-2">Configure compliance check rules and credentials:</p>
                <ul className="space-y-1 text-sm text-slate-600">
                  <li>• <strong>Configs:</strong> Define regex patterns that device configurations must match (or must not match) to pass compliance</li>
                  <li>• <strong>Logins:</strong> Manage login credentials used to connect to devices during compliance checks</li>
                  <li>• <strong>SNMP:</strong> Configure per-device SNMP community strings or v3 credentials used during checks</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-blue-600" />
                  Templates
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-700 mb-2">Manage automation templates:</p>
                <ul className="space-y-1 text-sm text-slate-600">
                  <li>• Import Jinja2 and TextFSM templates from Git repositories</li>
                  <li>• Browse and search the template library</li>
                  <li>• Edit templates directly in the built-in editor with syntax highlighting</li>
                  <li>• Push changes back to the Git repository</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <GitBranch className="h-5 w-5 text-orange-600" />
                  Git Management
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-700 mb-2">Configure Git repository integrations:</p>
                <ul className="space-y-1 text-sm text-slate-600">
                  <li>• Add repositories for config backups, templates, inventories, or agents</li>
                  <li>• Configure SSH or HTTPS credentials per repository</li>
                  <li>• Test connectivity and sync status</li>
                  <li>• Run diagnostics and view repository details</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-yellow-600" />
                  Cache
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-700 mb-2">Manage the application Redis cache:</p>
                <ul className="space-y-1 text-sm text-slate-600">
                  <li>• View cache entries and memory usage statistics</li>
                  <li>• Manually invalidate or refresh specific cache keys</li>
                  <li>• Configure cache TTL and prefetch-on-startup settings</li>
                  <li>• Monitor cache hit/miss rates</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Server className="h-5 w-5 text-blue-600" />
                  Celery
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-700 mb-2">Monitor and configure the Celery task queue:</p>
                <ul className="space-y-1 text-sm text-slate-600">
                  <li>• View active workers and their status</li>
                  <li>• Inspect queue depths and scheduled tasks</li>
                  <li>• Configure task queue routing and concurrency</li>
                  <li>• Trigger test tasks to verify worker health</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Key className="h-5 w-5 text-red-600" />
                  Credentials
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-700 mb-2">Securely manage shared device credentials:</p>
                <ul className="space-y-1 text-sm text-slate-600">
                  <li>• Store SSH username/password or key-based credentials</li>
                  <li>• Credentials are encrypted at rest and used by Netmiko and backup jobs</li>
                  <li>• Set expiry dates and track credential status</li>
                  <li>• Filter and search credentials by type or name</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-purple-600" />
                  Users & Permissions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-700 mb-2">Manage users, roles, and access control:</p>
                <ul className="space-y-1 text-sm text-slate-600">
                  <li>• Create and manage local user accounts</li>
                  <li>• Define roles with specific permission sets</li>
                  <li>• Assign one or more roles to users</li>
                  <li>• Granular permissions per resource and action (read/write/delete)</li>
                  <li>• View effective permissions for any user</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Technology Stack */}
      <section className="mb-12">
        <h2 className="text-3xl font-bold text-slate-900 mb-4 flex items-center gap-2">
          <Layers className="h-8 w-8 text-blue-600" />
          Technology Stack
        </h2>
        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-semibold text-slate-900 mb-3">Frontend</h3>
                <div className="space-y-2">
                  <Badge variant="secondary">Next.js 15</Badge>
                  <Badge variant="secondary">React 19</Badge>
                  <Badge variant="secondary">TypeScript</Badge>
                  <Badge variant="secondary">Tailwind CSS</Badge>
                  <Badge variant="secondary">Shadcn UI</Badge>
                </div>
              </div>
              <div>
                <h3 className="font-semibold text-slate-900 mb-3">Backend</h3>
                <div className="space-y-2">
                  <Badge variant="secondary">FastAPI</Badge>
                  <Badge variant="secondary">Python</Badge>
                  <Badge variant="secondary">PostgreSQL</Badge>
                  <Badge variant="secondary">Celery</Badge>
                  <Badge variant="secondary">Redis</Badge>
                </div>
              </div>
              <div>
                <h3 className="font-semibold text-slate-900 mb-3">Network Tools</h3>
                <div className="space-y-2">
                  <Badge variant="secondary">Netmiko</Badge>
                  <Badge variant="secondary">Ansible</Badge>
                  <Badge variant="secondary">GitPython</Badge>
                  <Badge variant="secondary">Jinja2</Badge>
                </div>
              </div>
              <div>
                <h3 className="font-semibold text-slate-900 mb-3">Integrations</h3>
                <div className="space-y-2">
                  <Badge variant="secondary">Nautobot API</Badge>
                  <Badge variant="secondary">CheckMK API</Badge>
                  <Badge variant="secondary">OIDC/SSO</Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Footer */}
      <div className="text-center text-slate-500 text-sm mt-12 pt-6 border-t border-slate-200">
        <p>Cockpit-NG Network Management Dashboard</p>
        <p className="mt-1">© 2026 - Built for NetDevOps Teams</p>
      </div>
    </div>
  )
}
