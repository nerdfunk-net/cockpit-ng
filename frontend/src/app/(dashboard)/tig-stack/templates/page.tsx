'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FileText } from 'lucide-react'

export default function TigStackTemplatesRoute() {
  const router = useRouter()

  useEffect(() => {
    // Redirect to settings templates page with TIG-Stack category filter
    router.push('/settings/templates?category=tig-stack')
  }, [router])

  return (
    <div className="container mx-auto py-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-6 w-6" />
            TIG-Stack Templates
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Redirecting to templates management...
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
