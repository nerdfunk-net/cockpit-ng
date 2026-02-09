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
  FormMessage,
} from '@/components/ui/form'
import { FileCode, ChevronDown, ChevronUp } from 'lucide-react'
import { CANONICAL_CATEGORIES } from '@/components/features/settings/templates/utils/constants'
import type { EditorFormData } from '../types'

interface GeneralPanelProps {
  form: UseFormReturn<EditorFormData>
}

export function GeneralPanel({ form }: GeneralPanelProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)

  return (
    <div className="shadow-lg border-0 p-0 bg-white rounded-lg overflow-hidden">
      <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4 rounded-t-lg flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileCode className="h-4 w-4" />
          <span className="text-sm font-medium">Template Details</span>
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
      {!isCollapsed && (
      <div className="p-4 bg-gradient-to-b from-white to-gray-50">
        <Form {...form}>
          <div className="space-y-3">
            {/* Template Details in 12-column grid */}
            <div className="grid grid-cols-12 gap-3">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem className="col-span-3">
                    <FormLabel>
                      Template Name <span className="text-red-500">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., telegraf-agent-config" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem className="col-span-3">
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Input placeholder="Brief description of the template" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Category</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="__none__">No Category</SelectItem>
                        {CANONICAL_CATEGORIES.map((cat) => (
                          <SelectItem key={cat} value={cat}>
                            {cat.charAt(0).toUpperCase() + cat.slice(1)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="template_type"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Type</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="jinja2">Jinja2</SelectItem>
                        <SelectItem value="text">Plain Text</SelectItem>
                        <SelectItem value="textfsm">TextFSM</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="scope"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Scope</FormLabel>
                    <div className="flex items-center space-x-2 h-9">
                      <FormControl>
                        <Checkbox
                          checked={field.value === 'global'}
                          onCheckedChange={(checked) =>
                            field.onChange(checked ? 'global' : 'private')
                          }
                        />
                      </FormControl>
                      <span className="text-sm">Global Template</span>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>
        </Form>
      </div>
      )}
    </div>
  )
}
