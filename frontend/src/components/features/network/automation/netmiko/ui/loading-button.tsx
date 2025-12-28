import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'
import type { ReactNode } from 'react'

interface LoadingButtonProps {
  isLoading: boolean
  onClick?: () => void
  disabled?: boolean
  children: ReactNode
  loadingText?: string
  className?: string
  size?: 'default' | 'sm' | 'lg' | 'icon'
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link'
  icon?: ReactNode
}

export function LoadingButton({
  isLoading,
  onClick,
  disabled,
  children,
  loadingText,
  className,
  size,
  variant,
  icon,
}: LoadingButtonProps) {
  return (
    <Button
      onClick={onClick}
      disabled={disabled || isLoading}
      className={className}
      size={size}
      variant={variant}
    >
      {isLoading ? (
        <>
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          {loadingText || 'Loading...'}
        </>
      ) : (
        <>
          {icon && <span className="mr-2">{icon}</span>}
          {children}
        </>
      )}
    </Button>
  )
}
