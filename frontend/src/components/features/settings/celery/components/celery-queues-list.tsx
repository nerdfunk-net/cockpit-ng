'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { RefreshCw, Layers, Users, Clock, AlertCircle, Eraser } from 'lucide-react'
import { useCeleryQueues } from '../hooks/use-celery-queries'
import { useCeleryMutations } from '../hooks/use-celery-mutations'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { useState } from 'react'

export function CeleryQueuesList() {
  const { data: queues, isLoading, refetch } = useCeleryQueues()
  const { purgeQueue, purgeAllQueues } = useCeleryMutations()
  const [purgingQueue, setPurgingQueue] = useState<string | null>(null)
  const [purgingAll, setPurgingAll] = useState(false)
  const [purgeDialogOpen, setPurgeDialogOpen] = useState<string | null>(null)
  const [purgeAllDialogOpen, setPurgeAllDialogOpen] = useState(false)

  const handlePurgeQueue = async (queueName: string) => {
    setPurgingQueue(queueName)
    try {
      await purgeQueue.mutateAsync(queueName)
      await refetch()
      setPurgeDialogOpen(null)
    } finally {
      setPurgingQueue(null)
    }
  }

  const handlePurgeAllQueues = async () => {
    setPurgingAll(true)
    try {
      await purgeAllQueues.mutateAsync()
      await refetch()
      setPurgeAllDialogOpen(false)
    } finally {
      setPurgingAll(false)
    }
  }

  const totalPendingTasks = queues?.reduce((sum, q) => sum + q.pending_tasks, 0) || 0

  // Queue color coding based on usage
  const getQueueVariant = (pendingTasks: number, workerCount: number): 'default' | 'secondary' | 'destructive' | 'outline' => {
    if (workerCount === 0 && pendingTasks > 0) return 'destructive' // No workers but tasks waiting
    if (pendingTasks > 10) return 'default' // High load
    if (pendingTasks > 0) return 'secondary' // Some tasks
    return 'outline' // Idle
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Celery Queues</CardTitle>
            <CardDescription>
              Queue metrics, task routing, and worker assignments
            </CardDescription>
          </div>
          <Button onClick={() => refetch()} variant="outline" size="sm" disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {queues && queues.length > 0 ? (
          <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Layers className="h-4 w-4 text-blue-600" />
                    Total Queues
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{queues.length}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-orange-600" />
                      Pending Tasks
                    </div>
                    <TooltipProvider>
                      <Tooltip>
                        <AlertDialog open={purgeAllDialogOpen} onOpenChange={setPurgeAllDialogOpen}>
                          <TooltipTrigger asChild>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={totalPendingTasks === 0 || purgingAll}
                                className="h-6 w-6 p-0"
                              >
                                <Eraser className="h-3.5 w-3.5 text-orange-600" />
                              </Button>
                            </AlertDialogTrigger>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Clear all pending tasks from all queues</p>
                          </TooltipContent>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Purge All Queues</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to purge all {totalPendingTasks} pending task(s) from all queues?
                                <br />
                                <br />
                                <strong>This action cannot be undone.</strong> Only pending tasks will be removed; running tasks will not be affected.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={(e) => {
                                  e.preventDefault()
                                  handlePurgeAllQueues()
                                }}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Purge All Queues
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </Tooltip>
                    </TooltipProvider>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {totalPendingTasks}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Users className="h-4 w-4 text-green-600" />
                    Active Workers
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {new Set(queues.flatMap(q => q.workers_consuming)).size}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-red-600" />
                    Unassigned
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {queues.filter(q => q.worker_count === 0).length}
                  </div>
                  <p className="text-xs text-muted-foreground">Queues without workers</p>
                </CardContent>
              </Card>
            </div>

            {/* Queue Table */}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Queue Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Pending</TableHead>
                  <TableHead className="text-right">Active</TableHead>
                  <TableHead>Workers</TableHead>
                  <TableHead>Routed Tasks</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {queues.map((queue) => (
                  <TableRow key={queue.name}>
                    <TableCell>
                      <div>
                        <div className="font-mono text-sm font-medium">{queue.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {queue.routing_key}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getQueueVariant(queue.pending_tasks, queue.worker_count)}>
                        {queue.worker_count === 0 && queue.pending_tasks > 0
                          ? 'No Workers'
                          : queue.pending_tasks > 10
                          ? 'High Load'
                          : queue.pending_tasks > 0
                          ? 'Active'
                          : 'Idle'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={queue.pending_tasks > 0 ? 'font-bold text-orange-600' : ''}>
                        {queue.pending_tasks}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={queue.active_tasks > 0 ? 'font-bold text-blue-600' : ''}>
                        {queue.active_tasks}
                      </span>
                    </TableCell>
                    <TableCell>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">
                                {queue.worker_count} worker{queue.worker_count !== 1 ? 's' : ''}
                              </Badge>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <div className="space-y-1">
                              {queue.workers_consuming.length > 0 ? (
                                queue.workers_consuming.map((worker) => (
                                  <div key={worker} className="font-mono text-xs">
                                    {worker}
                                  </div>
                                ))
                              ) : (
                                <div className="text-xs text-muted-foreground">No workers assigned</div>
                              )}
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </TableCell>
                    <TableCell>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge variant="secondary">
                              {queue.routed_tasks.length} task type{queue.routed_tasks.length !== 1 ? 's' : ''}
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent>
                            <div className="space-y-1 max-w-md">
                              {queue.routed_tasks.length > 0 ? (
                                queue.routed_tasks.map((task) => (
                                  <div key={task} className="font-mono text-xs">
                                    {task}
                                  </div>
                                ))
                              ) : (
                                <div className="text-xs text-muted-foreground">No tasks routed</div>
                              )}
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </TableCell>
                    <TableCell className="text-right">
                      <TooltipProvider>
                        <Tooltip>
                          <AlertDialog open={purgeDialogOpen === queue.name} onOpenChange={(open) => setPurgeDialogOpen(open ? queue.name : null)}>
                            <TooltipTrigger asChild>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  disabled={queue.pending_tasks === 0 || purgingQueue === queue.name}
                                  className="h-8 w-8 p-0"
                                >
                                  <Eraser className="h-4 w-4 text-orange-600" />
                                </Button>
                              </AlertDialogTrigger>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Clear all pending tasks from this queue</p>
                            </TooltipContent>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Purge Queue: {queue.name}</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to purge all {queue.pending_tasks} pending task(s) from the &quot;{queue.name}&quot; queue?
                                  <br />
                                  <br />
                                  <strong>This action cannot be undone.</strong> Only pending tasks will be removed; running tasks will not be affected.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={(e) => {
                                    e.preventDefault()
                                    handlePurgeQueue(queue.name)
                                  }}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Purge Queue
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </Tooltip>
                      </TooltipProvider>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {/* Queue Details Legend */}
            <div className="flex items-center gap-4 text-sm text-muted-foreground pt-4 border-t">
              <div className="flex items-center gap-2">
                <Badge variant="outline">Idle</Badge>
                <span>No pending tasks</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">Active</Badge>
                <span>1-10 pending</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="default">High Load</Badge>
                <span>10+ pending</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="destructive">No Workers</Badge>
                <span>Tasks waiting, no workers</span>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-center text-muted-foreground py-8">No queues configured</p>
        )}
      </CardContent>
    </Card>
  )
}
