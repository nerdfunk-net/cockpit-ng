import { Suspense } from 'react'
import { DashboardLayout } from '@/components/dashboard-layout'
import { CheckMKSyncDevicesPage } from '@/components/checkmk/sync-devices-page'

export default function CheckMKSyncDevicesRoute() {
  return (
    <DashboardLayout>
      <Suspense fallback={<div className="p-4">Loading CheckMK sync devices...</div>}>
        <CheckMKSyncDevicesPage />
      </Suspense>
    </DashboardLayout>
  )
}