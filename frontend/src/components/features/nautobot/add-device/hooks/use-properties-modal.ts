import { useState, useCallback, useMemo } from 'react'
import { useVlansQuery } from './queries/use-vlans-query'
import { EMPTY_VLANS } from '../constants'
import type { VlanItem } from '../types'

export interface PropertiesModalHook {
  showModal: boolean
  currentInterfaceId: string | null
  vlans: VlanItem[]
  isLoadingVlans: boolean
  openModal: (interfaceId: string, locationName?: string) => void
  closeModal: () => void
}

export function usePropertiesModal(): PropertiesModalHook {
  const [showModal, setShowModal] = useState(false)
  const [currentInterfaceId, setCurrentInterfaceId] = useState<string | null>(null)
  const [locationName, setLocationName] = useState<string | undefined>(undefined)

  // Fetch VLANs when modal is open
  const { data: vlans = EMPTY_VLANS, isLoading: isLoadingVlans } = useVlansQuery({
    locationName,
    includeGlobal: true,
    enabled: showModal && !!locationName,
  })

  const openModal = useCallback((interfaceId: string, location?: string) => {
    setCurrentInterfaceId(interfaceId)
    setLocationName(location)
    setShowModal(true)
  }, [])

  const closeModal = useCallback(() => {
    setShowModal(false)
    setCurrentInterfaceId(null)
    setLocationName(undefined)
  }, [])

  return useMemo(
    () => ({
      showModal,
      currentInterfaceId,
      vlans,
      isLoadingVlans,
      openModal,
      closeModal,
    }),
    [showModal, currentInterfaceId, vlans, isLoadingVlans, openModal, closeModal]
  )
}
