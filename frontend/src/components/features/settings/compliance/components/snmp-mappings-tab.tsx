'use client'

import { useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Loader2, Plus, Trash2, Edit, Download } from 'lucide-react'
import { useApi } from '@/hooks/use-api'
import { useToast } from '@/hooks/use-toast'

import { useSnmpMappingsQuery } from '../hooks/use-snmp-mappings-query'
import { useSnmpMappingsMutations } from '../hooks/use-snmp-mappings-mutations'
import { SNMPMappingDialog } from '../dialogs/snmp-mapping-dialog'
import { SNMPImportDialog } from '../dialogs/snmp-import-dialog'

import type { SNMPMapping, SNMPMappingFormData } from '../types'
import { DEFAULT_SNMP_FORM, EMPTY_SNMP_MAPPINGS } from '../utils/constants'
import type { OpenConfirmFn } from './types'

interface SnmpMappingsTabProps {
  openConfirm: OpenConfirmFn
  isActiveTab: boolean
}

export function SnmpMappingsTab({ openConfirm, isActiveTab }: SnmpMappingsTabProps) {
  const { apiCall } = useApi()
  const { toast } = useToast()

  const { data: snmpMappings = EMPTY_SNMP_MAPPINGS, isLoading: snmpMappingsLoading } =
    useSnmpMappingsQuery({ enabled: isActiveTab })

  const { createMapping, updateMapping, deleteMapping, importFromYaml } =
    useSnmpMappingsMutations()

  const [showDialog, setShowDialog] = useState(false)
  const [editingMapping, setEditingMapping] = useState<SNMPMapping | null>(null)
  const [form, setForm] = useState<SNMPMappingFormData>(DEFAULT_SNMP_FORM)
  const [showImportDialog, setShowImportDialog] = useState(false)
  const [isImporting, setIsImporting] = useState(false)

  const handleAdd = useCallback(() => {
    setEditingMapping(null)
    setForm(DEFAULT_SNMP_FORM)
    setShowDialog(true)
  }, [])

  const handleEdit = useCallback((mapping: SNMPMapping) => {
    setEditingMapping(mapping)
    setForm({
      name: mapping.name || '',
      snmp_version: mapping.snmp_version,
      snmp_community: mapping.snmp_community || '',
      snmp_v3_user: mapping.snmp_v3_user || '',
      snmp_v3_auth_protocol: mapping.snmp_v3_auth_protocol || 'SHA',
      snmp_v3_auth_password: '', // Don't pre-fill password
      snmp_v3_priv_protocol: mapping.snmp_v3_priv_protocol || 'AES',
      snmp_v3_priv_password: '', // Don't pre-fill password
      description: mapping.description || '',
    })
    setShowDialog(true)
  }, [])

  const handleSave = useCallback(async () => {
    if (editingMapping) {
      await updateMapping.mutateAsync({ id: editingMapping.id, data: form })
    } else {
      await createMapping.mutateAsync(form)
    }
    setShowDialog(false)
  }, [editingMapping, form, updateMapping, createMapping])

  const handleDelete = useCallback(
    (id: number) => {
      openConfirm({
        title: 'Delete SNMP mapping?',
        description: 'Are you sure you want to delete this SNMP mapping?',
        onConfirm: () => deleteMapping.mutateAsync(id),
        variant: 'destructive',
      })
    },
    [deleteMapping, openConfirm]
  )

  const handleImportFromCheckMK = useCallback(async () => {
    try {
      setIsImporting(true)
      const yamlResponse = (await apiCall('config/snmp_mapping.yaml')) as {
        success?: boolean
        data?: string
      }

      if (!yamlResponse.success || !yamlResponse.data) {
        toast({
          title: 'Error',
          description: 'Failed to load CheckMK SNMP mapping file',
          variant: 'destructive',
        })
        return
      }

      await importFromYaml.mutateAsync(yamlResponse.data)
    } catch {
      toast({
        title: 'Error',
        description: 'Error importing from CheckMK',
        variant: 'destructive',
      })
    } finally {
      setIsImporting(false)
    }
  }, [apiCall, toast, importFromYaml])

  const handleImportFromYAML = useCallback(() => {
    setShowImportDialog(true)
  }, [])

  const handleImportFile = useCallback(
    async (file: File) => {
      try {
        setIsImporting(true)
        const fileContent = await file.text()
        await importFromYaml.mutateAsync(fileContent)
        setShowImportDialog(false)
      } catch {
        toast({
          title: 'Error',
          description: 'Error importing YAML file',
          variant: 'destructive',
        })
      } finally {
        setIsImporting(false)
      }
    },
    [importFromYaml, toast]
  )

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>SNMP Credentials</CardTitle>
              <CardDescription>
                Configure SNMP credentials for compliance checks (device-type independent)
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleImportFromCheckMK}
                disabled={isImporting}
              >
                {isImporting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                Import from CheckMK
              </Button>
              <Button
                variant="outline"
                onClick={handleImportFromYAML}
                disabled={isImporting}
              >
                <Download className="h-4 w-4 mr-2" />
                Import from YAML
              </Button>
              <Button onClick={handleAdd}>
                <Plus className="h-4 w-4 mr-2" />
                Add Mapping
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {snmpMappingsLoading && snmpMappings.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : snmpMappings.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No SNMP mappings configured</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>SNMP Version</TableHead>
                  <TableHead>Community/User</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {snmpMappings.map((mapping) => (
                  <TableRow key={mapping.id}>
                    <TableCell className="font-medium">{mapping.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{mapping.snmp_version}</Badge>
                    </TableCell>
                    <TableCell>
                      {mapping.snmp_version === 'v3'
                        ? mapping.snmp_v3_user
                        : mapping.snmp_community}
                    </TableCell>
                    <TableCell>{mapping.description || '-'}</TableCell>
                    <TableCell>
                      <Badge variant={mapping.is_active ? 'default' : 'secondary'}>
                        {mapping.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(mapping)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(mapping.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <SNMPMappingDialog
        open={showDialog}
        onOpenChange={setShowDialog}
        mapping={editingMapping}
        formData={form}
        onFormChange={setForm}
        onSave={handleSave}
        isSaving={editingMapping ? updateMapping.isPending : createMapping.isPending}
      />

      <SNMPImportDialog
        open={showImportDialog}
        onOpenChange={setShowImportDialog}
        onImport={handleImportFile}
        isImporting={isImporting}
      />
    </>
  )
}
