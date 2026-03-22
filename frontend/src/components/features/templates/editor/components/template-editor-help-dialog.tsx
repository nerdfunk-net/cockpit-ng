'use client'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { HelpCircle } from 'lucide-react'
import { GeneralTab } from './help/general-tab'
import { NetmikoTab } from './help/netmiko-tab'
import { AgentTab } from './help/agent-tab'

interface TemplateEditorHelpDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function TemplateEditorHelpDialog({
  open,
  onOpenChange,
}: TemplateEditorHelpDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!max-w-[1400px] w-[95vw] max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <HelpCircle className="h-6 w-6 text-purple-600" />
            Template Editor Help
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-6">
          <Tabs defaultValue="general" className="h-full flex flex-col">
            <TabsList className="grid w-full grid-cols-3 mb-4 mt-4 shrink-0">
              <TabsTrigger value="general">General</TabsTrigger>
              <TabsTrigger value="netmiko">Netmiko</TabsTrigger>
              <TabsTrigger value="agent">Agent</TabsTrigger>
            </TabsList>
            <div className="flex-1">
              <TabsContent value="general" className="mt-0">
                <GeneralTab />
              </TabsContent>
              <TabsContent value="netmiko" className="mt-0">
                <NetmikoTab />
              </TabsContent>
              <TabsContent value="agent" className="mt-0">
                <AgentTab />
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  )
}
