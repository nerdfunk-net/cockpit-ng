import { useState, useCallback } from 'react'

interface ToastMessage {
  id: string
  title?: string
  description: string
  variant?: 'default' | 'destructive'
}

export function useToast() {
  const [toasts, setToasts] = useState<ToastMessage[]>([])

  const toast = useCallback(({ title, description, variant = 'default' }: {
    title?: string
    description: string
    variant?: 'default' | 'destructive'
  }) => {
    const id = Math.random().toString(36).substr(2, 9)
    const newToast: ToastMessage = { id, title, description, variant }
    
    setToasts(prev => [...prev, newToast])
    
    // Auto remove after 3 seconds
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 3000)
  }, [])

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  return { toast, dismiss, toasts }
}
