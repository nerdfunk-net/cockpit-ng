'use client'

import Link from 'next/link'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Wrench,
  Shield,
  KeyRound,
  ExternalLink,
  ChevronRight,
  Database,
  FlaskConical,
} from 'lucide-react'
import { IconChip } from '@/components/shared/icon-chip'

interface ToolLink {
  title: string
  description: string
  href: string
  icon: React.ReactNode
  external?: boolean
}

export default function DeveloperToolsPage() {
  const tools: ToolLink[] = [
    {
      title: 'OIDC Test Dashboard',
      description:
        'Debug and test OpenID Connect authentication flows. View provider configurations, test login flows, and troubleshoot OIDC issues.',
      href: '/tools/oidc-test',
      icon: <Shield className="w-6 h-6" />,
    },
    {
      title: 'Add Certificate',
      description:
        'Upload or scan for CA certificates and add them to the system trust store. Manage SSL/TLS certificates for secure connections.',
      href: '/tools/add-certificate',
      icon: <KeyRound className="w-6 h-6" />,
    },
    {
      title: 'Database Migration',
      description:
        'Analyze database schema status and perform migrations to match the application data models.',
      href: '/tools/database-migration',
      icon: <Database className="w-6 h-6" />,
    },
    {
      title: 'Baseline Management',
      description:
        'Generate baseline YAML and import test data from contributing-data/tests_baseline/ into Nautobot.',
      href: '/tools/baseline-management',
      icon: <FlaskConical className="w-6 h-6" />,
    },
  ]

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <IconChip variant="primary">
            <Wrench className="h-6 w-6" />
          </IconChip>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Developer Tools</h1>
            <p className="text-muted-foreground mt-2">
              Debugging and administrative tools for Cockpit
            </p>
          </div>
        </div>

        {/* Tools Grid */}
        <div className="grid gap-4">
          {tools.map(tool => (
              <Link key={tool.href} href={tool.href}>
                <Card className="group hover:shadow-lg transition-all duration-200 hover:border-primary cursor-pointer">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                          {tool.icon}
                        </div>
                        <div>
                          <CardTitle className="text-lg flex items-center gap-2">
                            {tool.title}
                            {tool.external && (
                              <ExternalLink className="w-4 h-4 text-muted-foreground" />
                            )}
                          </CardTitle>
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <CardDescription>{tool.description}</CardDescription>
                  </CardContent>
                </Card>
              </Link>
          ))}
        </div>

        {/* Info Box */}
        <Card className="status-warning">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-warning text-warning-foreground flex-shrink-0">
                <Wrench className="w-4 h-4" />
              </div>
              <div className="text-sm">
                <p className="font-medium mb-1">Developer Tools</p>
                <p>
                  These tools are intended for debugging and administrative purposes.
                  They are not shown in the main navigation but are accessible to
                  authenticated users.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
