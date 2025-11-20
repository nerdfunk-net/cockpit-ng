import { Suspense } from 'react'
import { ScanAndAddPage } from '@/components/scan-and-add/scan-and-add-page'

export default function ScanAndAddRoute() {
  return <Suspense fallback={<div>Loading...</div>}>
        <ScanAndAddPage />
      </Suspense>
}
