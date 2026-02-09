'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import type { UseFormReturn } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
} from '@/components/ui/form'
import { Terminal, ChevronDown, ChevronUp, Search } from 'lucide-react'
import { useApi } from '@/hooks/use-api'
import type { EditorFormData } from '../types'

interface NetmikoOptionsPanelProps {
  form: UseFormReturn<EditorFormData>
}

interface Device {
  id: string
  name: string
  primary_ip4?: {
    address?: string
  } | string
  primary_ip6?: {
    address?: string
  } | string
}

interface StoredCredential {
  id: number
  name: string
  username: string
  type: string
  valid_until?: string
}

export function NetmikoOptionsPanel({ form }: NetmikoOptionsPanelProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [devices, setDevices] = useState<Device[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const [credentials, setCredentials] = useState<StoredCredential[]>([])
  const isSelectingDeviceRef = useRef(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const { apiCall } = useApi()

  // Load credentials on mount
  useEffect(() => {
    const loadCredentials = async () => {
      try {
        const response = await apiCall<StoredCredential[]>('credentials?include_expired=false')
        // Filter for SSH credentials only
        const sshCredentials = response.filter(cred => cred.type === 'ssh')
        setCredentials(sshCredentials)
      } catch (error) {
        console.error('Error loading credentials:', error)
        setCredentials([])
      }
    }
    loadCredentials()
  }, [apiCall])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowResults(false)
      }
    }

    if (showResults) {
      // Use timeout to avoid immediate closing when opening
      const timeoutId = setTimeout(() => {
        document.addEventListener('click', handleClickOutside, true)
      }, 0)

      return () => {
        clearTimeout(timeoutId)
        document.removeEventListener('click', handleClickOutside, true)
      }
    }

    return undefined
  }, [showResults])

  // Search for devices when user types at least 3 characters
  useEffect(() => {
    const searchDevices = async () => {
      if (searchTerm.length < 3) {
        setDevices([])
        setShowResults(false)
        return
      }

      // Skip search if we're just setting the selected device name
      if (isSelectingDeviceRef.current) {
        return
      }

      setIsSearching(true)
      try {
        const response = await apiCall<{ devices: Device[] }>(
          `nautobot/devices?search=${encodeURIComponent(searchTerm)}&limit=20`
        )
        setDevices(response.devices || [])
        setShowResults(true)
      } catch (error) {
        console.error('Error searching devices:', error)
        setDevices([])
        setShowResults(false)
      } finally {
        setIsSearching(false)
      }
    }

    const timeoutId = setTimeout(searchDevices, 300)
    return () => clearTimeout(timeoutId)
  }, [searchTerm, apiCall])

  // Filter devices based on search term
  const filteredDevices = useMemo(() => {
    if (!searchTerm || searchTerm.length < 3) return []
    const lowerSearch = searchTerm.toLowerCase()
    return devices.filter(device =>
      device.name.toLowerCase().includes(lowerSearch)
    )
  }, [devices, searchTerm])

  const handleDeviceSelect = (device: Device) => {
    isSelectingDeviceRef.current = true
    form.setValue('testDeviceId', device.id)
    form.setValue('testDeviceName', device.name)
    setSearchTerm(device.name)
    setShowResults(false)
    // Reset the flag after a short delay
    setTimeout(() => {
      isSelectingDeviceRef.current = false
    }, 500)
  }

  const getDeviceIp = (device: Device): string => {
    if (typeof device.primary_ip4 === 'object' && device.primary_ip4?.address) {
      return device.primary_ip4.address.split('/')[0] || 'No IP'
    }
    if (typeof device.primary_ip4 === 'string') {
      return device.primary_ip4.split('/')[0] || 'No IP'
    }
    if (typeof device.primary_ip6 === 'object' && device.primary_ip6?.address) {
      return device.primary_ip6.address.split('/')[0] || 'No IP'
    }
    if (typeof device.primary_ip6 === 'string') {
      return device.primary_ip6.split('/')[0] || 'No IP'
    }
    return 'No IP'
  }

  return (
    <div className="shadow-lg border-0 p-0 bg-white rounded-lg">
      {/* Header with gradient */}
      <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4 flex items-center justify-between rounded-t-lg">
        <div className="flex items-center gap-3">
          <div className="flex items-center">
            <Terminal className="h-4 w-4 mr-2" />
            <span className="text-sm font-medium">Netmiko Options</span>
          </div>
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
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              {/* 1. Mode - 2 columns */}
              <FormField
                control={form.control}
                name="netmikoMode"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Mode</FormLabel>
                    <Select
                      value={field.value || 'run_on_device'}
                      onValueChange={field.onChange}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="run_on_device">Run on Device</SelectItem>
                        <SelectItem value="write_to_file">Write to File</SelectItem>
                        <SelectItem value="sync_to_nautobot">Sync to Nautobot</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />

              {/* 2. Test Device - 4 columns */}
              <FormField
                control={form.control}
                name="testDeviceName"
                render={() => (
                  <FormItem className="md:col-span-4 relative">
                    <FormLabel>Test Device (Optional)</FormLabel>
                    <FormControl>
                      <div className="relative" ref={dropdownRef}>
                        <Input
                          placeholder="Type device name (min 3 chars)..."
                          value={searchTerm}
                          onChange={(e) => {
                            isSelectingDeviceRef.current = false
                            setSearchTerm(e.target.value)
                          }}
                          onFocus={() => {
                            if (searchTerm.length >= 3 && filteredDevices.length > 0 && !isSelectingDeviceRef.current) {
                              setShowResults(true)
                            }
                          }}
                          className="pr-10"
                        />
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                          {isSearching ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600" />
                          ) : (
                            <Search className="h-4 w-4 text-gray-400" />
                          )}
                        </div>

                        {/* Search results dropdown */}
                        {showResults && filteredDevices.length > 0 && (
                          <div className="absolute z-50 w-full mt-1 bg-white border-2 border-blue-300 rounded-md shadow-lg max-h-64 overflow-auto">
                            {filteredDevices.map((device) => (
                              <button
                                key={device.id}
                                type="button"
                                onClick={() => handleDeviceSelect(device)}
                                className="w-full text-left px-4 py-2 hover:bg-blue-50 focus:bg-blue-100 focus:outline-none border-b border-gray-100 last:border-b-0"
                              >
                                <div className="font-medium text-gray-900">{device.name}</div>
                                <div className="text-sm text-gray-500">{getDeviceIp(device)}</div>
                              </button>
                            ))}
                          </div>
                        )}

                        {/* No results message */}
                        {showResults && searchTerm.length >= 3 && filteredDevices.length === 0 && !isSearching && (
                          <div className="absolute z-50 w-full mt-1 bg-white border-2 border-gray-300 rounded-md shadow-lg px-4 py-3">
                            <p className="text-sm text-gray-500">No devices found</p>
                          </div>
                        )}
                      </div>
                    </FormControl>
                  </FormItem>
                )}
              />

              {/* 3. Command - 4 columns */}
              <FormField
                control={form.control}
                name="preRunCommand"
                render={({ field }) => (
                  <FormItem className="md:col-span-4">
                    <FormLabel>Command (Optional)</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g., show version"
                        {...field}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              {/* 4. Credentials - 2 columns */}
              <FormField
                control={form.control}
                name="credentialId"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Credentials</FormLabel>
                    <Select
                      value={field.value || 'none'}
                      onValueChange={field.onChange}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {credentials.map((cred) => (
                          <SelectItem key={cred.id} value={cred.id.toString()}>
                            {cred.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
