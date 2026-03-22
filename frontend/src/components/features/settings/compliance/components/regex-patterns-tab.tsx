'use client'

import { useState, useCallback, useMemo } from 'react'
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
import { Loader2, CheckCircle, XCircle, Plus, Trash2, Edit } from 'lucide-react'

import { useRegexPatternsQuery } from '../hooks/use-regex-patterns-query'
import { useRegexPatternsMutations } from '../hooks/use-regex-patterns-mutations'
import { RegexPatternDialog } from '../dialogs/regex-pattern-dialog'

import type { RegexPattern, RegexPatternFormData } from '../types'
import { DEFAULT_REGEX_FORM, EMPTY_REGEX_PATTERNS } from '../utils/constants'
import type { OpenConfirmFn } from './types'

interface RegexPatternsTabProps {
  openConfirm: OpenConfirmFn
  isActiveTab: boolean
}

export function RegexPatternsTab({ openConfirm, isActiveTab }: RegexPatternsTabProps) {
  const { data: regexPatterns = EMPTY_REGEX_PATTERNS, isLoading: regexPatternsLoading } =
    useRegexPatternsQuery({ enabled: isActiveTab })

  const { createPattern, updatePattern, deletePattern } = useRegexPatternsMutations()

  const [showDialog, setShowDialog] = useState(false)
  const [editingPattern, setEditingPattern] = useState<RegexPattern | null>(null)
  const [form, setForm] = useState<RegexPatternFormData>(DEFAULT_REGEX_FORM)

  const mustMatchPatterns = useMemo(
    () => regexPatterns.filter((p) => p.pattern_type === 'must_match'),
    [regexPatterns]
  )

  const mustNotMatchPatterns = useMemo(
    () => regexPatterns.filter((p) => p.pattern_type === 'must_not_match'),
    [regexPatterns]
  )

  const handleAdd = useCallback((patternType: 'must_match' | 'must_not_match') => {
    setEditingPattern(null)
    setForm({ ...DEFAULT_REGEX_FORM, pattern_type: patternType })
    setShowDialog(true)
  }, [])

  const handleEdit = useCallback((pattern: RegexPattern) => {
    setEditingPattern(pattern)
    setForm({
      pattern: pattern.pattern,
      description: pattern.description || '',
      pattern_type: pattern.pattern_type,
    })
    setShowDialog(true)
  }, [])

  const handleSave = useCallback(async () => {
    if (editingPattern) {
      await updatePattern.mutateAsync({ id: editingPattern.id, data: form })
    } else {
      await createPattern.mutateAsync(form)
    }
    setShowDialog(false)
  }, [editingPattern, form, updatePattern, createPattern])

  const handleDelete = useCallback(
    (id: number) => {
      openConfirm({
        title: 'Delete regex pattern?',
        description: 'Are you sure you want to delete this regex pattern?',
        onConfirm: () => deletePattern.mutateAsync(id),
        variant: 'destructive',
      })
    },
    [deletePattern, openConfirm]
  )

  return (
    <div className="space-y-6">
      {/* Must Match Patterns */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                Must Match
              </CardTitle>
              <CardDescription>
                Regular expressions that must match in device configurations
              </CardDescription>
            </div>
            <Button onClick={() => handleAdd('must_match')}>
              <Plus className="h-4 w-4 mr-2" />
              Add Pattern
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {regexPatternsLoading && mustMatchPatterns.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : mustMatchPatterns.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No patterns configured</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pattern</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mustMatchPatterns.map((pattern) => (
                  <TableRow key={pattern.id}>
                    <TableCell className="font-mono text-sm">{pattern.pattern}</TableCell>
                    <TableCell>{pattern.description || '-'}</TableCell>
                    <TableCell>
                      <Badge variant={pattern.is_active ? 'default' : 'secondary'}>
                        {pattern.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => handleEdit(pattern)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(pattern.id)}
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

      {/* Must NOT Match Patterns */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <XCircle className="h-5 w-5 text-red-600" />
                Must Not Match
              </CardTitle>
              <CardDescription>
                Regular expressions that must NOT match in device configurations
              </CardDescription>
            </div>
            <Button onClick={() => handleAdd('must_not_match')}>
              <Plus className="h-4 w-4 mr-2" />
              Add Pattern
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {regexPatternsLoading && mustNotMatchPatterns.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : mustNotMatchPatterns.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No patterns configured</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pattern</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mustNotMatchPatterns.map((pattern) => (
                  <TableRow key={pattern.id}>
                    <TableCell className="font-mono text-sm">{pattern.pattern}</TableCell>
                    <TableCell>{pattern.description || '-'}</TableCell>
                    <TableCell>
                      <Badge variant={pattern.is_active ? 'default' : 'secondary'}>
                        {pattern.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => handleEdit(pattern)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(pattern.id)}
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

      <RegexPatternDialog
        open={showDialog}
        onOpenChange={setShowDialog}
        pattern={editingPattern}
        formData={form}
        onFormChange={setForm}
        onSave={handleSave}
        isSaving={editingPattern ? updatePattern.isPending : createPattern.isPending}
      />
    </div>
  )
}
