'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { RefreshCw } from 'lucide-react'
import { useCeleryWorkers } from '../hooks/use-celery-queries'
import type { WorkerStats } from '../types'

export function CeleryWorkersList() {
  const { data: workers, isLoading, refetch } = useCeleryWorkers()

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Celery Workers</CardTitle>
            <CardDescription>Active worker processes and their statistics</CardDescription>
          </div>
          <Button onClick={() => refetch()} variant="outline" size="sm" disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {workers?.stats && Object.keys(workers.stats).length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Worker Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Max Concurrency</TableHead>
                <TableHead>Pool</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Object.entries(workers.stats).map(([name, stats]: [string, unknown]) => {
                const workerStats = stats as WorkerStats | undefined
                const pool = workerStats?.pool
                return (
                  <TableRow key={name}>
                    <TableCell className="font-mono text-sm">{name}</TableCell>
                    <TableCell>
                      <Badge variant="default">Active</Badge>
                    </TableCell>
                    <TableCell>{String(pool?.['max-concurrency'] ?? 'N/A')}</TableCell>
                    <TableCell>{String(pool?.implementation || 'N/A')}</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        ) : (
          <p className="text-center text-muted-foreground py-8">No workers found</p>
        )}
      </CardContent>
    </Card>
  )
}
