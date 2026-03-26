'use client'

import { AlertCircle, CheckCircle, XCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'

export interface ValidationResults {
  isValid: boolean
  deviceName: boolean
  deviceRole: boolean
  deviceStatus: boolean
  deviceType: boolean
  location: boolean
  interfaceStatus: boolean
  interfaceIssues: number
  ipAddresses: boolean
  ipAddressIssues: number
}

interface ValidationSummaryModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  results: ValidationResults
}

interface ValidationRowProps {
  label: string
  isValid: boolean
  validLabel?: string
  invalidLabel?: string
  useAlertIcon?: boolean
}

function ValidationRow({ label, isValid, validLabel = 'Valid', invalidLabel = 'Required', useAlertIcon = false }: ValidationRowProps) {
  return (
    <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
      <div className="flex items-center gap-2">
        {isValid ? (
          <CheckCircle className="h-4 w-4 text-green-600" />
        ) : useAlertIcon ? (
          <AlertCircle className="h-4 w-4 text-red-600" />
        ) : (
          <XCircle className="h-4 w-4 text-red-600" />
        )}
        <span className="text-sm font-medium">{label}</span>
      </div>
      <Badge variant={isValid ? 'default' : 'destructive'}>
        {isValid ? validLabel : invalidLabel}
      </Badge>
    </div>
  )
}

export function ValidationSummaryModal({ open, onOpenChange, results }: ValidationSummaryModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {results.isValid ? (
              <>
                <CheckCircle className="h-5 w-5 text-green-600" />
                <span>Validation Passed</span>
              </>
            ) : (
              <>
                <XCircle className="h-5 w-5 text-red-600" />
                <span>Validation Failed</span>
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {results.isValid
              ? 'All required fields are properly configured.'
              : 'Some required fields are missing or invalid.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-4">
          <ValidationRow label="Device Name" isValid={results.deviceName} />
          <ValidationRow label="Device Role" isValid={results.deviceRole} />
          <ValidationRow label="Device Status" isValid={results.deviceStatus} />
          <ValidationRow label="Device Type" isValid={results.deviceType} />
          <ValidationRow label="Location" isValid={results.location} />
          <ValidationRow
            label="Interfaces (Name, Type, Status)"
            isValid={results.interfaceStatus}
            validLabel="All Valid"
            invalidLabel={`${results.interfaceIssues} Issue${results.interfaceIssues !== 1 ? 's' : ''}`}
            useAlertIcon
          />
          <ValidationRow
            label="IP Addresses (Address & Namespace)"
            isValid={results.ipAddresses}
            validLabel="All Valid"
            invalidLabel={`${results.ipAddressIssues} Issue${results.ipAddressIssues !== 1 ? 's' : ''}`}
            useAlertIcon
          />
        </div>

        <div className="flex justify-end">
          <Button onClick={() => onOpenChange(false)}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
