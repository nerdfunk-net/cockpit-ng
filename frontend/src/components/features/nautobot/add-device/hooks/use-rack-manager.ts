import { useState, useCallback, useMemo } from 'react'
import { useRacksQuery } from './queries/use-racks-query'
import { useRackGroupsQuery } from './queries/use-rack-groups-query'
import { EMPTY_RACKS, EMPTY_RACK_GROUPS } from '../constants'
import type { RackItem, RackGroupItem } from '../types'

type RackFace = 'front' | 'rear' | ''

export interface RackManagerHook {
  // Modal state
  showModal: boolean
  openModal: (locationId?: string) => void
  closeModal: () => void
  // Selection state
  selectedRackGroup: string
  setSelectedRackGroup: (id: string) => void
  selectedRack: string
  setSelectedRack: (id: string) => void
  selectedFace: RackFace
  setSelectedFace: (face: RackFace) => void
  position: number | ''
  setPosition: (pos: number | '') => void
  // Data
  availableRacks: RackItem[]
  availableRackGroups: RackGroupItem[]
  availablePositions: number[]
  selectedRackData: RackItem | undefined
  isLoading: boolean
  isConfigured: boolean
  clearRack: () => void
}

export function useRackManager(): RackManagerHook {
  const [showModal, setShowModal] = useState(false)
  const [locationId, setLocationId] = useState<string | undefined>(undefined)
  const [selectedRackGroup, setSelectedRackGroupState] = useState<string>('')
  const [selectedRack, setSelectedRackState] = useState<string>('')
  const [selectedFace, setSelectedFace] = useState<RackFace>('')
  const [position, setPosition] = useState<number | ''>('')

  const { data: allRacks = EMPTY_RACKS, isLoading: isLoadingRacks } = useRacksQuery({
    location: locationId,
    enabled: showModal,
  })
  const { data: availableRackGroups = EMPTY_RACK_GROUPS, isLoading: isLoadingGroups } = useRackGroupsQuery({
    location: locationId,
    enabled: showModal,
  })

  const openModal = useCallback((locId?: string) => {
    setLocationId(locId)
    setShowModal(true)
  }, [])

  const closeModal = useCallback(() => {
    setShowModal(false)
  }, [])

  // Cascade clear: changing rack group resets rack + position
  const setSelectedRackGroup = useCallback((id: string) => {
    setSelectedRackGroupState(id)
    setSelectedRackState('')
    setPosition('')
  }, [])

  // Cascade clear: changing rack resets position
  const setSelectedRack = useCallback((id: string) => {
    setSelectedRackState(id)
    setPosition('')
  }, [])

  // Filter racks by selected rack group
  const availableRacks = useMemo(() => {
    if (!selectedRackGroup) return allRacks
    return allRacks.filter((rack) => rack.rack_group?.id === selectedRackGroup)
  }, [allRacks, selectedRackGroup])

  const selectedRackData = useMemo(
    () => allRacks.find((r) => r.id === selectedRack),
    [allRacks, selectedRack]
  )

  const availablePositions = useMemo(() => {
    if (!selectedRackData) return []
    return Array.from({ length: selectedRackData.u_height }, (_, i) => i + 1)
  }, [selectedRackData])

  const clearRack = useCallback(() => {
    setSelectedRackGroupState('')
    setSelectedRackState('')
    setSelectedFace('')
    setPosition('')
  }, [])

  const isLoading = isLoadingRacks || isLoadingGroups
  const isConfigured = selectedRack !== ''

  return useMemo(
    () => ({
      showModal,
      openModal,
      closeModal,
      selectedRackGroup,
      setSelectedRackGroup,
      selectedRack,
      setSelectedRack,
      selectedFace,
      setSelectedFace,
      position,
      setPosition,
      availableRacks,
      availableRackGroups,
      availablePositions,
      selectedRackData,
      isLoading,
      isConfigured,
      clearRack,
    }),
    [
      showModal,
      openModal,
      closeModal,
      selectedRackGroup,
      setSelectedRackGroup,
      selectedRack,
      setSelectedRack,
      selectedFace,
      position,
      availableRacks,
      availableRackGroups,
      availablePositions,
      selectedRackData,
      isLoading,
      isConfigured,
      clearRack,
    ]
  )
}
