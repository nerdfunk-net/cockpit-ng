'use client'

import { useState } from 'react'
import type { UseFormReturn } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormDescription,
} from '@/components/ui/form'
import { Server, ChevronDown, ChevronUp } from 'lucide-react'
import { useSavedInventoriesQuery } from '@/hooks/queries/use-saved-inventories-queries'
import type { EditorFormData } from '../types'

interface AgentOptionsPanelProps {
  form: UseFormReturn<EditorFormData>
  isLoadingDevices?: boolean
  deviceCount?: number
}

export function AgentOptionsPanel({ form, isLoadingDevices, deviceCount }: AgentOptionsPanelProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const { data: inventoriesData, isLoading: isLoadingInventories } =
    useSavedInventoriesQuery()
  const inventories = inventoriesData?.inventories || []

  return (
    <div className="shadow-lg border-0 p-0 bg-white rounded-lg">
      {/* Header with gradient */}
      <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4 flex items-center justify-between rounded-t-lg">
        <div className="flex items-center gap-3">
          <div className="flex items-center">
            <Server className="h-4 w-4 mr-2" />
            <span className="text-sm font-medium">Agent Options</span>
          </div>
          {isLoadingDevices && (
            <div className="flex items-center gap-1.5 text-xs text-blue-100">
              <div className="animate-spin rounded-full h-3 w-3 border-b border-white" />
              <span>Loading devices...</span>
            </div>
          )}
          {!isLoadingDevices && deviceCount !== undefined && deviceCount > 0 && (
            <span className="text-xs text-blue-100">
              {deviceCount} device{deviceCount !== 1 ? 's' : ''} loaded
            </span>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="h-6 w-6 p-0 text-white hover:bg-white/20"
        >
          {isCollapsed ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronUp className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Content area */}
      {!isCollapsed && (
      <div className="p-4 bg-gradient-to-b from-white to-gray-50">
        <Form {...form}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Inventory selector */}
          <FormField
            control={form.control}
            name="inventoryId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Inventory</FormLabel>
                <Select
                  value={field.value?.toString() || 'none'}
                  onValueChange={(val) =>
                    field.onChange(val === 'none' ? null : Number(val))
                  }
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue
                        placeholder={
                          isLoadingInventories ? 'Loading...' : 'Select inventory...'
                        }
                      />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="none">No inventory</SelectItem>
                    {inventories.map((inv) => (
                      <SelectItem key={inv.id} value={inv.id.toString()}>
                        {inv.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormItem>
            )}
          />

          {/* Path input */}
          <FormField
            control={form.control}
            name="path"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Deployment Path</FormLabel>
                <FormControl>
                  <Input placeholder="/etc/telegraf/telegraf.conf" {...field} />
                </FormControl>
              </FormItem>
            )}
          />

          {/* SNMP Mapping checkbox */}
          <FormField
            control={form.control}
            name="passSnmpMapping"
            render={({ field }) => (
              <FormItem className="flex items-center space-x-2 pt-6">
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
                <div className="space-y-0 leading-none">
                  <FormLabel className="text-sm">Add SNMP Mapping</FormLabel>
                  <FormDescription className="text-xs mt-0.5">
                    Pass snmp_mapping variable
                  </FormDescription>
                </div>
              </FormItem>
            )}
          />
        </div>
        </Form>
      </div>
      )}
    </div>
  )
}
