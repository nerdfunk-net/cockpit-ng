'use client'

import { useState, useCallback } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Shield, Users, Key, UserCog, UserPlus } from 'lucide-react'
import { IconChip } from '@/components/shared/icon-chip'
import { RolesManager } from './permissions/roles-manager'
import { UserRolesManager } from './permissions/user-roles-manager'
import { PermissionsViewer } from './permissions/permissions-viewer'
import { UserPermissionsManager } from './permissions/user-permissions-manager'
import { UsersManager } from './permissions/users-manager'

export function PermissionsManagement() {
  const [activeTab, setActiveTab] = useState('users')

  const handleTabChange = useCallback((value: string) => {
    setActiveTab(value)
  }, [])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <IconChip variant="primary">
            <Shield className="h-6 w-6" />
          </IconChip>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Users & Permissions</h1>
            <p className="text-muted-foreground mt-2">
              Manage users, roles, permissions, and access control
            </p>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
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
          <Card className="shadow-lg border-0 overflow-hidden p-0">
            <CardHeader className="panel-header border-b-0 rounded-t-lg m-0 py-2 px-4">
              <CardTitle className="flex items-center space-x-2 text-sm font-medium">
                <UserPlus className="h-5 w-5" />
                <span>User Accounts</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 panel-content">
              <UsersManager />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Roles Management */}
        <TabsContent value="roles">
          <Card className="shadow-lg border-0 overflow-hidden p-0">
            <CardHeader className="panel-header border-b-0 rounded-t-lg m-0 py-2 px-4">
              <CardTitle className="flex items-center space-x-2 text-sm font-medium">
                <Shield className="h-5 w-5" />
                <span>Role Management</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 panel-content">
              <RolesManager />
            </CardContent>
          </Card>
        </TabsContent>

        {/* User-Roles Assignment */}
        <TabsContent value="user-roles">
          <Card className="shadow-lg border-0 overflow-hidden p-0">
            <CardHeader className="panel-header border-b-0 rounded-t-lg m-0 py-2 px-4">
              <CardTitle className="flex items-center space-x-2 text-sm font-medium">
                <Users className="h-5 w-5" />
                <span>User Role Assignments</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 panel-content">
              <UserRolesManager />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Permissions Viewer */}
        <TabsContent value="permissions">
          <Card className="shadow-lg border-0 overflow-hidden p-0">
            <CardHeader className="panel-header border-b-0 rounded-t-lg m-0 py-2 px-4">
              <CardTitle className="flex items-center space-x-2 text-sm font-medium">
                <Key className="h-5 w-5" />
                <span>All Permissions</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 panel-content">
              <PermissionsViewer />
            </CardContent>
          </Card>
        </TabsContent>

        {/* User Permission Overrides */}
        <TabsContent value="user-overrides">
          <Card className="shadow-lg border-0 overflow-hidden p-0">
            <CardHeader className="panel-header border-b-0 rounded-t-lg m-0 py-2 px-4">
              <CardTitle className="flex items-center space-x-2 text-sm font-medium">
                <UserCog className="h-5 w-5" />
                <span>User Permission Overrides</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 panel-content">
              <UserPermissionsManager />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
