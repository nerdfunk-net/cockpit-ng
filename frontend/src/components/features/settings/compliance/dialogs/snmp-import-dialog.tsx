import { useCallback, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, Upload } from 'lucide-react'

interface SNMPImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onImport: (file: File) => void
  isImporting?: boolean
}

export function SNMPImportDialog({
  open,
  onOpenChange,
  onImport,
  isImporting = false,
}: SNMPImportDialogProps) {
  const [importFile, setImportFile] = useState<File | null>(null)

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
        setImportFile(e.target.files[0])
      }
    },
    []
  )

  const handleImportSubmit = useCallback(() => {
    if (importFile) {
      onImport(importFile)
      // Dialog will be closed by parent component after successful import
    }
  }, [importFile, onImport])

  const handleOpenChange = useCallback(
    (newOpen: boolean) => {
      if (!newOpen) {
        // Reset file when closing dialog
        setImportFile(null)
      }
      onOpenChange(newOpen)
    },
    [onOpenChange]
  )

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Import SNMP Mappings from YAML</DialogTitle>
          <DialogDescription>
            Upload a YAML file containing SNMP mappings in CheckMK format
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="yaml-file">YAML File *</Label>
            <Input
              id="yaml-file"
              type="file"
              accept=".yaml,.yml"
              onChange={handleFileChange}
              className="cursor-pointer"
              disabled={isImporting}
            />
            <p className="text-sm text-muted-foreground mt-2">
              Select a YAML file with SNMP configuration mappings
            </p>
          </div>
          {importFile && (
            <div className="bg-muted p-3 rounded-md">
              <p className="text-sm font-medium">Selected file:</p>
              <p className="text-sm text-muted-foreground">{importFile.name}</p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isImporting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleImportSubmit}
            disabled={!importFile || isImporting}
          >
            {isImporting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Importing...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Import
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
