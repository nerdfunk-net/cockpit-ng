import { Suspense } from 'react'
import { DashboardLayout } from '@/components/dashboard-layout'
import { CheckMKJobsPage } from '@/components/checkmk/jobs-page'

export default function CheckMKJobsRoute() {
  return (
    <DashboardLayout>
      <Suspense fallback={<div className="p-4">Loading CheckMK jobs...</div>}>
        <CheckMKJobsPage />
      </Suspense>
    </DashboardLayout>
  )
}