import { Suspense } from 'react'
import { JobsViewPage } from "@/components/features/jobs/view/jobs-view-page"

export default function ViewJobsPage() {
  return (
    <Suspense>
      <JobsViewPage />
    </Suspense>
  )
}
