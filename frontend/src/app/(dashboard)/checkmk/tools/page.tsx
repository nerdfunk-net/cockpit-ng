'use client'

import { Wrench } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ChangesTab } from '@/components/features/checkmk/tools/tabs/changes-tab'
import { DiscoveryTab } from '@/components/features/checkmk/tools/tabs/discovery-tab'

export default function CheckmkToolsPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="bg-orange-100 p-2 rounded-lg">
            <Wrench className="h-6 w-6 text-orange-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">CheckMK Tools</h1>
            <p className="text-gray-600 mt-1">Manage CheckMK changes and service discovery</p>
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
