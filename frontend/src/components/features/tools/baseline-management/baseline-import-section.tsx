'use client'

import { useCallback, useState } from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Upload, Loader2 } from 'lucide-react'
import { useAuthStore } from '@/lib/auth-store'
import { useToast } from '@/hooks/use-toast'

export default function BaselineImportSection() {
  const { token } = useAuthStore()
  const { toast } = useToast()
  const [isImporting, setIsImporting] = useState(false)

  const handleImportBaseline = useCallback(async () => {
    setIsImporting(true)
    try {
      if (!token) {
        throw new Error('Not authenticated')
      }

      const response = await fetch('/api/proxy/tools/tests-baseline', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(
          typeof data.detail === 'string'
            ? data.detail
            : 'Failed to import test baseline'
        )
      }

      const created = data.created || {}
      const counts = Object.entries(created)
        .filter(([, count]) => typeof count === 'number' && count > 0)
        .map(([resource, count]) => `${count as number} ${resource}`)
        .join(', ')

      toast({
        title: 'Test baseline imported',
        description: counts
          ? `Created: ${counts}`
          : 'Test baseline imported successfully',
      })
    } catch (error) {
      toast({
        title: 'Import failed',
        description:
          error instanceof Error ? error.message : 'Failed to import test baseline',
        variant: 'destructive',
      })
    } finally {
      setIsImporting(false)
    }
  }, [token, toast])

  return (
    <Card className="shadow-sm border-emerald-100">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="w-5 h-5 text-emerald-600" />
          Import test baseline
        </CardTitle>
        <CardDescription>
          Load YAML from{' '}
          <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">
            contributing-data/tests_baseline/
          </code>{' '}
          into Nautobot (location types, locations, roles, devices, cluster types,
          cluster groups, clusters, and virtual machines). Existing objects are skipped.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button
          onClick={handleImportBaseline}
          disabled={isImporting}
          className="bg-emerald-600 hover:bg-emerald-700 text-white"
        >
          {isImporting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Importing...
            </>
          ) : (
            <>
              <Upload className="w-4 h-4 mr-2" />
              Import into Nautobot
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  )
}
