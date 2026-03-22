'use client'

import { CheckCircle, XCircle, AlertCircle } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

export interface ValidationResults {
  isValid: boolean
  deviceRole: boolean
  deviceStatus: boolean
  deviceType: boolean
  location: boolean
  interfaceStatus: boolean
  interfaceIssues: number
  ipAddresses: boolean
  ipAddressIssues: number
}

interface ValidationResultsModalProps {
  open: boolean
  onClose: () => void
  results: ValidationResults
}

interface ValidationRowProps {
  label: string
  valid: boolean
  issueCount?: number
  useAlertIcon?: boolean
}

function ValidationRow({ label, valid, issueCount, useAlertIcon = false }: ValidationRowProps) {
  const Icon = valid ? CheckCircle : useAlertIcon ? AlertCircle : XCircle
  const iconClass = valid ? 'h-4 w-4 text-green-600' : 'h-4 w-4 text-red-600'

  let badgeLabel: string
  if (valid) {
    badgeLabel = issueCount !== undefined ? 'All Valid' : 'Valid'
  } else if (issueCount !== undefined) {
    badgeLabel = `${issueCount} ${issueCount === 1 ? 'Issue' : 'Issues'}`
  } else {
    badgeLabel = 'Required'
  }

  return (
    <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
      <div className="flex items-center gap-2">
        <Icon className={iconClass} />
        <span className="text-sm font-medium">{label}</span>
      </div>
      <Badge variant={valid ? 'default' : 'destructive'}>
        {badgeLabel}
      </Badge>
    </div>
  )
}

export function ValidationResultsModal({ open, onClose, results }: ValidationResultsModalProps) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
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
          <ValidationRow label="Device Role" valid={results.deviceRole} />
          <ValidationRow label="Device Status" valid={results.deviceStatus} />
          <ValidationRow label="Device Type" valid={results.deviceType} />
          <ValidationRow label="Location" valid={results.location} />
          <ValidationRow
            label="Interface Status"
            valid={results.interfaceStatus}
            issueCount={results.interfaceIssues}
            useAlertIcon
          />
          <ValidationRow
            label="IP Addresses (CIDR)"
            valid={results.ipAddresses}
            issueCount={results.ipAddressIssues}
            useAlertIcon
          />
        </div>

        <div className="flex justify-end">
          <Button onClick={onClose}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
