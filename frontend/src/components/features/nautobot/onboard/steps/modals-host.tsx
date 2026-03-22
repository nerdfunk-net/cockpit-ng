'use client'

import { CSVUploadModal } from '../components/csv-upload-modal'
import { NetworkScanModal } from '../components/network-scan-modal'
import { OnboardingProgressModal } from '../components/onboarding-progress-modal'
import { TagsModal } from '@/components/shared/tags-modal'
import { CustomFieldsModal } from '@/components/shared/custom-fields-modal'
import type { useCSVUpload } from '../hooks/use-csv-upload'

type UseCSVUploadReturn = ReturnType<typeof useCSVUpload>

interface TagItem {
  id: string
  name: string
  color?: string
}

interface CustomField {
  id: string
  key: string
  label: string
  type: {
    value: string
  }
  required: boolean
  description?: string
}

interface ModalsHostProps {
  // CSV upload
  csvUpload: UseCSVUploadReturn
  onCSVUpload: () => Promise<string | null>

  // Tags modal
  showTagsModal: boolean
  onTagsModalOpenChange: (open: boolean) => void
  selectedTags: string[]
  availableTags: TagItem[]
  isLoadingTags: boolean
  onToggleTag: (tagId: string) => void
  setAvailableTags: (tags: TagItem[]) => void
  setIsLoadingTags: (loading: boolean) => void

  // Custom fields modal
  showCustomFieldsModal: boolean
  onCustomFieldsModalOpenChange: (open: boolean) => void
  customFieldValues: Record<string, string>
  customFields: CustomField[]
  customFieldChoices: Record<string, string[]>
  isLoadingCustomFields: boolean
  onUpdateCustomField: (key: string, value: string) => void
  setCustomFields: (fields: CustomField[]) => void
  setCustomFieldChoices: (choices: Record<string, string[]>) => void
  setIsLoadingCustomFields: (loading: boolean) => void

  // Progress modal
  showProgressModal: boolean
  onProgressModalOpenChange: (open: boolean) => void
  onboardingTaskId: string | null
  ipAddress: string

  // Network scan modal
  showNetworkScanModal: boolean
  onNetworkScanClose: () => void
  onNetworkScanIPsSelected: (ips: string[]) => void
}

export function ModalsHost({
  csvUpload,
  onCSVUpload,
  showTagsModal,
  onTagsModalOpenChange,
  selectedTags,
  availableTags,
  isLoadingTags,
  onToggleTag,
  setAvailableTags,
  setIsLoadingTags,
  showCustomFieldsModal,
  onCustomFieldsModalOpenChange,
  customFieldValues,
  customFields,
  customFieldChoices,
  isLoadingCustomFields,
  onUpdateCustomField,
  setCustomFields,
  setCustomFieldChoices,
  setIsLoadingCustomFields,
  showProgressModal,
  onProgressModalOpenChange,
  onboardingTaskId,
  ipAddress,
  showNetworkScanModal,
  onNetworkScanClose,
  onNetworkScanIPsSelected,
}: ModalsHostProps) {
  return (
    <>
      <CSVUploadModal
        open={csvUpload.showModal}
        onClose={csvUpload.closeModal}
        csvFile={csvUpload.csvFile}
        parsedData={csvUpload.parsedData}
        isParsing={csvUpload.isParsing}
        isSubmitting={csvUpload.isSubmitting}
        taskId={csvUpload.taskId}
        submitError={csvUpload.submitError}
        parseError={csvUpload.parseError}
        csvDelimiter={csvUpload.csvDelimiter}
        csvQuoteChar={csvUpload.csvQuoteChar}
        parallelJobs={csvUpload.parallelJobs}
        onFileSelect={csvUpload.parseCSV}
        onUpload={onCSVUpload}
        onDelimiterChange={csvUpload.setCsvDelimiter}
        onQuoteCharChange={csvUpload.setCsvQuoteChar}
        onParallelJobsChange={csvUpload.setParallelJobs}
        onReparse={() => csvUpload.csvFile && csvUpload.parseCSV(csvUpload.csvFile)}
      />

      <TagsModal
        open={showTagsModal}
        onOpenChange={onTagsModalOpenChange}
        selectedTags={selectedTags}
        onToggleTag={onToggleTag}
        availableTags={availableTags}
        setAvailableTags={setAvailableTags}
        isLoadingTags={isLoadingTags}
        setIsLoadingTags={setIsLoadingTags}
      />

      <CustomFieldsModal
        open={showCustomFieldsModal}
        onOpenChange={onCustomFieldsModalOpenChange}
        customFieldValues={customFieldValues}
        onUpdateCustomField={onUpdateCustomField}
        customFields={customFields}
        setCustomFields={setCustomFields}
        customFieldChoices={customFieldChoices}
        setCustomFieldChoices={setCustomFieldChoices}
        isLoadingCustomFields={isLoadingCustomFields}
        setIsLoadingCustomFields={setIsLoadingCustomFields}
      />

      <OnboardingProgressModal
        open={showProgressModal}
        onOpenChange={onProgressModalOpenChange}
        taskId={onboardingTaskId}
        ipAddress={ipAddress}
      />

      <NetworkScanModal
        open={showNetworkScanModal}
        onClose={onNetworkScanClose}
        onIPsSelected={onNetworkScanIPsSelected}
      />
    </>
  )
}
