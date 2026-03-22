'use client'

import { useState } from 'react'
import { useConfirmDialog } from '@/hooks/use-confirm-dialog'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CheckCircle, FileText, Key, Network } from 'lucide-react'

import { RegexPatternsTab } from './components/regex-patterns-tab'
import { LoginCredentialsTab } from './components/login-credentials-tab'
import { SnmpMappingsTab } from './components/snmp-mappings-tab'

export default function ComplianceSettingsForm() {
  const [activeTab, setActiveTab] = useState('configs')
  const { confirmDialog, openConfirm } = useConfirmDialog()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="bg-green-100 p-2 rounded-lg">
            <CheckCircle className="h-6 w-6 text-green-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Compliance Settings</h1>
            <p className="text-muted-foreground">
              Configure compliance check rules and credentials
            </p>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="configs" className="flex items-center space-x-2">
            <FileText className="h-4 w-4" />
            <span>Configs</span>
          </TabsTrigger>
          <TabsTrigger value="logins" className="flex items-center space-x-2">
            <Key className="h-4 w-4" />
            <span>Logins</span>
          </TabsTrigger>
          <TabsTrigger value="snmp" className="flex items-center space-x-2">
            <Network className="h-4 w-4" />
            <span>SNMP</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="configs" className="space-y-6">
          <RegexPatternsTab
            openConfirm={openConfirm}
            isActiveTab={activeTab === 'configs'}
          />
        </TabsContent>

        <TabsContent value="logins">
          <LoginCredentialsTab
            openConfirm={openConfirm}
            isActiveTab={activeTab === 'logins'}
          />
        </TabsContent>

        <TabsContent value="snmp">
          <SnmpMappingsTab
            openConfirm={openConfirm}
            isActiveTab={activeTab === 'snmp'}
          />
        </TabsContent>
      </Tabs>

      <ConfirmDialog {...confirmDialog} />
    </div>
  )
}
