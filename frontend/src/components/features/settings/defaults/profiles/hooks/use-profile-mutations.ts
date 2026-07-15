import { useMemo } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useApi } from '@/hooks/use-api'
import { queryKeys } from '@/lib/query-keys'
import { useToast } from '@/hooks/use-toast'
import type { DefaultsFields } from '@/components/features/settings/common/types/defaults-fields'
import type { Profile, ProfileApiResponse } from '../types'

interface CreateProfileInput {
  name: string
  fields: DefaultsFields
}

interface UpdateProfileInput {
  id: number
  name?: string
  fields?: Partial<DefaultsFields>
}

export function useProfileMutations() {
  const { apiCall } = useApi()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const invalidateProfiles = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.profiles.all })

  // Create/rename mutations intentionally have no onError toast - the
  // calling dialog catches mutateAsync rejections to show the backend's
  // uniqueness/validation message inline next to the name field.
  const createProfile = useMutation({
    mutationFn: async ({ name, fields }: CreateProfileInput): Promise<Profile> => {
      const response = await apiCall<ProfileApiResponse>('settings/profiles', {
        method: 'POST',
        body: JSON.stringify({ name, ...fields }),
      })

      if (!response.success || !response.data) {
        throw new Error(response.message || 'Failed to create profile')
      }

      return response.data
    },
    onSuccess: () => {
      invalidateProfiles()
      toast({ title: 'Success', description: 'Profile created successfully' })
    },
  })

  const updateProfile = useMutation({
    mutationFn: async ({ id, name, fields }: UpdateProfileInput): Promise<Profile> => {
      const response = await apiCall<ProfileApiResponse>(`settings/profiles/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ name, ...fields }),
      })

      if (!response.success || !response.data) {
        throw new Error(response.message || 'Failed to update profile')
      }

      return response.data
    },
    onSuccess: () => {
      invalidateProfiles()
      toast({ title: 'Success', description: 'Profile updated successfully' })
    },
  })

  const deleteProfile = useMutation({
    mutationFn: async (id: number): Promise<number> => {
      const response = await apiCall<{ success: boolean; message?: string }>(
        `settings/profiles/${id}`,
        { method: 'DELETE' }
      )

      if (!response.success) {
        throw new Error(response.message || 'Failed to delete profile')
      }

      return id
    },
    onSuccess: () => {
      invalidateProfiles()
      toast({ title: 'Success', description: 'Profile deleted successfully' })
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    },
  })

  return useMemo(
    () => ({ createProfile, updateProfile, deleteProfile }),
    [createProfile, updateProfile, deleteProfile]
  )
}
