import { useState, useCallback, useMemo } from 'react'

interface ConfirmOptions {
  title: string
  description: string
  onConfirm: () => void
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'default' | 'destructive'
}

interface ConfirmDialogState {
  open: boolean
  title: string
  description: string
  onConfirm: () => void
  confirmLabel: string
  cancelLabel: string
  variant: 'default' | 'destructive'
}

const CLOSED_STATE: ConfirmDialogState = {
  open: false,
  title: '',
  description: '',
  onConfirm: () => {},
  confirmLabel: 'Confirm',
  cancelLabel: 'Cancel',
  variant: 'default',
}

/**
 * Hook for managing a confirm dialog state.
 *
 * Usage:
 * ```tsx
 * const { confirmDialog, openConfirm } = useConfirmDialog()
 *
 * const handleDelete = () => openConfirm({
 *   title: 'Delete item',
 *   description: 'Are you sure?',
 *   onConfirm: () => deleteItem.mutate(id),
 *   variant: 'destructive',
 * })
 *
 * return (
 *   <>
 *     <Button onClick={handleDelete}>Delete</Button>
 *     <ConfirmDialog {...confirmDialog} onCancel={closeConfirm} />
 *   </>
 * )
 * ```
 */
export function useConfirmDialog() {
  const [state, setState] = useState<ConfirmDialogState>(CLOSED_STATE)

  const openConfirm = useCallback((options: ConfirmOptions) => {
    setState({
      open: true,
      title: options.title,
      description: options.description,
      onConfirm: options.onConfirm,
      confirmLabel: options.confirmLabel ?? 'Confirm',
      cancelLabel: options.cancelLabel ?? 'Cancel',
      variant: options.variant ?? 'default',
    })
  }, [])

  const closeConfirm = useCallback(() => {
    setState(CLOSED_STATE)
  }, [])

  const confirmDialog = useMemo(
    () => ({
      open: state.open,
      title: state.title,
      description: state.description,
      onConfirm: () => {
        state.onConfirm()
        closeConfirm()
      },
      onCancel: closeConfirm,
      confirmLabel: state.confirmLabel,
      cancelLabel: state.cancelLabel,
      variant: state.variant,
    }),
    [state, closeConfirm]
  )

  return useMemo(
    () => ({ confirmDialog, openConfirm, closeConfirm }),
    [confirmDialog, openConfirm, closeConfirm]
  )
}
