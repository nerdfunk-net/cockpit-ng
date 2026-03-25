'use client'

import { X, CheckCircle2, AlertCircle } from 'lucide-react'
import { useToastStore } from '@/hooks/use-toast'

export function Toaster() {
  const { toasts, removeToast } = useToastStore()

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 max-w-sm w-full">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`flex items-start gap-3 rounded-lg border px-4 py-3 shadow-lg text-sm transition-all
            ${t.variant === 'destructive'
              ? 'bg-red-50 border-red-200 text-red-900'
              : 'bg-white border-slate-200 text-slate-900'
            }`}
        >
          <div className="mt-0.5 shrink-0">
            {t.variant === 'destructive'
              ? <AlertCircle className="h-4 w-4 text-red-500" />
              : <CheckCircle2 className="h-4 w-4 text-green-500" />
            }
          </div>
          <div className="flex-1 min-w-0">
            {t.title && <p className="font-semibold leading-snug">{t.title}</p>}
            <p className={`leading-snug whitespace-pre-wrap break-words ${t.title ? 'mt-0.5 text-xs opacity-80' : ''}`}>
              {t.description}
            </p>
          </div>
          <button
            onClick={() => removeToast(t.id)}
            className="shrink-0 opacity-50 hover:opacity-100 transition-opacity"
            aria-label="Dismiss"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  )
}
