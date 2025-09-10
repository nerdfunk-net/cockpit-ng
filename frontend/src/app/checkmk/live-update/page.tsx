import { Suspense } from 'react'
import { DashboardLayout } from '@/components/dashboard-layout'
import LiveUpdatePage from '@/components/checkmk/live-update-page'

export default function LiveUpdate() {
  return (
    <DashboardLayout>
      <Suspense fallback={<div className="p-4">Loading Live Update...</div>}>
        <LiveUpdatePage />
      </Suspense>
    </DashboardLayout>
  )
}