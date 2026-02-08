import { Suspense } from 'react'
import { TemplatesPage } from '@/components/features/network/automation/templates/templates-page'

function TemplatesContent() {
  return <TemplatesPage />
}

export default function TemplatesRoute() {
  return (
    <Suspense fallback={<div className="p-4">Loading templates...</div>}>
      <TemplatesContent />
    </Suspense>
  )
}
