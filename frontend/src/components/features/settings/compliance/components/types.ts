export interface OpenConfirmOptions {
  title: string
  description: string
  onConfirm: () => void
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'default' | 'destructive'
}

export type OpenConfirmFn = (options: OpenConfirmOptions) => void
