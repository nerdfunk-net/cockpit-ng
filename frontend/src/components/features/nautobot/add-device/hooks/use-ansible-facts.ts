'use client'

import { useState, useRef, useCallback, useMemo } from 'react'
import type { UseFormReturn } from 'react-hook-form'
import { useApi } from '@/hooks/use-api'
import { useToast } from '@/hooks/use-toast'
import type { Agent } from '@/components/features/settings/connections/agents/types'
import type { DeviceFormValues } from '../utils/validation'
import type { Platform } from '../types'

interface AgentsSettingsResponse {
  success: boolean
  data?: {
    agents: Agent[]
  }
}

interface CommandResponse {
  command_id: string
  status: string
  output: unknown
  error?: string
  execution_time_ms: number
}

export interface AnsibleFactsHook {
  showAgentModal: boolean
  ansibleAgents: Agent[]
  isLoadingAgents: boolean
  isSendingCommand: boolean
  handleGatherFacts: () => Promise<void>
  handleAgentSelected: (agentId: string, ansibleUser: string) => Promise<void>
  handleCloseModal: () => void
}

const EMPTY_AGENTS: Agent[] = []
const EMPTY_PLATFORMS: Platform[] = []

/** Nautobot platform.network_driver values supported by get_cisco_facts */
const SUPPORTED_NETWORK_DRIVERS = new Set(['cisco_ios', 'cisco_nxos'])

export function useAnsibleFacts(
  form: UseFormReturn<DeviceFormValues>,
  platforms: Platform[] = EMPTY_PLATFORMS
): AnsibleFactsHook {
  const { apiCall } = useApi()
  const { toast } = useToast()

  const [showAgentModal, setShowAgentModal] = useState(false)
  const [ansibleAgents, setAnsibleAgents] = useState<Agent[]>(EMPTY_AGENTS)
  const [isLoadingAgents, setIsLoadingAgents] = useState(false)
  const [isSendingCommand, setIsSendingCommand] = useState(false)

  const resolvedAddressRef = useRef<string>('')
  const networkDriverRef = useRef<string>('')

  const resolveTargetAddress = useCallback((): string | null => {
    const interfaces = form.getValues('interfaces')
    for (const iface of interfaces) {
      for (const ip of iface.ip_addresses) {
        if (ip.is_primary && ip.address.trim()) {
          return ip.address.trim()
        }
      }
    }
    const deviceName = form.getValues('deviceName').trim()
    return deviceName || null
  }, [form])

  const resolveNetworkDriver = useCallback((): string | null => {
    const platformId = form.getValues('selectedPlatform')
    if (!platformId) return null
    const platform = platforms.find(p => p.id === platformId)
    const driver = platform?.network_driver?.trim()
    return driver || null
  }, [form, platforms])

  const handleAgentSelected = useCallback(
    async (agentId: string, ansibleUser: string) => {
      setShowAgentModal(false)
      const target = resolvedAddressRef.current
      const networkDriver = networkDriverRef.current
      if (!target || !networkDriver) return

      setIsSendingCommand(true)
      try {
        const result = await apiCall<CommandResponse>('cockpit-agent/ansible/get-cisco-facts', {
          method: 'POST',
          body: JSON.stringify({
            agent_id: agentId,
            ip_address: target,
            network_driver: networkDriver,
            ansible_user: ansibleUser,
            use_sshkey: true,
            timeout: 60,
          }),
        })

        if (result.status === 'success') {
          toast({
            title: 'Cisco facts gathered',
            description: JSON.stringify(result.output, null, 2),
          })
        } else {
          toast({
            title: 'Facts failed',
            description: result.error ?? 'Unknown error from agent',
            variant: 'destructive',
          })
        }
      } catch (err: unknown) {
        toast({
          title: 'Facts failed',
          description: err instanceof Error ? err.message : 'Failed to send command',
          variant: 'destructive',
        })
      } finally {
        setIsSendingCommand(false)
      }
    },
    [apiCall, toast]
  )

  const handleGatherFacts = useCallback(async () => {
    const networkDriver = resolveNetworkDriver()
    if (!networkDriver) {
      toast({
        title: 'Missing platform',
        description: 'Select a platform with a network driver (e.g. Cisco IOS / NX-OS) first.',
        variant: 'destructive',
      })
      return
    }
    if (!SUPPORTED_NETWORK_DRIVERS.has(networkDriver)) {
      toast({
        title: 'Unsupported platform',
        description: `Network driver "${networkDriver}" is not supported. Use cisco_ios or cisco_nxos.`,
        variant: 'destructive',
      })
      return
    }

    const target = resolveTargetAddress()
    if (!target) {
      toast({
        title: 'Missing target',
        description: 'Enter a primary IP address or device name first.',
        variant: 'destructive',
      })
      return
    }

    resolvedAddressRef.current = target
    networkDriverRef.current = networkDriver
    setIsLoadingAgents(true)

    try {
      const response = await apiCall<AgentsSettingsResponse>('settings/agents')
      const allAgents = response?.data?.agents ?? []
      const filtered = allAgents.filter(a => a.type === 'ansible')

      if (filtered.length === 0) {
        toast({
          title: 'No Ansible agent configured',
          description: 'Add an Ansible agent in Settings → Connections → Agents.',
          variant: 'destructive',
        })
        return
      }

      if (filtered.length === 1) {
        const agent = filtered[0]!
        if (!agent.agent_id) {
          toast({
            title: 'Agent misconfigured',
            description: 'The Ansible agent has no agent_id set.',
            variant: 'destructive',
          })
          return
        }
        await handleAgentSelected(agent.agent_id, 'root')
        return
      }

      setAnsibleAgents(filtered)
      setShowAgentModal(true)
    } catch (err: unknown) {
      toast({
        title: 'Failed to load agents',
        description: err instanceof Error ? err.message : 'Could not fetch agent list',
        variant: 'destructive',
      })
    } finally {
      setIsLoadingAgents(false)
    }
  }, [resolveNetworkDriver, resolveTargetAddress, apiCall, toast, handleAgentSelected])

  const handleCloseModal = useCallback(() => {
    setShowAgentModal(false)
  }, [])

  return useMemo(
    () => ({
      showAgentModal,
      ansibleAgents,
      isLoadingAgents,
      isSendingCommand,
      handleGatherFacts,
      handleAgentSelected,
      handleCloseModal,
    }),
    [
      showAgentModal,
      ansibleAgents,
      isLoadingAgents,
      isSendingCommand,
      handleGatherFacts,
      handleAgentSelected,
      handleCloseModal,
    ]
  )
}
