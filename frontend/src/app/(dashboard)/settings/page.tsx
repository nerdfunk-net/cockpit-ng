import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Server, FileCode, GitBranch, Zap, Key, Users } from 'lucide-react'

const settingsPages = [
  {
    title: 'Nautobot',
    description: 'Configure your Nautobot server connection',
    href: '/settings/nautobot',
    icon: Server,
    color: 'text-blue-600',
    bgColor: 'bg-blue-100'
  },
  {
    title: 'Templates',
    description: 'Manage configuration templates',
    href: '/settings/templates',
    icon: FileCode,
    color: 'text-green-600',
    bgColor: 'bg-green-100'
  },
  {
    title: 'Git Management',
    description: 'Configure Git repositories and settings',
    href: '/settings/git',
    icon: GitBranch,
    color: 'text-purple-600',
    bgColor: 'bg-purple-100'
  },
  {
    title: 'Cache',
    description: 'Manage cache settings and performance',
    href: '/settings/cache',
    icon: Zap,
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-100'
  },
  {
    title: 'Credentials',
    description: 'Manage authentication credentials',
    href: '/settings/credentials',
    icon: Key,
    color: 'text-red-600',
    bgColor: 'bg-red-100'
  },
  {
    title: 'Users & Permissions',
    description: 'Manage system users, roles and permissions (RBAC)',
    href: '/settings/permissions',
    icon: Users,
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-100'
  }
]

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="border-b border-gray-200 pb-4">
        <div className="flex items-center space-x-3">
          <div className="bg-gray-100 p-2 rounded-lg">
            <Server className="h-6 w-6 text-gray-600" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Settings</h1>
            <p className="text-gray-600">Configure your Cockpit application settings</p>
          </div>
        </div>
      </div>

      {/* Settings Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {settingsPages.map((setting) => {
          const IconComponent = setting.icon
          return (
            <Link key={setting.href} href={setting.href}>
              <Card className="hover:shadow-lg transition-shadow cursor-pointer group">
                <CardHeader>
                  <div className="flex items-center space-x-3">
                    <div className={`p-2 rounded-lg ${setting.bgColor} group-hover:scale-110 transition-transform`}>
                      <IconComponent className={`h-6 w-6 ${setting.color}`} />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{setting.title}</CardTitle>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-gray-600">
                    {setting.description}
                  </CardDescription>
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
