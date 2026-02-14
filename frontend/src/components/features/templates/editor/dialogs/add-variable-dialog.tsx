'use client'

import { useCallback } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PenLine, FileText, Globe, Database } from 'lucide-react'
import { CustomVariableTab } from './tabs/custom-variable-tab'
import { YamlFileTab } from './tabs/yaml-file-tab'
import { NautobotDataTab } from './tabs/nautobot-data-tab'
import { InventoryMetadataTab } from './tabs/inventory-metadata-tab'
import type { AddVariableDialogProps } from './types'

export function AddVariableDialog({
  open,
  onOpenChange,
  onAdd,
  existingVariableNames,
  category,
  inventoryId,
}: AddVariableDialogProps) {
  const handleAdd = useCallback(
    (name: string, value: string) => {
      onAdd(name, value)
      onOpenChange(false)
    },
    [onAdd, onOpenChange]
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0">
        <DialogHeader className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-3 px-6 rounded-t-lg">
          <DialogTitle className="flex items-center gap-2 text-white">
            <PenLine className="h-4 w-4" />
            Add Variable
          </DialogTitle>
        </DialogHeader>

        <div className="px-6 py-4">
          <Tabs defaultValue="custom">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="custom" className="text-xs gap-1">
                <PenLine className="h-3 w-3" />
                Custom
              </TabsTrigger>
              <TabsTrigger value="yaml" className="text-xs gap-1">
                <FileText className="h-3 w-3" />
                YAML File
              </TabsTrigger>
              <TabsTrigger value="nautobot" className="text-xs gap-1">
                <Globe className="h-3 w-3" />
                Nautobot
              </TabsTrigger>
              <TabsTrigger value="inventory" className="text-xs gap-1">
                <Database className="h-3 w-3" />
                Inventory
              </TabsTrigger>
            </TabsList>

            <TabsContent value="custom" className="mt-4">
              <CustomVariableTab
                onAdd={handleAdd}
                existingVariableNames={existingVariableNames}
              />
            </TabsContent>

            <TabsContent value="yaml" className="mt-4">
              <YamlFileTab
                onAdd={handleAdd}
                existingVariableNames={existingVariableNames}
              />
            </TabsContent>

            <TabsContent value="nautobot" className="mt-4">
              <NautobotDataTab
                onAdd={handleAdd}
                existingVariableNames={existingVariableNames}
              />
            </TabsContent>

            <TabsContent value="inventory" className="mt-4">
              <InventoryMetadataTab
                onAdd={handleAdd}
                existingVariableNames={existingVariableNames}
                category={category}
                inventoryId={inventoryId}
              />
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  )
}
