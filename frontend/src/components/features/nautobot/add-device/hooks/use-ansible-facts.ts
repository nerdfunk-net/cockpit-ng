'use client'

import { useState, useRef, useCallback, useMemo } from 'react'
import type { UseFormReturn } from 'react-hook-form'
import { useApi } from '@/hooks/use-api'
import { useToast } from '@/hooks/use-toast'
import type { Agent } from '@/components/features/settings/connections/agents/types'
import type { DeviceFormValues } from '../utils/validation'

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

export function useAnsibleFacts(form: UseFormReturn<DeviceFormValues>): AnsibleFactsHook {
  const { apiCall } = useApi()
  const { toast } = useToast()

  const [showAgentModal, setShowAgentModal] = useState(false)
  const [ansibleAgents, setAnsibleAgents] = useState<Agent[]>(EMPTY_AGENTS)
  const [isLoadingAgents, setIsLoadingAgents] = useState(false)
  const [isSendingCommand, setIsSendingCommand] = useState(false)

  const resolvedAddressRef = useRef<string>('')

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

  const handleAgentSelected = useCallback(
    async (agentId: string, ansibleUser: string) => {
      setShowAgentModal(false)
      const target = resolvedAddressRef.current
      if (!target) return

      setIsSendingCommand(true)
      try {
        const result = await apiCall<CommandResponse>('cockpit-agent/command', {
          method: 'POST',
          body: JSON.stringify({
            agent_id: agentId,
            command: 'get_facts',
            params: {
              ip_address: target,
              ansible_user: ansibleUser,
              use_sshkey: true,
            },
            timeout: 60,
          }),
        })

        if (result.status === 'success') {
          toast({
            title: 'Facts gathered',
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
  }, [resolveTargetAddress, apiCall, toast, handleAgentSelected])

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
