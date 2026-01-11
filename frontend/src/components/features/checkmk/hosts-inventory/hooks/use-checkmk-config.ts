import { useState, useCallback } from 'react'
import { useApi } from '@/hooks/use-api'
import type { CheckMKConfig } from '@/types/checkmk/types'

interface UseCheckmkConfigReturn {
  checkmkConfig: CheckMKConfig | null
  loadCheckmkConfig: () => Promise<void>
}

export function useCheckmkConfig(): UseCheckmkConfigReturn {
  const { apiCall } = useApi()
  const [checkmkConfig, setCheckmkConfig] = useState<CheckMKConfig | null>(null)

  const loadCheckmkConfig = useCallback(async () => {
    try {
      const config = await apiCall<Record<string, unknown>>('config/checkmk.yaml')
      setCheckmkConfig(config || null)
    } catch (err) {
      console.error('Failed to load CheckMK config:', err)
      // Continue without config
      setCheckmkConfig(null)
    }
  }, [apiCall])

  return {
    checkmkConfig,
    loadCheckmkConfig,
  }
}
