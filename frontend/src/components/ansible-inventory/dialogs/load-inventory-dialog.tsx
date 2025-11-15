/**
 * Load Inventory Dialog Component
 */

import { useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { LogicalCondition, ApiCallType } from '../types'

type SavedInventoriesType = ReturnType<typeof import('../hooks').useSavedInventories>

interface LoadInventoryDialogProps {
  show: boolean
  onClose: () => void
  savedInventories: SavedInventoriesType
  apiCall: ApiCallType
  onLoad: (conditions: LogicalCondition[]) => void
}

export function LoadInventoryDialog({
  show,
  onClose,
  savedInventories,
  apiCall,
  onLoad,
}: LoadInventoryDialogProps) {
  const {
    inventoryRepositories,
    selectedInventoryRepo,
    savedInventories: inventoryList,
    isLoadingInventories,
    setSelectedInventoryRepo,
    setInventoryRepositories,
    setSavedInventories,
    setIsLoadingInventories,
  } = savedInventories

  useEffect(() => {
    if (show) {
      loadRepositories()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show])

  const loadRepositories = async () => {
    try {
      const response = await apiCall<{
        repositories: Array<{id: number, name: string, url: string, branch: string, category: string}>
        total: number
      }>('git-repositories?category=inventory')
      
      setInventoryRepositories(response.repositories)
      if (response.repositories.length > 0) {
        const firstRepoId = response.repositories[0].id
        setSelectedInventoryRepo(firstRepoId)
        await loadInventories(firstRepoId)
      }
    } catch (error) {
      console.error('Error loading repositories:', error)
    }
  }

  const loadInventories = async (repositoryId: number) => {
    setIsLoadingInventories(true)
    try {
      const response = await apiCall<{
        inventories: Array<{
          name: string
          description?: string
          conditions: LogicalCondition[]
          created_at?: string
          updated_at?: string
        }>
        total: number
      }>(`ansible-inventory/list-inventories?repository_id=${repositoryId}`)
      
      setSavedInventories(response.inventories)
    } catch (error) {
      console.error('Error loading inventories:', error)
      setSavedInventories([])
    } finally {
      setIsLoadingInventories(false)
    }
  }

  const handleLoad = async (inventoryName: string) => {
    if (!selectedInventoryRepo) return

    try {
      const response = await apiCall<{
        name: string
        description?: string
        conditions: LogicalCondition[]
        created_at?: string
        updated_at?: string
      }>(`ansible-inventory/load-inventory/${encodeURIComponent(inventoryName)}?repository_id=${selectedInventoryRepo}`)

      onLoad(response.conditions)
      onClose()
      alert(`Inventory "${inventoryName}" loaded successfully!`)
    } catch (error) {
      alert('Error loading inventory: ' + (error as Error).message)
    }
  }

  return (
    <Dialog open={show} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Load Inventory Configuration</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label>Repository</Label>
            <Select 
              value={selectedInventoryRepo?.toString() || ''} 
              onValueChange={(value) => {
                const repoId = parseInt(value)
                setSelectedInventoryRepo(repoId)
                loadInventories(repoId)
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a repository..." />
              </SelectTrigger>
              <SelectContent>
                {inventoryRepositories.map(repo => (
                  <SelectItem key={repo.id} value={repo.id.toString()}>
                    {repo.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isLoadingInventories ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto" />
              <p className="mt-2 text-sm text-gray-600">Loading inventories...</p>
            </div>
          ) : inventoryList.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No saved inventories found in this repository
            </div>
          ) : (
            <div className="space-y-2">
              <Label>Available Inventories</Label>
              <div className="border rounded-md max-h-96 overflow-y-auto">
                {inventoryList.map((inv) => (
                  <div
                    key={inv.name}
                    className="p-3 hover:bg-gray-50 border-b last:border-b-0 cursor-pointer"
                    onClick={() => handleLoad(inv.name)}
                  >
                    <div className="font-medium">{inv.name}</div>
                    {inv.description && (
                      <div className="text-sm text-gray-600 mt-1">{inv.description}</div>
                    )}
                    <div className="text-xs text-gray-400 mt-1">
                      {inv.conditions.length} condition{inv.conditions.length !== 1 ? 's' : ''}
                      {inv.updated_at && ` • Updated: ${new Date(inv.updated_at).toLocaleDateString()}`}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
