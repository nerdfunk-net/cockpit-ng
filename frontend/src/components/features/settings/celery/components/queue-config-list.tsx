'use client'

import { useState, useCallback } from 'react'
import { Plus, Trash2, Edit2, List, Shield } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Alert, AlertDescription } from '@/components/ui/alert'
import type { CeleryQueue } from '../types'

interface QueueConfigListProps {
  queues: CeleryQueue[]
  onChange: (queues: CeleryQueue[]) => void
}

export function QueueConfigList({ queues, onChange }: QueueConfigListProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [formData, setFormData] = useState<CeleryQueue>({ name: '', description: '', built_in: false })
  const [error, setError] = useState<string>('')

  const handleOpenDialog = useCallback((index: number | null = null) => {
    if (index !== null && queues[index]) {
      setEditingIndex(index)
      setFormData(queues[index])
    } else {
      setEditingIndex(null)
      setFormData({ name: '', description: '', built_in: false })
    }
    setError('')
    setIsDialogOpen(true)
  }, [queues])

  const handleCloseDialog = useCallback(() => {
    setIsDialogOpen(false)
    setEditingIndex(null)
    setFormData({ name: '', description: '', built_in: false })
    setError('')
  }, [])

  const validateQueue = useCallback((queue: CeleryQueue): string | null => {
    if (!queue.name.trim()) {
      return 'Queue name is required'
    }

    // Check for valid queue name format (alphanumeric, dash, underscore)
    if (!/^[a-z0-9_-]+$/i.test(queue.name)) {
      return 'Queue name must contain only letters, numbers, dashes, and underscores'
    }

    // Check for duplicate names (exclude current item if editing)
    const isDuplicate = queues.some(
      (q, idx) =>
        q.name.toLowerCase() === queue.name.toLowerCase() &&
        idx !== editingIndex
    )
    if (isDuplicate) {
      return 'Queue name already exists'
    }

    return null
  }, [queues, editingIndex])

  const handleSave = useCallback(() => {
    const validationError = validateQueue(formData)
    if (validationError) {
      setError(validationError)
      return
    }

    const updatedQueues = [...queues]
    if (editingIndex !== null) {
      updatedQueues[editingIndex] = formData
    } else {
      updatedQueues.push(formData)
    }

    onChange(updatedQueues)
    handleCloseDialog()
  }, [formData, queues, editingIndex, validateQueue, onChange, handleCloseDialog])

  const handleDelete = useCallback((index: number) => {
    // Prevent deletion of built-in queues
    if (queues[index]?.built_in) {
      setError(`Built-in queue "${queues[index]?.name}" cannot be deleted`)
      return
    }
    const updatedQueues = queues.filter((_, i) => i !== index)
    onChange(updatedQueues)
  }, [queues, onChange])

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <List className="h-5 w-5 text-purple-500" />
          <div className="flex-1">
            <CardTitle>Queue Configuration</CardTitle>
            <CardDescription>
              Configure Celery queues for job routing and workload distribution
            </CardDescription>
          </div>
          <Button onClick={() => handleOpenDialog()} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Add Queue
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Alert className="mb-4 bg-blue-50 border-blue-200">
          <AlertDescription className="text-blue-800 text-sm">
            <strong>Queue System:</strong> Built-in queues (default, backup, network, heavy) are hardcoded with automatic task routing and cannot be deleted.
            Custom queues can be added here for documentation. To use custom queues, configure the CELERY_WORKER_QUEUE environment variable in docker-compose.yml
            (e.g., CELERY_WORKER_QUEUE=monitoring) and manually route tasks to them.
          </AlertDescription>
        </Alert>

        {queues.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <List className="h-12 w-12 mx-auto mb-2 opacity-20" />
            <p>No queues configured</p>
            <p className="text-sm mt-1">Add a queue to get started</p>
          </div>
        ) : (
          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Queue Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {queues.map((queue, index) => {
                  const isBuiltIn = queue.built_in === true
                  return (
                    <TableRow key={queue.name}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-medium">{queue.name}</span>
                          {isBuiltIn && (
                            <Badge variant="secondary" className="text-xs">
                              <Shield className="h-3 w-3 mr-1" />
                              Built-in
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{queue.description || '-'}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenDialog(index)}
                            title={isBuiltIn ? 'Edit description only' : 'Edit queue'}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          {!isBuiltIn && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(index)}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              title="Delete queue"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}

        <Dialog open={isDialogOpen} onOpenChange={handleCloseDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingIndex !== null ? 'Edit Queue' : 'Add Queue'}</DialogTitle>
              <DialogDescription>
                {editingIndex !== null
                  ? 'Update the queue configuration'
                  : 'Add a new queue for job routing'}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="queue-name">Queue Name *</Label>
                <Input
                  id="queue-name"
                  placeholder="e.g., monitoring, custom"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className={error ? 'border-red-500' : ''}
                  disabled={editingIndex !== null && queues[editingIndex]?.built_in === true}
                />
                {editingIndex !== null && queues[editingIndex]?.built_in === true ? (
                  <p className="text-xs text-muted-foreground text-amber-600">
                    Built-in queue names cannot be changed
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Alphanumeric characters, dashes, and underscores only
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="queue-description">Description</Label>
                <Input
                  id="queue-description"
                  placeholder="e.g., Queue for device configuration backups"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>

              {error && (
                <Alert className="bg-red-50 border-red-200">
                  <AlertDescription className="text-red-800">{error}</AlertDescription>
                </Alert>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleCloseDialog}>
                Cancel
              </Button>
              <Button onClick={handleSave}>
                {editingIndex !== null ? 'Update' : 'Add'} Queue
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  )
}
