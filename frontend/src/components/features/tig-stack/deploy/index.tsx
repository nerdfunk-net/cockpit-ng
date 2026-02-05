'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Rocket } from 'lucide-react'

export function TigDeployPage() {
  return (
    <div className="container mx-auto py-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Rocket className="h-6 w-6" />
            TIG-Stack Deployment
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            TIG-Stack deployment functionality coming soon.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
