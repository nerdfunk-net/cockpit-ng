'use client'

import { useCallback, useState } from 'react'
import { useApi } from '@/hooks/use-api'
import { useToast } from '@/hooks/use-toast'
import { useServerMutations } from '@/hooks/queries/use-server-mutations'
import { parseAnsibleFacts } from '../utils/parse-ansible-facts'
import { describeServerFactsChanges } from '../utils/describe-server-facts-changes'
import type { ServerResponse } from '../types'

interface CommandResponse {
  command_id: string
  status: string
  output: unknown
  error?: string
  execution_time_ms: number
}

interface CredentialPasswordResponse {
  password: string
}

export function useRefreshServerFacts(server: ServerResponse) {
  const { apiCall } = useApi()
  const { toast } = useToast()
  const { updateServer } = useServerMutations()
  const [isRefreshing, setIsRefreshing] = useState(false)

  const canRefreshFacts = Boolean(server.ansible_credentials?.agent_id)

  const refreshFacts = useCallback(async () => {
    const creds = server.ansible_credentials
    if (!creds?.agent_id) {
      toast({
        title: 'Cannot gather facts',
        description:
          'No stored Ansible connection settings for this server. Add the server again or restore credentials.',
        variant: 'destructive',
      })
      return
    }

    if (!creds.use_sshkey && !creds.credential_id) {
      toast({
        title: 'Cannot gather facts',
        description: 'Stored credentials are incomplete (missing credential ID).',
        variant: 'destructive',
      })
      return
    }

    setIsRefreshing(true)
    try {
      const params: Record<string, unknown> = {
        ip_address: creds.target,
        ansible_user: creds.ansible_user,
        use_sshkey: creds.use_sshkey,
      }

      if (!creds.use_sshkey && creds.credential_id != null) {
        const pwResp = await apiCall<CredentialPasswordResponse>(
          `credentials/${creds.credential_id}/password`
        )
        params.ansible_password = pwResp.password
      }

      const result = await apiCall<CommandResponse>('cockpit-agent/command', {
        method: 'POST',
        body: JSON.stringify({
          agent_id: creds.agent_id,
          command: 'get_facts',
          params,
          timeout: 60,
        }),
      })

      if (result.status !== 'success') {
        toast({
          title: 'Failed to gather facts',
          description: result.error ?? 'Unknown error from agent',
          variant: 'destructive',
        })
        return
      }

      const parsed = parseAnsibleFacts(result.output)
      const updated = await updateServer.mutateAsync({
        id: server.id,
        data: {
          hostname: parsed.hostname || server.hostname,
          os_family: parsed.os_family || null,
          processor_count: parsed.processor_count,
          memtotal_mb: parsed.memtotal_mb,
          architecture: parsed.architecture || null,
          distribution_release: parsed.distribution_release || null,
          distribution_version: parsed.distribution_version || null,
          primary_ipv4: parsed.primary_ipv4 || null,
          primary_interface: parsed.primary_interface || null,
          disk_count: parsed.disk_count,
          is_virtual: parsed.is_virtual,
          ansible_facts: parsed.ansible_facts,
        },
      })

      const changes = describeServerFactsChanges(server, updated)
      if (changes.length > 0) {
        toast({
          title: 'Facts updated',
          description: changes.join('\n'),
        })
      } else {
        toast({
          title: 'Facts refreshed',
          description: 'No changes detected compared to the previous data.',
        })
      }
    } catch (err: unknown) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'An unexpected error occurred',
        variant: 'destructive',
      })
    } finally {
      setIsRefreshing(false)
    }
  }, [apiCall, server, toast, updateServer])

  return {
    refreshFacts,
    isRefreshing,
    canRefreshFacts,
  }
}
