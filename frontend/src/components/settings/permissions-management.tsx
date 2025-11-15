'use client'

import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Shield, Users, Key, UserCog, UserPlus } from 'lucide-react'
import { RolesManager } from './permissions/roles-manager'
import { UserRolesManager } from './permissions/user-roles-manager'
import { PermissionsViewer } from './permissions/permissions-viewer'
import { UserPermissionsManager } from './permissions/user-permissions-manager'
import { UsersManager } from './permissions/users-manager'

export function PermissionsManagement() {
  const [activeTab, setActiveTab] = useState('users')

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-slate-900">Users & Permissions</h1>
        <p className="text-slate-600 mt-2">
          Manage users, roles, permissions, and access control
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-5 lg:w-auto lg:inline-grid">
          <TabsTrigger value="users" className="flex items-center gap-2">
            <UserPlus className="h-4 w-4" />
            <span className="hidden sm:inline">Users</span>
          </TabsTrigger>
          <TabsTrigger value="user-roles" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">User Roles</span>
          </TabsTrigger>
          <TabsTrigger value="roles" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            <span className="hidden sm:inline">Roles</span>
          </TabsTrigger>
          <TabsTrigger value="permissions" className="flex items-center gap-2">
            <Key className="h-4 w-4" />
            <span className="hidden sm:inline">Permissions</span>
          </TabsTrigger>
          <TabsTrigger value="user-overrides" className="flex items-center gap-2">
            <UserCog className="h-4 w-4" />
            <span className="hidden sm:inline">Overrides</span>
          </TabsTrigger>
        </TabsList>

        {/* Users Management */}
        <TabsContent value="users">
          <Card>
            <CardHeader>
              <CardTitle>User Accounts</CardTitle>
              <CardDescription>
                Create and manage user accounts. Assign roles in the User Roles tab.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <UsersManager />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Roles Management */}
        <TabsContent value="roles">
          <Card>
            <CardHeader>
              <CardTitle>Role Management</CardTitle>
              <CardDescription>
                Create and manage roles. Each role contains a collection of permissions.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RolesManager />
            </CardContent>
          </Card>
        </TabsContent>

        {/* User-Roles Assignment */}
        <TabsContent value="user-roles">
          <Card>
            <CardHeader>
              <CardTitle>User Role Assignments</CardTitle>
              <CardDescription>
                Assign roles to users. Users inherit all permissions from their assigned roles.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <UserRolesManager />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Permissions Viewer */}
        <TabsContent value="permissions">
          <Card>
            <CardHeader>
              <CardTitle>All Permissions</CardTitle>
              <CardDescription>
                View all available permissions in the system. Permissions are assigned through roles.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PermissionsViewer />
            </CardContent>
          </Card>
        </TabsContent>

        {/* User Permission Overrides */}
        <TabsContent value="user-overrides">
          <Card>
            <CardHeader>
              <CardTitle>User Permission Overrides</CardTitle>
              <CardDescription>
                Grant or deny specific permissions to individual users, overriding their role permissions.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <UserPermissionsManager />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
