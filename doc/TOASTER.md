# Toaster notification system

This documents the toast notification system used in this app. Copy the files below into any Next.js app that uses the same tech stack (TypeScript, Tailwind CSS, Zustand, Lucide React) to get the same feature.

## How it works

Three pieces work together:

1. **`use-toast.ts`** — A Zustand store plus a `useToast()` hook. The store holds the list of active toasts. The hook exposes a `toast()` function that adds a message and auto-removes it after five seconds.
2. **`toaster.tsx`** — A client component that reads the Zustand store and renders the visible toasts in a fixed bottom-right overlay.
3. **`layout.tsx`** — Mounts `<Toaster />` once, globally, so toasts appear from anywhere in the app.

---

## Setup

### Step 1 — Copy the hook

Create `src/hooks/use-toast.ts`:

```ts
import { useCallback } from 'react'
import { create } from 'zustand'

interface ToastMessage {
  id: string
  title?: string
  description: string
  variant?: 'default' | 'destructive'
}

interface ToastStore {
  toasts: ToastMessage[]
  addToast: (toast: ToastMessage) => void
  removeToast: (id: string) => void
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  addToast: (toast) => set((state) => ({ toasts: [...state.toasts, toast] })),
  removeToast: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}))

export function useToast() {
  const { addToast, removeToast, toasts } = useToastStore()

  const toast = useCallback(({ title, description, variant = 'default' }: {
    title?: string
    description: string
    variant?: 'default' | 'destructive'
  }) => {
    const id = Math.random().toString(36).substr(2, 9)
    addToast({ id, title, description, variant })

    setTimeout(() => {
      removeToast(id)
    }, 5000)
  }, [addToast, removeToast])

  const dismiss = useCallback((id: string) => {
    removeToast(id)
  }, [removeToast])

  return { toast, dismiss, toasts }
}
```

### Step 2 — Copy the component

Create `src/components/ui/toaster.tsx`:

```tsx
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
```

### Step 3 — Mount the Toaster in the root layout

Add `<Toaster />` to `src/app/layout.tsx` so it's available globally. Place it inside the outermost provider but outside any route-specific layouts:

```tsx
import { Toaster } from '@/components/ui/toaster'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <Toaster />
      </body>
    </html>
  )
}
```

### Step 4 — Install dependencies

Make sure these packages are present:

```bash
npm install zustand lucide-react
```

---

## Usage

Call `useToast()` in any client component or custom hook.

### Success toast

```tsx
import { useToast } from '@/hooks/use-toast'

const { toast } = useToast()

toast({
  title: 'Saved',
  description: 'Your changes were saved successfully.',
})
```

### Error toast

```tsx
toast({
  title: 'Error',
  description: error.message,
  variant: 'destructive',
})
```

### Description only (no title)

```tsx
toast({ description: 'Copied to clipboard.' })
```

### Inside a TanStack Query mutation

The most common pattern — show a toast after a mutation succeeds or fails:

```tsx
const createItem = useMutation({
  mutationFn: (data) => apiCall('items', { method: 'POST', body: JSON.stringify(data) }),
  onSuccess: () => {
    toast({ title: 'Success', description: 'Item created.' })
  },
  onError: (error: Error) => {
    toast({ title: 'Error', description: error.message, variant: 'destructive' })
  },
})
```

---

## API reference

### `useToast()`

| Return value | Type | Description |
|---|---|---|
| `toast` | `(options) => void` | Shows a toast. Auto-dismisses after five seconds. |
| `dismiss` | `(id: string) => void` | Manually removes a toast by its ID. |
| `toasts` | `ToastMessage[]` | The current list of active toasts. |

### `toast()` options

| Option | Type | Default | Description |
|---|---|---|---|
| `description` | `string` | required | Main message text. |
| `title` | `string` | — | Bold heading above the description. |
| `variant` | `'default' \| 'destructive'` | `'default'` | Controls color and icon. `'destructive'` renders red with an alert icon. |

---

## Visual appearance

| Variant | Background | Border | Icon |
|---|---|---|---|
| `default` | White | Slate-200 | Green check circle |
| `destructive` | Red-50 | Red-200 | Red alert circle |

Toasts stack vertically in the bottom-right corner and disappear automatically after five seconds. Users can also dismiss individual toasts with the X button.
