'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import {
  Wrench,
  Shield,
  KeyRound,
  ExternalLink,
  ChevronRight,
  Database,
  FlaskConical,
  Loader2
} from 'lucide-react'

interface ToolLink {
  title: string
  description: string
  href?: string
  icon: React.ReactNode
  external?: boolean
  action?: () => void
}

export default function ToolsPage() {
  const { toast } = useToast()
  const [isCreatingBaseline, setIsCreatingBaseline] = useState(false)

  const handleCreateBaseline = async () => {
    setIsCreatingBaseline(true)
    try {
      // Get auth token from cookie
      const token = document.cookie
        .split('; ')
        .find(row => row.startsWith('cockpit_auth_token='))
        ?.split('=')[1]

      if (!token) {
        throw new Error('Not authenticated')
      }

      const response = await fetch('/api/proxy/tools/tests-baseline', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.detail || 'Failed to create test baseline')
      }

      // Build success message with counts
      const created = data.created || {}
      const counts = Object.entries(created)
        .filter(([_, count]) => typeof count === 'number' && count > 0)
        .map(([resource, count]) => `${count as number} ${resource}`)
        .join(', ')

      toast({
        title: 'Test Baseline Created',
        description: counts ? `Created: ${counts}` : 'Test baseline created successfully',
      })
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create test baseline',
        variant: 'destructive',
      })
    } finally {
      setIsCreatingBaseline(false)
    }
  }

  const tools: ToolLink[] = [
    {
      title: 'OIDC Test Dashboard',
      description: 'Debug and test OpenID Connect authentication flows. View provider configurations, test login flows, and troubleshoot OIDC issues.',
      href: '/oidc-test',
      icon: <Shield className="w-6 h-6" />,
    },
    {
      title: 'Add Certificate',
      description: 'Upload or scan for CA certificates and add them to the system trust store. Manage SSL/TLS certificates for secure connections.',
      href: '/add-certificate',
      icon: <KeyRound className="w-6 h-6" />,
    },
    {
      title: 'Database Migration',
      description: 'Analyze database schema status and perform migrations to match the application data models.',
      href: '/tools/database-migration',
      icon: <Database className="w-6 h-6" />,
    },
    {
      title: 'Test Baseline',
      description: 'Create test data in Nautobot including location types, locations, roles, tags, manufacturers, platforms, device types, and devices from YAML configuration.',
      icon: <FlaskConical className="w-6 h-6" />,
      action: handleCreateBaseline,
    },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-purple-500 text-white shadow-lg">
            <Wrench className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Developer Tools</h1>
            <p className="text-gray-600 mt-1">
              Debugging and administrative tools for Cockpit
            </p>
          </div>
        </div>

        {/* Tools Grid */}
        <div className="grid gap-4">
          {tools.map((tool) => {
            // Action-based card (button click)
            if (tool.action) {
              return (
                <Card
                  key={tool.title}
                  className="group hover:shadow-lg transition-all duration-200 hover:border-purple-300"
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-purple-100 text-purple-600 group-hover:bg-purple-500 group-hover:text-white transition-colors">
                          {tool.icon}
                        </div>
                        <div>
                          <CardTitle className="text-lg">{tool.title}</CardTitle>
                        </div>
                      </div>
                      <Button
                        onClick={tool.action}
                        disabled={isCreatingBaseline}
                        size="sm"
                        className="ml-4"
                      >
                        {isCreatingBaseline ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Creating...
                          </>
                        ) : (
                          'Create Baseline'
                        )}
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="text-sm text-gray-600">
                      {tool.description}
                    </CardDescription>
                  </CardContent>
                </Card>
              )
            }

            // Link-based card (navigation)
            return (
              <Link key={tool.href} href={tool.href!}>
                <Card className="group hover:shadow-lg transition-all duration-200 hover:border-purple-300 cursor-pointer">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-purple-100 text-purple-600 group-hover:bg-purple-500 group-hover:text-white transition-colors">
                          {tool.icon}
                        </div>
                        <div>
                          <CardTitle className="text-lg flex items-center gap-2">
                            {tool.title}
                            {tool.external && (
                              <ExternalLink className="w-4 h-4 text-gray-400" />
                            )}
                          </CardTitle>
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-purple-500 group-hover:translate-x-1 transition-all" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="text-sm text-gray-600">
                      {tool.description}
                    </CardDescription>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>

        {/* Info Box */}
        <Card className="bg-amber-50 border-amber-200">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-amber-100 text-amber-600 flex-shrink-0">
                <Wrench className="w-4 h-4" />
              </div>
              <div className="text-sm text-amber-800">
                <p className="font-medium mb-1">Developer Tools</p>
                <p>
                  These tools are intended for debugging and administrative purposes.
                  They are not shown in the main navigation but are accessible to authenticated users.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
