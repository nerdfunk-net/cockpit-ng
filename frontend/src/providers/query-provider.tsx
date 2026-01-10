'use client'

import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { getQueryClient, setToastFunction } from '@/lib/query-client'
import { useToast } from '@/hooks/use-toast'
import { useEffect } from 'react'

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const queryClient = getQueryClient()
  const { toast } = useToast()

  // Inject toast function into query client
  useEffect(() => {
    setToastFunction(toast)
  }, [toast])

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  )
}
