'use client'

import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Wrench,
  Shield,
  KeyRound,
  ExternalLink,
  ChevronRight
} from 'lucide-react'

interface ToolLink {
  title: string
  description: string
  href: string
  icon: React.ReactNode
  external?: boolean
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
]

export default function ToolsPage() {
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
          {tools.map((tool) => (
            <Link key={tool.href} href={tool.href}>
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
          ))}
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
