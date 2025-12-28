'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Plus,
  RefreshCw,
  Save,
  GitCompare,
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
  BarChart3,
  Edit,
  Network,
  BookOpen,
  Target,
  Layers,
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            <button
              onClick={() => scrollToSection('overview')}
              className="text-left px-4 py-2 rounded-lg hover:bg-blue-100 transition-colors text-blue-700 font-medium"
            >
              📋 Overview
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
              ⚙️ Settings & Configuration
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
                  <span><strong>Configuration Management:</strong> Backup, view, and compare device configurations</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                  <span><strong>Network Automation:</strong> Execute commands, manage Ansible inventories, and use templates</span>
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
                Manually add individual network devices to Nautobot with complete device information including
                location, device type, role, and network interfaces.
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
                Streamlined device onboarding process that automatically discovers device information and
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
                proper cleanup and documentation.
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
                  <span><strong>Check IP & Names:</strong> Verify IP addresses and hostnames</span>
                </li>
                <li className="flex items-center gap-2">
                  <Edit className="h-4 w-4 text-blue-600" />
                  <span><strong>Bulk Edit:</strong> Update multiple devices simultaneously</span>
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
                Export device data and inventory information in various formats for reporting, analysis,
                or integration with other tools.
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-blue-600" />
                Sync Devices
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-700">
                Synchronize devices from Nautobot to CheckMK monitoring system, automatically creating
                hosts and applying appropriate monitoring configurations.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <RefreshCw className="h-5 w-5 text-green-600" />
                Live Update
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-700">
                View real-time synchronization status and progress. Monitor which devices are being
                processed and track any issues during the sync process.
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
                Manage CheckMK host inventory, view host configurations, and monitor the status of
                devices in your CheckMK monitoring system.
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Eye className="h-5 w-5 text-blue-600" />
                    View Configs
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-slate-700">
                    Browse and view device configurations stored in Git repositories. Search and navigate
                    through configuration files easily.
                  </p>
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
                    Automatically backup device configurations to Git repositories. Schedule regular backups
                    and maintain version history of all changes.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <GitCompare className="h-5 w-5 text-orange-600" />
                    Compare Configs
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-slate-700">
                    Compare configuration versions side-by-side, track changes over time, and identify
                    differences between device configurations.
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
                    Execute commands on network devices using Netmiko. Run ad-hoc commands or scripted
                    operations across multiple devices simultaneously.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <List className="h-5 w-5 text-green-600" />
                    Ansible Inventory
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-slate-700">
                    Generate and manage Ansible inventory files dynamically from Nautobot. Create custom
                    inventory groups and filters.
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
                    Manage Jinja2 templates for configuration generation, TextFSM templates for parsing,
                    and other automation templates.
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
                    <span><strong>Ping:</strong> Test network connectivity to devices</span>
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
                  Monitor device compliance with organizational standards. Define compliance rules,
                  run automated checks, and generate compliance reports.
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
                <li>• Command execution</li>
                <li>• Compliance checks</li>
                <li>• Custom automation tasks</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-green-600" />
                Job Scheduler
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-700">
                Schedule jobs to run automatically at specified times or intervals. Supports cron expressions
                and interval-based scheduling for recurring tasks.
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
                Monitor job execution history, view logs, check success/failure status, and troubleshoot
                issues with detailed execution results.
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
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5 text-blue-600" />
                Common Settings
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-700">
                General application settings and preferences that apply across all modules.
              </p>
            </CardContent>
          </Card>

          <div>
            <h3 className="text-xl font-semibold text-slate-800 mb-3 flex items-center gap-2">
              <Plug className="h-5 w-5 text-blue-600" />
              External Connections
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
                  <p className="text-slate-700">
                    Configure Nautobot API connection settings, authentication tokens, and default parameters
                    for device operations.
                  </p>
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
                  <p className="text-slate-700">
                    Set up CheckMK server connection, automation user credentials, and synchronization
                    preferences.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-green-600" />
                    Grafana
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-slate-700">
                    Configure Grafana dashboard integration for monitoring and visualization of network metrics.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  Compliance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-700">
                  Define compliance rules, regex patterns, and validation criteria for device configurations.
                </p>
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
                <p className="text-slate-700">
                  Manage Jinja2 templates for configuration generation and TextFSM templates for parsing.
                </p>
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
                <p className="text-slate-700">
                  Configure Git repositories for configuration backups, template storage, and version control.
                </p>
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
                <p className="text-slate-700">
                  Manage application cache settings and refresh intervals for improved performance.
                </p>
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
                <p className="text-slate-700">
                  Configure Celery task queue settings for background job processing and scheduling.
                </p>
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
                <p className="text-slate-700">
                  Securely store and manage encrypted credentials for device access (SSH, TACACS, SNMP).
                </p>
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
                <p className="text-slate-700">
                  Manage users, roles, and permissions with granular role-based access control (RBAC).
                </p>
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
                  <Badge variant="secondary">Grafana</Badge>
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
        <p className="mt-1">© 2025 - Built for NetDevOps Teams</p>
      </div>
    </div>
  )
}
