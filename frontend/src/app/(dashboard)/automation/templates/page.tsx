'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Redirect old netmiko templates route to the new unified templates list.
 * This maintains backwards compatibility for any bookmarked links.
 */
export default function TemplatesRedirect() {
  const router = useRouter()
  
  useEffect(() => {
    router.replace('/settings/templates?category=netmiko')
  }, [router])
  
  return (
    <div className="flex items-center justify-center h-screen">
      <p className="text-gray-600">Redirecting to Templates...</p>
    </div>
  )
}
