'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { FileSpreadsheet, HelpCircle, Loader2, Upload } from 'lucide-react'
import { CSVParseResult, ImportSummary } from '../types'
import { CSVFileUpload } from './csv-file-upload'
import { CSVColumnMapping } from './csv-column-mapping'
import { CSVValidationPreview } from './csv-validation-preview'
import { CSVImportProgress } from './csv-import-progress'
import { CSVImportSummary } from './csv-import-summary'
import { CSVHelpDialog } from './csv-help-dialog'

interface LookupData {
  roles: Array<{ id: string; name: string }>
  locations: Array<{ id: string; name: string; hierarchicalPath?: string }>
  deviceTypes: Array<{ id: string; model: string; display?: string }>
}

interface CSVUploadModalProps {
  showModal: boolean
  onClose: () => void
  csvFile: File | null
  parseResult: CSVParseResult | null
  isParsing: boolean
  parseError: string
  isImporting: boolean
  importProgress: { current: number; total: number }
  importSummary: ImportSummary | null
  columnMappings: Record<string, string>
  showMappingConfig: boolean
  lookupData: LookupData
  onFileSelect: (file: File) => void
  onImport: () => void
  onUpdateMapping: (csvColumn: string, nautobotField: string) => void
  onApplyMappings: () => void
  onShowMappingConfig: (show: boolean) => void
  onReset: () => void
}

export function CSVUploadModal({
  showModal,
  onClose,
  csvFile,
  parseResult,
  isParsing,
  parseError,
  isImporting,
  importProgress,
  importSummary,
  columnMappings,
  showMappingConfig,
  lookupData,
  onFileSelect,
  onImport,
  onUpdateMapping,
  onApplyMappings,
  onShowMappingConfig,
  onReset,
}: CSVUploadModalProps) {
  const [showHelp, setShowHelp] = useState(false)

  const errorCount = parseResult?.validationErrors.filter((e) => e.severity === 'error').length || 0

  return (
    <Dialog open={showModal} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[900px] sm:!max-w-[900px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              Import Devices from CSV
            </DialogTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowHelp(true)}
              className="h-8 w-8 p-0"
            >
              <HelpCircle className="h-4 w-4" />
            </Button>
          </div>
          <DialogDescription>
            Upload a CSV file to bulk import devices. The first row should contain column headers.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* File Upload Section */}
          {!importSummary && (
            <CSVFileUpload
              csvFile={csvFile}
              isParsing={isParsing}
              isImporting={isImporting}
              parseError={parseError}
              onFileSelect={onFileSelect}
            />
          )}

          {/* Column Mapping Configuration */}
          {showMappingConfig && parseResult && (
            <CSVColumnMapping
              parseResult={parseResult}
              columnMappings={columnMappings}
              onUpdateMapping={onUpdateMapping}
              onApplyMappings={onApplyMappings}
            />
          )}

          {/* Parse Results Preview */}
          {parseResult && !showMappingConfig && !importSummary && (
            <CSVValidationPreview
              parseResult={parseResult}
              lookupData={lookupData}
              onShowMappingConfig={onShowMappingConfig}
            />
          )}

          {/* Import Progress */}
          {isImporting && (
            <CSVImportProgress
              current={importProgress.current}
              total={importProgress.total}
            />
          )}

          {/* Import Results */}
          {importSummary && <CSVImportSummary importSummary={importSummary} />}
        </div>

        <DialogFooter className="gap-2">
          {importSummary ? (
            <>
              <Button variant="outline" onClick={onReset}>
                Import Another File
              </Button>
              <Button onClick={onClose}>Close</Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={onClose} disabled={isImporting}>
                Cancel
              </Button>
              <Button
                onClick={onImport}
                disabled={!parseResult || errorCount > 0 || isParsing || isImporting}
              >
                {isImporting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Import {parseResult?.devices.length || 0} Device(s)
                  </>
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>

      <CSVHelpDialog open={showHelp} onClose={() => setShowHelp(false)} />
    </Dialog>
  )
}
