// Repository Form Hook with react-hook-form + Zod validation

import { useForm, UseFormReturn } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMemo } from 'react'
import { repositoryFormSchema, type RepositoryFormValues } from '../validation'
import { DEFAULT_FORM_DATA } from '../constants'
import type { GitRepository } from '../types'

interface UseRepositoryFormOptions {
  defaultValues?: Partial<RepositoryFormValues>
  repository?: GitRepository  // For edit mode
}

const DEFAULT_OPTIONS: UseRepositoryFormOptions = {}

export function useRepositoryForm(
  options: UseRepositoryFormOptions = DEFAULT_OPTIONS
): UseFormReturn<RepositoryFormValues> {
  const { defaultValues, repository } = options

  const initialValues: RepositoryFormValues = useMemo(() => {
    if (repository) {
      // Edit mode - populate from repository
      return {
        name: repository.name,
        category: repository.category as RepositoryFormValues['category'],
        url: repository.url,
        branch: repository.branch,
        auth_type: (repository.auth_type || 'none') as RepositoryFormValues['auth_type'],
        credential_name: repository.credential_name || '__none__',
        path: repository.path || '',
        verify_ssl: repository.verify_ssl,
        git_author_name: repository.git_author_name || '',
        git_author_email: repository.git_author_email || '',
        description: repository.description || '',
      }
    }

    return {
      ...DEFAULT_FORM_DATA,
      ...defaultValues,
    } as RepositoryFormValues
  }, [repository, defaultValues])

  const form = useForm<RepositoryFormValues>({
    resolver: zodResolver(repositoryFormSchema),
    defaultValues: initialValues,
    mode: 'onChange',
  })

  return form
}
