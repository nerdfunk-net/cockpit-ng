'use client'

import { useCallback, useState } from 'react'
import { useApi } from '@/hooks/use-api'
import { useToast } from '@/hooks/use-toast'
import { useServerMutations } from '@/hooks/queries/use-server-mutations'
import type { PortBinding, ServerResponse } from '../types'

interface CommandResponse {
  command_id: string
  status: string
  output: unknown
  error?: string
  execution_time_ms: number
}

interface OpenPortsOutput {
  tcp_ports?: PortBinding[]
  udp_ports?: PortBinding[]
}

interface CredentialPasswordResponse {
  password: string
}

export function useRefreshServerOpenPorts(server: ServerResponse) {
  const { apiCall } = useApi()
  const { toast } = useToast()
  const { updateServer } = useServerMutations()
  const [isScanning, setIsScanning] = useState(false)

  const canScanOpenPorts = Boolean(server.ansible_credentials?.agent_id)

  const scanOpenPorts = useCallback(async () => {
    const creds = server.ansible_credentials
    if (!creds?.agent_id) {
      toast({
        title: 'Cannot scan open ports',
        description:
          'No stored Ansible connection settings for this server. Add the server again or restore credentials.',
        variant: 'destructive',
      })
      return
    }

    if (!creds.use_sshkey && !creds.credential_id) {
      toast({
        title: 'Cannot scan open ports',
        description: 'Stored credentials are incomplete (missing credential ID).',
        variant: 'destructive',
      })
      return
    }

    setIsScanning(true)
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
          command: 'get_open_ports',
          params,
          timeout: 60,
        }),
      })

      if (result.status !== 'success') {
        toast({
          title: 'Failed to scan open ports',
          description: result.error ?? 'Unknown error from agent',
          variant: 'destructive',
        })
        return
      }

      const output = (result.output ?? {}) as OpenPortsOutput
      const tcpPorts = output.tcp_ports ?? []
      const udpPorts = output.udp_ports ?? []

      await updateServer.mutateAsync({
        id: server.id,
        data: {
          open_ports: { tcp_ports: tcpPorts, udp_ports: udpPorts },
        },
      })

      toast({
        title: 'Open ports updated',
        description: `Found ${tcpPorts.length} TCP and ${udpPorts.length} UDP open port(s).`,
      })
    } catch (err: unknown) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'An unexpected error occurred',
        variant: 'destructive',
      })
    } finally {
      setIsScanning(false)
    }
  }, [apiCall, server, toast, updateServer])

  return {
    scanOpenPorts,
    isScanning,
    canScanOpenPorts,
  }
}
