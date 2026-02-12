import { useState, useCallback, useMemo } from 'react'
import { useTagsQuery } from './queries/use-tags-query'
import { EMPTY_STRING_ARRAY } from '../constants'
import type { TagItem } from '../types'

export interface TagsManagerHook {
  availableTags: TagItem[]
  selectedTags: string[]
  isLoading: boolean
  showModal: boolean
  openModal: () => void
  closeModal: () => void
  toggleTag: (tagId: string) => void
  setSelectedTags: (tags: string[]) => void
  clearSelectedTags: () => void
}

export function useTagsManager(): TagsManagerHook {
  const [selectedTags, setSelectedTags] = useState<string[]>(EMPTY_STRING_ARRAY)
  const [showModal, setShowModal] = useState(false)

  // Fetch tags only when modal is open
  const { data: availableTags = EMPTY_STRING_ARRAY as unknown as TagItem[], isLoading } = useTagsQuery({
    enabled: showModal,
  })

  const openModal = useCallback(() => {
    setShowModal(true)
  }, [])

  const closeModal = useCallback(() => {
    setShowModal(false)
  }, [])

  const toggleTag = useCallback((tagId: string) => {
    setSelectedTags((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    )
  }, [])

  const clearSelectedTags = useCallback(() => {
    setSelectedTags(EMPTY_STRING_ARRAY)
  }, [])

  // CRITICAL: Memoize return
  return useMemo(
    () => ({
      availableTags,
      selectedTags,
      isLoading,
      showModal,
      openModal,
      closeModal,
      toggleTag,
      setSelectedTags,
      clearSelectedTags,
    }),
    [
      availableTags,
      selectedTags,
      isLoading,
      showModal,
      openModal,
      closeModal,
      toggleTag,
      clearSelectedTags,
    ]
  )
}
