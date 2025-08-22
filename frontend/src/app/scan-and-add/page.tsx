import { Suspense } from 'react'
import { DashboardLayout } from '@/components/dashboard-layout'
import { ScanAndAddPage } from '@/components/scan-and-add/scan-and-add-page'

export default function ScanAndAddRoute() {
  return (
    <DashboardLayout>
      <Suspense fallback={<div>Loading...</div>}>
        <ScanAndAddPage />
      </Suspense>
    </DashboardLayout>
  )
}
