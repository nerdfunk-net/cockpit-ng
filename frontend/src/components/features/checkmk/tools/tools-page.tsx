'use client'

import { Wrench } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { IconChip } from '@/components/shared/icon-chip'
import { ChangesTab } from './tabs/changes-tab'
import { DiscoveryTab } from './tabs/discovery-tab'

export default function ToolsPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <IconChip variant="warning">
            <Wrench className="h-6 w-6" />
          </IconChip>
          <div>
            <h1 className="text-3xl font-bold text-foreground">CheckMK Tools</h1>
            <p className="text-muted-foreground mt-2">
              Manage CheckMK changes and service discovery
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="changes" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="changes">Changes</TabsTrigger>
          <TabsTrigger value="discovery">Discovery</TabsTrigger>
        </TabsList>

        <TabsContent value="changes" className="space-y-6">
          <ChangesTab />
        </TabsContent>

        <TabsContent value="discovery" className="space-y-6">
          <DiscoveryTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
