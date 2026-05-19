'use client'

import { useRef, useCallback, useState, useEffect } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from '@/components/ui/form'
import { Upload, FileText, Search, Eye, CheckCircle2, XCircle } from 'lucide-react'
import type { UploadFormData } from '../types'
import { type CSVPreviewResult, previewCSV } from '../utils/csv-preview'

const uploadFormSchema = z.object({
  file: z.instanceof(File, { message: 'Please select a CSV file' }),
  delimiter: z.string().length(1, 'Delimiter must be a single character'),
  quoteChar: z.string().length(1, 'Quote character must be a single character'),
})

interface CheckIPUploadFormProps {
  onSubmit: (data: UploadFormData) => void
  isDisabled: boolean
  defaultDelimiter: string
  defaultQuoteChar: string
}

export function CheckIPUploadForm({
  onSubmit,
  isDisabled,
  defaultDelimiter,
  defaultQuoteChar,
}: CheckIPUploadFormProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<CSVPreviewResult | null>(null)

  const form = useForm<z.infer<typeof uploadFormSchema>>({
    resolver: zodResolver(uploadFormSchema),
    defaultValues: {
      delimiter: defaultDelimiter,
      quoteChar: defaultQuoteChar,
    },
  })

  const selectedFile = useWatch({ control: form.control, name: 'file' })
  const delimiter = useWatch({ control: form.control, name: 'delimiter' })
  const quoteChar = useWatch({ control: form.control, name: 'quoteChar' })

  // Clear preview when parsing settings change so stale results aren't shown
  useEffect(() => {
    setPreview(null)
  }, [delimiter, quoteChar])

  const handleFileSelect = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      if (file) {
        if (file.type === 'text/csv' || file.name.endsWith('.csv')) {
          form.setValue('file', file)
          form.clearErrors('file')
          setPreview(null)
        } else {
          form.setError('file', {
            type: 'manual',
            message: 'Please select a valid CSV file',
          })
        }
      }
    },
    [form]
  )

  const handlePreview = useCallback(() => {
    const file = form.getValues('file')
    if (!file) return

    const reader = new FileReader()
    reader.onload = e => {
      const content = e.target?.result as string
      setPreview(
        previewCSV(
          content,
          form.getValues('delimiter'),
          form.getValues('quoteChar')
        )
      )
    }
    reader.readAsText(file)
  }, [form])

  const handleFormSubmit = form.handleSubmit(data => {
    onSubmit(data)
  })

  const handleReset = useCallback(() => {
    form.reset({
      delimiter: defaultDelimiter,
      quoteChar: defaultQuoteChar,
    })
    setPreview(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [form, defaultDelimiter, defaultQuoteChar])

  return (
    <Card className="shadow-lg border-0 overflow-hidden p-0">
      <CardHeader className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white border-b-0 rounded-none m-0 py-2 px-4">
        <CardTitle className="flex items-center space-x-2 text-sm font-medium">
          <Upload className="h-4 w-4" />
          <span>Upload CSV File</span>
        </CardTitle>
        <CardDescription className="text-white/90 text-xs mt-1">
          Select a CSV file with device information to compare with Nautobot. Required
          columns: ip_address, name
        </CardDescription>
      </CardHeader>
      <CardContent className="p-6 bg-gradient-to-b from-white to-gray-50 space-y-4">
        <Form {...form}>
          <form onSubmit={handleFormSubmit} className="space-y-4">
            {/* CSV Configuration */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-muted/50 rounded-md">
              <FormField
                control={form.control}
                name="delimiter"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel htmlFor="delimiter">CSV Delimiter</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        id="delimiter"
                        placeholder=","
                        disabled={isDisabled}
                        className="w-20"
                        maxLength={1}
                      />
                    </FormControl>
                    <p className="text-xs text-muted-foreground">
                      Character that separates values (e.g., &quot;,&quot; or
                      &quot;;&quot;)
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="quoteChar"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel htmlFor="quoteChar">Quote Character</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        id="quoteChar"
                        placeholder={'"'}
                        disabled={isDisabled}
                        className="w-20"
                        maxLength={1}
                      />
                    </FormControl>
                    <p className="text-xs text-muted-foreground">
                      Character that quotes text values (e.g., &quot; or &apos;)
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* File Selection */}
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileSelect}
                disabled={isDisabled}
                className="hidden"
                aria-label="Select CSV file"
              />
              <Button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                variant="outline"
                disabled={isDisabled}
                className="w-full sm:w-auto"
              >
                <FileText className="h-4 w-4 mr-2" />
                {selectedFile ? 'Change File' : 'Select CSV File'}
              </Button>
              {selectedFile && (
                <p className="text-sm text-muted-foreground mt-2">
                  Selected: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)}{' '}
                  KB)
                </p>
              )}
              {form.formState.errors.file && (
                <p className="text-sm text-destructive mt-2">
                  {form.formState.errors.file.message}
                </p>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 flex-wrap">
              <Button
                type="submit"
                disabled={!selectedFile || isDisabled}
                className="flex-1 sm:flex-none"
              >
                {isDisabled ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                    Checking...
                  </>
                ) : (
                  <>
                    <Search className="h-4 w-4 mr-2" />
                    Start Check
                  </>
                )}
              </Button>
              <Button
                type="button"
                onClick={handlePreview}
                variant="outline"
                disabled={!selectedFile || isDisabled}
              >
                <Eye className="h-4 w-4 mr-2" />
                Preview
              </Button>
              <Button
                type="button"
                onClick={handleReset}
                variant="outline"
                disabled={isDisabled}
              >
                Reset
              </Button>
            </div>

            {/* CSV Preview Results */}
            {preview && <CSVPreview preview={preview} />}
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}

function CSVPreview({ preview }: { preview: CSVPreviewResult }) {
  return (
    <div className="rounded-md border bg-muted/30 p-4 space-y-3">
      {/* Column validation status */}
      {preview.error ? (
        <div className="flex items-center gap-2 text-sm text-red-700">
          <XCircle className="h-4 w-4 flex-shrink-0" />
          {preview.error}
        </div>
      ) : preview.isValid ? (
        <div className="flex items-center gap-2 text-sm text-green-700">
          <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
          Required columns <code className="font-mono">ip_address</code> and{' '}
          <code className="font-mono">name</code> found
        </div>
      ) : (
        <div className="flex items-center gap-2 text-sm text-red-700">
          <XCircle className="h-4 w-4 flex-shrink-0" />
          Missing columns:{' '}
          <code className="font-mono">{preview.missingColumns.join(', ')}</code>
          {preview.headers.length > 0 && (
            <span className="text-muted-foreground">
              — found: <code className="font-mono">{preview.headers.join(', ')}</code>
            </span>
          )}
        </div>
      )}

      {/* Preview table */}
      {preview.rows.length > 0 && (
        <div className="overflow-auto max-h-48 rounded border bg-white">
          <table className="text-xs w-full border-collapse">
            <thead>
              <tr className="bg-muted border-b">
                {preview.headers.map(h => (
                  <th key={h} className="text-left px-2 py-1.5 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {preview.rows.map((row) => (
                <tr key={row.join('\x00')} className="border-b last:border-0 hover:bg-muted/40">
                  {row.map((cell, j) => (
                    <td key={preview.headers[j]} className="px-2 py-1.5">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Showing {preview.rows.length} of {preview.totalDataRows} data rows
      </p>
    </div>
  )
}
