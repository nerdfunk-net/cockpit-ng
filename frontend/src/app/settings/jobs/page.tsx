import { Suspense } from 'react'
import { JobsManagementPage } from '@/components/settings/jobs-management'

export default function SettingsJobsRoute() {
  return (
    <Suspense fallback={<div className="p-4">Loading background jobs...</div>}>
      <JobsManagementPage />
    </Suspense>
  )
}