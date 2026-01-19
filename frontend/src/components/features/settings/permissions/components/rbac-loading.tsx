interface RBACLoadingProps {
  message?: string
}

export function RBACLoading({ message = 'Loading...' }: RBACLoadingProps) {
  return (
    <div className="text-center py-8">
      <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-2" />
      <p className="text-muted-foreground">{message}</p>
    </div>
  )
}
