import { useMutation } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { useToast } from '@/hooks/use-toast'
import type { UploadFormData, UploadCsvResponse } from '../types'
import { useMemo } from 'react'

export function useCheckIpMutations() {
  const { apiCall } = useApi()
  const { toast } = useToast()

  const uploadCsv = useMutation({
    mutationFn: async (data: UploadFormData) => {
      const formData = new FormData()
      formData.append('csv_file', data.file)
      formData.append('delimiter', data.delimiter || ';')
      formData.append('quote_char', data.quoteChar || '"')

      const response = await apiCall('celery/tasks/check-ip', {
        method: 'POST',
        body: formData,
      })

      return response as UploadCsvResponse
    },

    onSuccess: () => {
      toast({
        title: 'Upload successful',
        description: 'Processing CSV file...',
      })
    },

    onError: (error: Error) => {
      toast({
        title: 'Upload failed',
        description: error.message,
        variant: 'destructive'
      })
    }
  })

  return useMemo(() => ({
    uploadCsv,
    isUploading: uploadCsv.isPending
  }), [uploadCsv])
}
