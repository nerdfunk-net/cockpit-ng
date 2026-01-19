'use client'

import { useRef, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form'
import { Upload, FileText, Search } from 'lucide-react'
import type { UploadFormData } from '../types'

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
  defaultQuoteChar
}: CheckIPUploadFormProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const form = useForm<z.infer<typeof uploadFormSchema>>({
    resolver: zodResolver(uploadFormSchema),
    defaultValues: {
      delimiter: defaultDelimiter,
      quoteChar: defaultQuoteChar,
    }
  })

  const selectedFile = form.watch('file')

  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      if (file.type === 'text/csv' || file.name.endsWith('.csv')) {
        form.setValue('file', file)
        form.clearErrors('file')
      } else {
        form.setError('file', {
          type: 'manual',
          message: 'Please select a valid CSV file'
        })
      }
    }
  }, [form])

  const handleFormSubmit = form.handleSubmit((data) => {
    onSubmit(data)
  })

  const handleReset = useCallback(() => {
    form.reset({
      delimiter: defaultDelimiter,
      quoteChar: defaultQuoteChar,
    })
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
          Select a CSV file with device information to compare with Nautobot.
          Required columns: ip_address, name
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
                      Character that separates values (e.g., &quot;,&quot; or &quot;;&quot;)
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
                  Selected: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                </p>
              )}
              {form.formState.errors.file && (
                <p className="text-sm text-destructive mt-2">
                  {form.formState.errors.file.message}
                </p>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
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
                onClick={handleReset}
                variant="outline"
                disabled={isDisabled}
              >
                Reset
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}
