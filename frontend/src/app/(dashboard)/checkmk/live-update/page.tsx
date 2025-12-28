import { Suspense } from 'react'
import LiveUpdatePage from '@/components/features/checkmk/live-update/live-update-page'

export default function LiveUpdate() {
  return <Suspense fallback={<div className="p-4">Loading Live Update...</div>}>
        <LiveUpdatePage />
      </Suspense>
}