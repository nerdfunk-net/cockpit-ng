import { Suspense } from 'react'
import LiveUpdatePage from '@/components/checkmk/live-update-page'

export default function LiveUpdate() {
  return <Suspense fallback={<div className="p-4">Loading Live Update...</div>}>
        <LiveUpdatePage />
      </Suspense>
}