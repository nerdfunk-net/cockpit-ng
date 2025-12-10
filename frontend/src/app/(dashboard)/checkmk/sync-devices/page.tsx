import { Suspense } from 'react'
import { CheckMKSyncDevicesPage } from '@/components/checkmk/sync-devices-page'

export default function CheckMKSyncDevicesRoute() {
  return <Suspense fallback={<div className="p-4">Loading CheckMK sync devices...</div>}>
        <CheckMKSyncDevicesPage />
      </Suspense>
}