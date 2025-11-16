'use client'

import { useState, useEffect, useRef } from 'react'
import { useAuthStore } from '@/lib/auth-store'
import { useApi } from '@/hooks/use-api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { 
  Network,
  Settings, 
  RefreshCw, 
  ChevronLeft, 
  ChevronRight,
  CheckCircle, 
  AlertCircle, 
  Info, 
  X,
  Plus,
  Minus,
  Edit,
  Upload,
  Users,
  GitBranch
} from 'lucide-react'

// Type definitions
interface Credential {
  id: string
  name: string
  type: string
  username: string
  source?: string // Add source field to distinguish general vs personal
}

interface GitRepository {
  id: string
  name: string
  category: string
  is_active: boolean
}

interface Template {
  id: string
  name: string
  category: string
}

interface DiscoveredDevice {
  ip: string
  hostname?: string
  platform?: string
  credential_id?: string
  is_authenticated?: boolean
  is_alive?: boolean
}

interface ScanResult {
  ip: string
  hostname?: string
  platform?: string
  credential_id?: string
  is_authenticated?: boolean
  is_alive?: boolean
  debug_info?: {
    device_type_tried?: string
    show_version_raw?: string
    show_version_structured?: Record<string, unknown>
    parsing_method?: string
    hostname_extracted?: string
    hostname_extraction_method?: string
    parsed_fields?: string[] | string
    error?: string
  }
}

interface DeviceMetadata {
  ip: string
  hostname?: string
  platform?: string
  role?: string
  location?: string
  device_type?: string
  namespace?: string
  status?: string
  interface_status?: string
  ip_status?: string
  secret_group_id?: string
  credential_id?: string
}

interface ScanJob {
  job_id: string
  state: string
  progress: {
    total: number
    scanned: number
    alive: number
    authenticated: number
    unreachable: number
    auth_failed: number
    driver_not_supported: number
  }
  results: ScanResult[]
}

interface StatusMessage {
  type: 'success' | 'error' | 'warning' | 'info'
  message: string
}

interface DropdownOption {
  id: string
  name: string
}

interface Location {
  id: string
  name: string
  parent?: { id: string }
  hierarchicalPath?: string
}

// Phase definitions
type WizardPhase = 'networks' | 'properties' | 'devices'

export function ScanAndAddPage() {
  // Auth and API
  const { isAuthenticated, logout } = useAuthStore()
  const { apiCall } = useApi()

  // State management
  const [currentPhase, setCurrentPhase] = useState<WizardPhase>('networks')
  const [isLoading, setIsLoading] = useState(false)
  const [statusMessage, setStatusMessage] = useState<StatusMessage | null>(null)

  // Phase 1: Networks
  const [cidrRanges, setCidrRanges] = useState<string[]>([''])

  // Phase 2: Properties
  const [selectedCredentials, setSelectedCredentials] = useState<string[]>([''])
  const [pingMode, setPingMode] = useState<string>('fping')
  const [discoveryMode, setDiscoveryMode] = useState<string>('ssh-login')
  const [selectedParserTemplates, setSelectedParserTemplates] = useState<(string | number)[]>([])
  const [gitRepository, setGitRepository] = useState<string>('')
  const [inventoryTemplate, setInventoryTemplate] = useState<string>('')
  const [filename, setFilename] = useState<string>('')
  const [commitAndPush, setCommitAndPush] = useState<boolean>(false)
  const [showParserTemplates, setShowParserTemplates] = useState<boolean>(true)

  // Phase 3: Devices
  const [scanJob, setScanJob] = useState<ScanJob | null>(null)
  const [discoveredDevices, setDiscoveredDevices] = useState<DiscoveredDevice[]>([])
  const [deviceMetadata, setDeviceMetadata] = useState<Record<string, DeviceMetadata>>({})
  const [selectedDevices, setSelectedDevices] = useState<Set<string>>(new Set())
  const [isScanning, setIsScanning] = useState<boolean>(false)
  const [isOnboarding, setIsOnboarding] = useState<boolean>(false)

  // Dropdown options
  const [credentials, setCredentials] = useState<Credential[]>([])
  const [gitRepositories, setGitRepositories] = useState<GitRepository[]>([])
  const [inventoryTemplates, setInventoryTemplates] = useState<Template[]>([])
  const [parserTemplates, setParserTemplates] = useState<Template[]>([])
  const [namespaces, setNamespaces] = useState<DropdownOption[]>([])
  const [roles, setRoles] = useState<DropdownOption[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [secretGroups, setSecretGroups] = useState<DropdownOption[]>([])
  const [platforms, setPlatforms] = useState<DropdownOption[]>([])
  const [deviceStatuses, setDeviceStatuses] = useState<DropdownOption[]>([])
  const [interfaceStatuses, setInterfaceStatuses] = useState<DropdownOption[]>([])
  const [ipAddressStatuses, setIpAddressStatuses] = useState<DropdownOption[]>([])

  // Modal states
  const [isDeviceModalOpen, setIsDeviceModalOpen] = useState<boolean>(false)
  const [isAssignAllModalOpen, setIsAssignAllModalOpen] = useState<boolean>(false)
  const [isScanResultsModalOpen, setIsScanResultsModalOpen] = useState<boolean>(false)
  const [editingDeviceIp, setEditingDeviceIp] = useState<string>('')
  const [assignAllData, setAssignAllData] = useState<Partial<DeviceMetadata>>({})
  // Modal-local location filter state for device configuration modal
  const [modalLocationSearch, setModalLocationSearch] = useState<string>('')
  const [modalLocationFiltered, setModalLocationFiltered] = useState<Location[]>([])
  const [modalShowLocationDropdown, setModalShowLocationDropdown] = useState<boolean>(false)
  const modalLocationRef = useRef<HTMLDivElement | null>(null)
  // Modal-local location filter state for "Assign to all" modal
  const [assignLocationSearch, setAssignLocationSearch] = useState<string>('')
  const [assignLocationFiltered, setAssignLocationFiltered] = useState<Location[]>([])
  const [assignShowLocationDropdown, setAssignShowLocationDropdown] = useState<boolean>(false)
  const assignLocationRef = useRef<HTMLDivElement | null>(null)

  // Check authentication
  useEffect(() => {
    if (!isAuthenticated) {
      logout()
    }
  }, [isAuthenticated, logout])

  // Load initial data
  useEffect(() => {
    loadInitialData()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // loadInitialData is stable and should run once on mount

  // Set default filename when component mounts
  useEffect(() => {
    if (!filename) {
      const now = new Date()
      const timestamp = now.getFullYear() + '-' + 
        String(now.getMonth() + 1).padStart(2, '0') + '-' + 
        String(now.getDate()).padStart(2, '0') + '-' + 
        String(now.getHours()).padStart(2, '0') + '.' + 
        String(now.getMinutes()).padStart(2, '0') + '.' + 
        String(now.getSeconds()).padStart(2, '0')
      setFilename(`inventory.pending.${timestamp}`)
    }
  }, [filename])

  // Auto-hide success messages after 3 seconds
  useEffect(() => {
    if (statusMessage?.type === 'success') {
      const timer = setTimeout(() => {
        setStatusMessage(null)
      }, 3000)
      
      return () => clearTimeout(timer)
    }
    return undefined
  }, [statusMessage])

  // Update parser templates visibility based on discovery mode
  useEffect(() => {
    setShowParserTemplates(discoveryMode === 'ssh-login')
    if (discoveryMode !== 'ssh-login') {
      setSelectedParserTemplates([])
    } else {
      // Auto-select if only one parser template is available when switching to SSH Login
      if (parserTemplates.length === 1 && selectedParserTemplates.length === 0 && parserTemplates[0]) {
        setSelectedParserTemplates([String(parserTemplates[0].id)])
      }
    }
  }, [discoveryMode, parserTemplates, selectedParserTemplates.length])

  const checkNautobotConnectivity = async () => {
    try {
      await apiCall('nautobot/health-check')
      return true
    } catch (error) {
      console.error('Nautobot connectivity check failed:', error)
      
      // Parse the error message to extract the actual error details
      let errorDetail = ''
      if (error instanceof Error) {
        const errorMsg = error.message
        
        // Check if it's a 503 error with JSON error response
        if (errorMsg.includes('503')) {
          // Try to extract JSON from the error message
          const jsonMatch = errorMsg.match(/API Error 503: (.+)$/)
          if (jsonMatch && jsonMatch[1]) {
            try {
              const errorData = JSON.parse(jsonMatch[1])
              errorDetail = errorData.detail || errorMsg
            } catch {
              // If JSON parsing fails, use the original message
              errorDetail = errorMsg
            }
          } else {
            errorDetail = errorMsg
          }
          
          // Check for specific error types in the detail message
          if (errorDetail.includes('Invalid or missing API token')) {
            setStatusMessage({
              type: 'error',
              message: 'Nautobot connection failed: Invalid or missing API token. Please check Nautobot settings in the administration panel.'
            })
          } else if (errorDetail.includes('Cannot reach Nautobot server')) {
            setStatusMessage({
              type: 'error',
              message: 'Nautobot connection failed: Cannot reach Nautobot server. Please check Nautobot URL and network connectivity.'
            })
          } else {
            setStatusMessage({
              type: 'error',
              message: errorDetail.startsWith('Nautobot connection failed:') ? errorDetail : `Nautobot connection failed: ${errorDetail}`
            })
          }
        } else {
          setStatusMessage({
            type: 'error',
            message: `Failed to connect to Nautobot: ${errorMsg}`
          })
        }
      } else {
        setStatusMessage({
          type: 'error',
          message: 'Failed to connect to Nautobot. Please check your configuration.'
        })
      }
      return false
    }
  }

  const loadInitialData = async () => {
    setIsLoading(true)
    try {
      // First check Nautobot connectivity
      const nautobotConnected = await checkNautobotConnectivity()
      if (!nautobotConnected) {
        return // Stop loading if Nautobot is not accessible
      }

      await Promise.all([
        loadCredentials(),
        loadGitRepositories(),
        loadInventoryTemplates(),
        loadParserTemplates(),
        loadNamespaces(),
        loadRoles(),
        loadLocations(),
        loadSecretGroups(),
        loadPlatforms(),
        loadDeviceStatuses(),
        loadInterfaceStatuses(),
        loadIpAddressStatuses()
      ])
    } catch (error) {
      console.error('Error loading initial data:', error)
      setStatusMessage({
        type: 'error',
        message: 'Failed to load initial data'
      })
    } finally {
      setIsLoading(false)
    }
  }

  const loadCredentials = async () => {
    try {
      // Load all credentials (includes both general and private from credentials database)
      const credentialsData = await apiCall<Credential[]>('credentials/')
      const validCredentials = Array.isArray(credentialsData) ? credentialsData
        .filter(cred => cred.type === 'ssh' || cred.type === 'tacacs')
        .map(cred => ({
          ...cred,
          name: `${cred.name} (${cred.type.toUpperCase()} - ${cred.username})`
        })) : []

      setCredentials(validCredentials)

      // Auto-select if only one credential is available and no credential is selected
      if (validCredentials.length === 1 && selectedCredentials.length === 1 && selectedCredentials[0] === '' && validCredentials[0]) {
        setSelectedCredentials([String(validCredentials[0].id)])
      }
    } catch (error) {
      console.error('Error loading credentials:', error)
      setCredentials([])
    }
  }

  const loadGitRepositories = async () => {
    try {
      const response = await apiCall<{ 
        repositories: GitRepository[];
      }>('git-repositories')
      
      // Extract repositories from the response
      const repos = response.repositories || []
      
      // Filter active repositories for onboarding category
      const onboardingRepos = repos.filter((r) => 
        r && typeof r === 'object' && 
        r.is_active && 
        r.category === 'onboarding'
      )
      
      setGitRepositories(onboardingRepos)
      
      // Auto-select if only one git repository is available and none is selected
      if (onboardingRepos.length === 1 && (!gitRepository || gitRepository === '') && onboardingRepos[0]) {
        setGitRepository(String(onboardingRepos[0].id))
      }
    } catch (error) {
      console.error('Error loading git repositories:', error)
      setGitRepositories([])
    }
  }

  const loadInventoryTemplates = async () => {
    try {
      const response = await apiCall<Template[] | { 
        results?: Template[];
        templates?: Template[];
        data?: Template[];
      }>('templates?category=onboarding&active_only=true')
      
      // Handle different response formats from the API
      let templates: Template[] = []
      if (Array.isArray(response)) {
        templates = response
      } else if (response && Array.isArray(response.results)) {
        templates = response.results
      } else if (response && Array.isArray(response.templates)) {
        templates = response.templates
      } else if (response && Array.isArray(response.data)) {
        templates = response.data
      }
      
      // Filter and ensure objects
      const validTemplates = templates.filter((t) => t && typeof t === 'object')
      setInventoryTemplates(validTemplates || [])
      
      // Auto-select if only one inventory template is available and none is selected
      if (validTemplates.length === 1 && (!inventoryTemplate || inventoryTemplate === '') && validTemplates[0]) {
        setInventoryTemplate(String(validTemplates[0].id))
      }
    } catch (error) {
      console.error('Error loading inventory templates:', error)
      setInventoryTemplates([])
    }
  }

  const loadParserTemplates = async () => {
    try {
      const response = await apiCall<Template[] | { 
        results?: Template[];
        templates?: Template[];
        data?: Template[];
      }>('templates?category=parser&active_only=true')
      
      // Handle different response formats from the API
      let templates: Template[] = []
      if (Array.isArray(response)) {
        templates = response
      } else if (response && Array.isArray(response.results)) {
        templates = response.results
      } else if (response && Array.isArray(response.templates)) {
        templates = response.templates
      } else if (response && Array.isArray(response.data)) {
        templates = response.data
      }
      
      // Filter and ensure objects
      const validTemplates = templates.filter((t) => t && typeof t === 'object')
      setParserTemplates(validTemplates || [])
      
      // Auto-select if only one parser template is available and SSH Login mode is enabled
      if (validTemplates.length === 1 && showParserTemplates && selectedParserTemplates.length === 0 && validTemplates[0]) {
        setSelectedParserTemplates([String(validTemplates[0].id)])
      }
    } catch (error) {
      console.error('Error loading parser templates:', error)
      setParserTemplates([])
    }
  }

  const loadNamespaces = async () => {
    try {
      const data = await apiCall<DropdownOption[]>('nautobot/namespaces')
      setNamespaces(data || [])
    } catch (error) {
      console.error('Error loading namespaces:', error)
    }
  }

  const loadRoles = async () => {
    try {
      const data = await apiCall<DropdownOption[]>('nautobot/roles/devices')
      setRoles(data || [])
    } catch (error) {
      console.error('Error loading roles:', error)
    }
  }

  const loadLocations = async () => {
    try {
      const data = await apiCall<Location[]>('nautobot/locations')
      const locationsWithPaths = buildLocationHierarchy(data || [])
      setLocations(locationsWithPaths)
    } catch (error) {
      console.error('Error loading locations:', error)
    }
  }

  // Sync modal search field when editingDeviceIp changes
  useEffect(() => {
    if (!editingDeviceIp) return
    const locId = deviceMetadata[editingDeviceIp]?.location
    if (locId) {
      const loc = locations.find(l => l.id === locId)
      setModalLocationSearch(loc?.hierarchicalPath || '')
      setModalLocationFiltered(locations)
    } else {
      setModalLocationSearch('')
      setModalLocationFiltered(locations)
    }
  }, [editingDeviceIp, deviceMetadata, locations])

  // Click outside handler for modal dropdown
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!modalLocationRef.current) return
      if (!modalLocationRef.current.contains(e.target as Node)) {
        setModalShowLocationDropdown(false)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  // Sync assign-modal search field when assignAllData.location changes
  useEffect(() => {
    const locId = assignAllData.location
    if (locId) {
      const loc = locations.find(l => l.id === locId)
      setAssignLocationSearch(loc?.hierarchicalPath || '')
      setAssignLocationFiltered(locations)
    } else {
      setAssignLocationSearch('')
      setAssignLocationFiltered(locations)
    }
  }, [assignAllData.location, locations])

  // Click outside handler for assign-all modal dropdown
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!assignLocationRef.current) return
      if (!assignLocationRef.current.contains(e.target as Node)) {
        setAssignShowLocationDropdown(false)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const loadSecretGroups = async () => {
    try {
      const data = await apiCall<DropdownOption[]>('nautobot/secret-groups')
      setSecretGroups(data || [])
    } catch (error) {
      console.error('Error loading secret groups:', error)
    }
  }

  const loadPlatforms = async () => {
    try {
      const data = await apiCall<DropdownOption[]>('nautobot/platforms')
      const platformsWithAutodetect = [
        { id: 'autodetect', name: 'Auto-detect' },
        ...(data || [])
      ]
      setPlatforms(platformsWithAutodetect)
    } catch (error) {
      console.error('Error loading platforms:', error)
    }
  }

  const loadDeviceStatuses = async () => {
    try {
      const data = await apiCall<DropdownOption[]>('nautobot/statuses/device')
      setDeviceStatuses(data || [])
    } catch (error) {
      console.error('Error loading device statuses:', error)
    }
  }

  const loadInterfaceStatuses = async () => {
    try {
      const data = await apiCall<DropdownOption[]>('nautobot/statuses/interface')
      setInterfaceStatuses(data || [])
    } catch (error) {
      console.error('Error loading interface statuses:', error)
    }
  }

  const loadIpAddressStatuses = async () => {
    try {
      const data = await apiCall<DropdownOption[]>('nautobot/statuses/ipaddress')
      setIpAddressStatuses(data || [])
    } catch (error) {
      console.error('Error loading IP address statuses:', error)
    }
  }

  const buildLocationHierarchy = (locationData: Location[]): Location[] => {
    const locationMap = new Map<string, Location>()
    locationData.forEach(loc => locationMap.set(loc.id, loc))

    const buildPath = (location: Location): string => {
      const parts: string[] = []
      let current: Location | null = location
      const visited = new Set<string>()

      while (current && !visited.has(current.id)) {
        visited.add(current.id)
        parts.unshift(current.name)
        current = current.parent?.id ? locationMap.get(current.parent.id) || null : null
      }

      return parts.length > 1 ? parts.join(' → ') : (parts[0] || '')
    }

    return locationData.map(location => ({
      ...location,
      hierarchicalPath: buildPath(location)
    })).sort((a, b) => (a.hierarchicalPath || '').localeCompare(b.hierarchicalPath || ''))
  }

  // Phase navigation
  const goToPhase = (phase: WizardPhase) => {
    setCurrentPhase(phase)
  }

  const goToNextPhase = () => {
    if (currentPhase === 'networks') {
      if (validateNetworksPhase()) {
        setCurrentPhase('properties')
      }
    } else if (currentPhase === 'properties') {
      if (validatePropertiesPhase()) {
        startNetworkScan()
      }
    }
  }

  const goToPreviousPhase = () => {
    if (currentPhase === 'properties') {
      setCurrentPhase('networks')
    } else if (currentPhase === 'devices') {
      setCurrentPhase('properties')
    }
  }

  // Validation functions
  const validateNetworksPhase = (): boolean => {
    const validCidrs = cidrRanges.filter(cidr => cidr.trim() !== '' && isValidCIDR(normalizeCIDR(cidr.trim())))
    
    if (validCidrs.length === 0) {
      setStatusMessage({
        type: 'error',
        message: 'Please enter at least one valid network range'
      })
      return false
    }

    return true
  }

  const validatePropertiesPhase = (): boolean => {
    // Check if any credentials are available
    if (!Array.isArray(credentials) || credentials.length === 0) {
      setStatusMessage({
        type: 'error',
        message: 'No credentials available. Please configure credentials first before proceeding.'
      })
      return false
    }

    const validCredentials = selectedCredentials.filter(id => 
      id && String(id).trim() !== ''
    )
    
    if (validCredentials.length === 0) {
      setStatusMessage({
        type: 'error',
        message: 'Please select at least one credential'
      })
      return false
    }

    if (showParserTemplates && selectedParserTemplates.length === 0) {
      setStatusMessage({
        type: 'error',
        message: 'Please select at least one parser template for SSH Login mode'
      })
      return false
    }

    return true
  }

  // CIDR utilities
  const normalizeCIDR = (input: string): string => {
    const trimmed = input.trim()
    // If it's just an IP address without CIDR notation, add /32
    if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(trimmed)) {
      return `${trimmed}/32`
    }
    return trimmed
  }

  const isValidCIDR = (cidr: string): boolean => {
    const cidrRegex = /^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/
    if (!cidrRegex.test(cidr)) return false

    const [ip, prefix] = cidr.split('/')
    if (!prefix || !ip) return false
    const prefixNum = parseInt(prefix)
    
    if (prefixNum < 22 || prefixNum > 32) return false

    return ip.split('.').every(octet => {
      const num = parseInt(octet)
      return num >= 0 && num <= 255
    })
  }

  // CIDR management
  const addCidrRange = () => {
    if (cidrRanges.length < 10) {
      setCidrRanges([...cidrRanges, ''])
    } else {
      setStatusMessage({
        type: 'warning',
        message: 'Maximum 10 CIDR ranges allowed'
      })
    }
  }

  const removeCidrRange = (index: number) => {
    if (cidrRanges.length > 1) {
      setCidrRanges(cidrRanges.filter((_, i) => i !== index))
    }
  }

  const updateCidrRange = (index: number, value: string) => {
    const newRanges = [...cidrRanges]
    newRanges[index] = value
    setCidrRanges(newRanges)
  }

  // Credential management
  const addCredential = () => {
    if (selectedCredentials.length < credentials.length) {
      setSelectedCredentials([...selectedCredentials, ''])
    } else {
      setStatusMessage({
        type: 'warning',
        message: 'All available credentials already added'
      })
    }
  }

  const removeCredential = (index: number) => {
    if (selectedCredentials.length > 1) {
      setSelectedCredentials(selectedCredentials.filter((_, i) => i !== index))
    }
  }

  const updateCredential = (index: number, value: string) => {
    const newCredentials = [...selectedCredentials]
    newCredentials[index] = value
    setSelectedCredentials(newCredentials)
  }

  // Network scanning
  const startNetworkScan = async () => {
    setIsScanning(true)
    setCurrentPhase('devices')

    try {
      const normalizedCidrs = cidrRanges
        .filter(cidr => cidr.trim() !== '')
        .map(cidr => normalizeCIDR(cidr.trim()))

      const validCredentials = selectedCredentials.filter(id => 
        id && String(id).trim() !== ''
      )

      const scanPayload = {
        cidrs: normalizedCidrs,
        credential_ids: validCredentials,
        discovery_mode: discoveryMode,
        ping_mode: pingMode,
        parser_template_ids: showParserTemplates 
          ? selectedParserTemplates.map(id => parseInt(String(id), 10)).filter(id => !isNaN(id))
          : []
      }

      // Debug: Log the scan payload
      console.log('=== SCAN PAYLOAD DEBUG ===')
      console.log('Show parser templates:', showParserTemplates)
      console.log('Selected parser templates (raw):', selectedParserTemplates)
      console.log('Converted parser template IDs:', scanPayload.parser_template_ids)
      console.log('Ping mode:', pingMode)
      console.log('Complete scan payload:', scanPayload)
      console.log('=== END SCAN PAYLOAD DEBUG ===')

      const response = await apiCall<ScanJob>('scan/start', {
        method: 'POST',
        body: scanPayload
      })

      setScanJob(response)
      setStatusMessage({
        type: 'success',
        message: `Network scan started with job ID: ${response.job_id}`
      })

      // Start polling for progress
      pollScanProgress(response.job_id)

    } catch (error) {
      console.error('Error starting network scan:', error)
      setStatusMessage({
        type: 'error',
        message: `Failed to start network scan: ${error instanceof Error ? error.message : 'Unknown error'}`
      })
      setIsScanning(false)
      setCurrentPhase('properties')
    }
  }

  const pollScanProgress = async (jobId: string) => {
    try {
      const status = await apiCall<ScanJob>(`scan/${jobId}/status`)
      setScanJob(status)

      if (status.state === 'finished') {
        setIsScanning(false)
        
        // Debug: Log the raw scan results
        console.log('=== SCAN RESULTS DEBUG ===')
        console.log('Raw status response:', status)
        console.log('Raw results array:', status.results)
        
        // Extract devices from scan results
        const devices = status.results?.map((result: ScanResult, index: number) => {
          console.log(`Processing result ${index}:`, result)
          const device = {
            ip: result.ip,
            hostname: result.hostname,
            platform: result.platform,
            credential_id: result.credential_id,
            is_authenticated: result.is_authenticated,
            is_alive: result.is_alive
          }
          console.log(`Mapped device ${index}:`, device)
          return device
        }) || []
        
        console.log('Final devices array:', devices)
        setDiscoveredDevices(devices)
        
        // Initialize device metadata with defaults
        const metadata: Record<string, DeviceMetadata> = {}
        devices.forEach((device, index) => {
          console.log(`Creating metadata for device ${index} (${device.ip}):`)
          console.log('  - hostname from scan:', device.hostname)
          console.log('  - platform from scan:', device.platform)
          console.log('  - credential_id from scan:', device.credential_id)
          
          // Determine default device type based on platform or other indicators
          let defaultDeviceType = 'cisco' // Default fallback
          if (device.platform) {
            const platformLower = String(device.platform).toLowerCase()
            // If platform contains linux, ubuntu, centos, rhel, etc., assume it's a Linux server
            if (platformLower.includes('linux') || 
                platformLower.includes('ubuntu') || 
                platformLower.includes('centos') || 
                platformLower.includes('rhel') || 
                platformLower.includes('debian') ||
                platformLower.includes('server')) {
              defaultDeviceType = 'linux'
            }
          }
          
          // Determine default role based on device type
          const defaultRole = defaultDeviceType === 'linux' ? 'server' : 'network'
          
          metadata[device.ip] = {
            ip: device.ip,
            hostname: device.hostname || '',
            platform: device.platform || (discoveryMode === 'ssh-login' ? 'autodetect' : ''),
            credential_id: device.credential_id || '',
            role: defaultRole,
            device_type: defaultDeviceType,
            status: 'Active',
            interface_status: 'Active',
            ip_status: 'Active',
            namespace: 'Global'
          }
          console.log('  - detected device_type:', defaultDeviceType)
          console.log('  - final metadata:', metadata[device.ip])
        })
        console.log('Complete metadata object:', metadata)
        setDeviceMetadata(metadata)
        console.log('=== END SCAN RESULTS DEBUG ===')
        
        // Check if scan completed but no devices were reachable
        if (devices.length === 0 && status.progress && (status.progress.unreachable > 0 || status.progress.auth_failed > 0)) {
          // Show scan results modal when no devices found but some were scanned
          setIsScanResultsModalOpen(true)
        }
        
        setStatusMessage({
          type: 'success',
          message: 'Network scan completed successfully'
        })
      } else if (status.state === 'failed') {
        setIsScanning(false)
        setStatusMessage({
          type: 'error',
          message: 'Network scan failed'
        })
      } else {
        // Continue polling
        setTimeout(() => pollScanProgress(jobId), 2000)
      }
    } catch (error) {
      console.error('Error polling scan progress:', error)
      setIsScanning(false)
      setStatusMessage({
        type: 'error',
        message: 'Lost connection to scan job'
      })
    }
  }

  // Device selection
  const toggleDeviceSelection = (ip: string) => {
    const newSelection = new Set(selectedDevices)
    if (newSelection.has(ip)) {
      newSelection.delete(ip)
    } else {
      newSelection.add(ip)
    }
    setSelectedDevices(newSelection)
  }

  const toggleAllDevices = () => {
    if (selectedDevices.size === discoveredDevices.length) {
      setSelectedDevices(new Set())
    } else {
      setSelectedDevices(new Set(discoveredDevices.map(d => d.ip)))
    }
  }

  // Device onboarding
  const onboardSelectedDevices = async () => {
    if (selectedDevices.size === 0) {
      setStatusMessage({
        type: 'warning',
        message: 'Please select devices to onboard'
      })
      return
    }

    setIsOnboarding(true)

    try {
      const selectedIps = Array.from(selectedDevices)
      const devicesToOnboard = selectedIps.map(ip => deviceMetadata[ip]).filter((device): device is NonNullable<typeof device> => Boolean(device))

      if (!scanJob?.job_id) {
        setStatusMessage({
          type: 'error',
          message: 'No scan job available for onboarding'
        })
        return
      }

      // Prepare all devices for batch onboarding via scan job endpoint
      // The backend will automatically separate Cisco vs Linux devices based on device_type
      const transformedDevices = devicesToOnboard.map(device => ({
        ip: device.ip,
        credential_id: device.credential_id ? parseInt(String(device.credential_id), 10) : 0,
        device_type: device.device_type || 'cisco', // Default to cisco if not specified
        hostname: device.hostname,
        platform: device.platform === 'autodetect' ? 'auto-detect' : device.platform,
        // Cisco-specific fields (ignored for Linux devices by backend)
        location: device.location,
        namespace: device.namespace,
        role: device.role,
        status: device.status,
        interface_status: device.interface_status,
        ip_status: device.ip_status,
      }))

      // Collect Linux onboarding extras (only used for Linux devices)
      const extras: {
        git_repository_id?: number;
        git_repository_name?: string;
        inventory_template_id?: number;
        inventory_template_name?: string;
        parser_template_ids?: number[];
        parser_template_names?: string[];
        filename?: string;
        auto_commit?: boolean;
        auto_push?: boolean;
        commit_message?: string;
      } = {}
      if (gitRepository) {
        const repoId = parseInt(gitRepository, 10)
        if (!isNaN(repoId)) {
          extras.git_repository_id = repoId
        } else {
          extras.git_repository_name = gitRepository
        }
      }
      if (inventoryTemplate) {
        const templateId = parseInt(inventoryTemplate, 10)
        if (!isNaN(templateId)) {
          extras.inventory_template_id = templateId
        }
      }
      if (filename) {
        extras.filename = filename.trim()
      }
      if (commitAndPush) {
        extras.auto_commit = true
        extras.auto_push = true
        // Set commit message to filename basename
        if (filename) {
          try {
            extras.commit_message = filename.trim().split('/').pop()
          } catch {
            extras.commit_message = filename.trim()
          }
        }
      }

      const onboardPayload = {
        devices: transformedDevices,
        ...extras
      }

      console.log('Onboarding payload:', onboardPayload)

      const response = await apiCall<{
        cisco_queued?: number;
        linux_added?: number;
        inventory_path?: string;
        accepted?: number;
      }>(`scan/${scanJob.job_id}/onboard`, {
        method: 'POST',
        body: onboardPayload
      })

      console.log('Onboard response:', response)

      // Build success message from response
      const messages: string[] = []
      if (response.cisco_queued && response.cisco_queued > 0) {
        messages.push(`${response.cisco_queued} Cisco device(s) queued for onboarding`)
      }
      if (response.linux_added && response.linux_added > 0) {
        messages.push(`${response.linux_added} Linux device(s) added to inventory`)
      }
      if (response.inventory_path) {
        messages.push(`Inventory created: ${response.inventory_path}`)
      }

      const finalMessage = messages.length > 0 
        ? messages.join(', ') 
        : `${response.accepted || 0} device(s) processed for onboarding`

      setStatusMessage({
        type: 'success',
        message: finalMessage
      })

      // Clear selection after onboarding
      setSelectedDevices(new Set())

    } catch (error) {
      console.error('Error during device onboarding:', error)
      setStatusMessage({
        type: 'error',
        message: `Failed to onboard devices: ${error instanceof Error ? error.message : 'Unknown error'}`
      })
    } finally {
      setIsOnboarding(false)
    }
  }

  // Device configuration modal
  const openDeviceModal = (ip: string) => {
    setEditingDeviceIp(ip)
    setIsDeviceModalOpen(true)
  }

  const saveDeviceConfiguration = () => {
    setIsDeviceModalOpen(false)
    setEditingDeviceIp('')
  }

  const updateDeviceMetadata = (ip: string, field: keyof DeviceMetadata, value: string) => {
    setDeviceMetadata(prev => ({
      ...prev,
      [ip]: {
        ...(prev[ip] || {}),
        [field]: value
      } as DeviceMetadata
    }))
  }

  // Assign to all modal
  const openAssignAllModal = () => {
    if (selectedDevices.size === 0) {
      setStatusMessage({
        type: 'warning',
        message: 'Please select devices first'
      })
      return
    }
    setAssignAllData({})
    setIsAssignAllModalOpen(true)
  }

  const applyAssignToAll = () => {
    const selectedIps = Array.from(selectedDevices)
    const updates = Object.fromEntries(
      Object.entries(assignAllData).filter(([, value]) => value && value.trim() !== '')
    )

    if (Object.keys(updates).length === 0) {
      setStatusMessage({
        type: 'warning',
        message: 'No values to assign'
      })
      return
    }

    selectedIps.forEach(ip => {
      setDeviceMetadata(prev => ({
        ...prev,
        [ip]: {
          ...(prev[ip] || {}),
          ...updates
        } as DeviceMetadata
      }))
    })

    setIsAssignAllModalOpen(false)
    setStatusMessage({
      type: 'success',
      message: `Applied settings to ${selectedIps.length} selected devices`
    })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading scan and add wizard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8 p-6 bg-slate-50/50 min-h-screen">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold text-slate-900">Scan & Add Devices</h1>
          <p className="text-slate-600">Discover and onboard network devices to your infrastructure</p>
        </div>
      </div>

      {/* Status Messages */}
      {statusMessage && (
        <Alert className={`analytics-card border-0 ${
          statusMessage.type === 'error' ? 'border-red-500 bg-red-50' :
          statusMessage.type === 'success' ? 'border-green-500 bg-green-50' :
          statusMessage.type === 'warning' ? 'border-yellow-500 bg-yellow-50' :
          'border-blue-500 bg-blue-50'
        }`}>
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-2">
              {statusMessage.type === 'error' && <AlertCircle className="h-4 w-4 text-red-500 mt-0.5" />}
              {statusMessage.type === 'success' && <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />}
              {statusMessage.type === 'warning' && <AlertCircle className="h-4 w-4 text-yellow-500 mt-0.5" />}
              {statusMessage.type === 'info' && <Info className="h-4 w-4 text-blue-500 mt-0.5" />}
              <AlertDescription className="text-sm">
                {statusMessage.message}
              </AlertDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setStatusMessage(null)}
              className="h-6 w-6 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </Alert>
      )}

      {/* Wizard Steps */}
      <div className="flex items-center justify-center space-x-8 mb-8">
        <div className={`flex flex-col items-center ${currentPhase === 'networks' ? 'text-blue-600' : 'text-gray-400'}`}>
          <div className={`w-10 h-10 rounded-full border-2 flex items-center justify-center mb-2 ${
            currentPhase === 'networks' ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-300'
          }`}>
            <Network className="h-5 w-5" />
          </div>
          <span className="text-sm font-medium">Networks</span>
        </div>
        
        <div className={`w-20 h-px ${currentPhase !== 'networks' ? 'bg-blue-600' : 'bg-gray-300'}`} />
        
        <div className={`flex flex-col items-center ${currentPhase === 'properties' ? 'text-blue-600' : 'text-gray-400'}`}>
          <div className={`w-10 h-10 rounded-full border-2 flex items-center justify-center mb-2 ${
            currentPhase === 'properties' ? 'border-blue-600 bg-blue-600 text-white' : 
            currentPhase === 'devices' ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-300'
          }`}>
            <Settings className="h-5 w-5" />
          </div>
          <span className="text-sm font-medium">Properties</span>
        </div>
        
        <div className={`w-20 h-px ${currentPhase === 'devices' ? 'bg-blue-600' : 'bg-gray-300'}`} />
        
        <div className={`flex flex-col items-center ${currentPhase === 'devices' ? 'text-blue-600' : 'text-gray-400'}`}>
          <div className={`w-10 h-10 rounded-full border-2 flex items-center justify-center mb-2 ${
            currentPhase === 'devices' ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-300'
          }`}>
            <Users className="h-5 w-5" />
          </div>
          <span className="text-sm font-medium">Device Onboarding</span>
        </div>
      </div>

      {/* Phase 1: Networks */}
      {currentPhase === 'networks' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Network className="h-5 w-5" />
              <span>Network Ranges</span>
            </CardTitle>
            <CardDescription>
              Enter the network ranges to scan for devices. You can enter IP addresses or CIDR notation.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {cidrRanges.map((cidr, index) => (
              <div key={index} className="flex items-center space-x-2">
                <Input
                  value={cidr}
                  onChange={(e) => updateCidrRange(index, e.target.value)}
                  placeholder="192.168.1.0/24 or 192.168.1.1"
                  className="flex-1 border-2 border-slate-300 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 shadow-sm"
                />
                {cidrRanges.length > 1 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => removeCidrRange(index)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                )}
                {index === cidrRanges.length - 1 && cidrRanges.length < 10 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={addCidrRange}
                    className="text-green-600 hover:text-green-700"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
            
            <div className="flex justify-between pt-4">
              <div /> {/* Empty div for spacing */}
              <Button onClick={goToNextPhase} className="flex items-center space-x-2 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700">
                <span>Continue to Properties</span>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Phase 2: Properties */}
      {currentPhase === 'properties' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Login & Discovery Panel */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Settings className="h-5 w-5" />
                <span>Login & Discovery</span>
              </CardTitle>
              <CardDescription>
                Configure credentials and discovery mode for network scanning
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Credentials */}
              <div className="space-y-2">
                <Label>System & Personal Credentials <span className="text-red-500">*</span></Label>
                <p className="text-sm text-gray-600 mb-2">
                  Choose from system-wide credentials or your personal credentials for device authentication
                </p>
                {selectedCredentials.map((credentialId, index) => (
                  <div key={index} className="flex items-center space-x-2">
                    <Select 
                      value={String(credentialId)} 
                      onValueChange={(value) => updateCredential(index, value)}
                      disabled={!Array.isArray(credentials) || credentials.length === 0}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Select credentials..." />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.isArray(credentials) && credentials.length > 0 ? (
                          credentials.map(credential => (
                            <SelectItem key={`credential-${credential.id}`} value={String(credential.id)}>
                              <div className="flex items-center space-x-2 w-full">
                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                  credential.source === 'private'
                                    ? 'bg-blue-100 text-blue-800'
                                    : 'bg-gray-100 text-gray-800'
                                }`}>
                                  {credential.source === 'private' ? 'Private' : 'General'}
                                </span>
                                <span className="flex-1">{credential.name}</span>
                              </div>
                            </SelectItem>
                          ))
                        ) : (
                          <div className="px-3 py-2 text-sm text-gray-500 italic">
                            No credentials available. Please configure credentials first.
                          </div>
                        )}
                      </SelectContent>
                    </Select>
                    {selectedCredentials.length > 1 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => removeCredential(index)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                    )}
                    {index === selectedCredentials.length - 1 && selectedCredentials.length < credentials.length && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={addCredential}
                        className="text-green-600 hover:text-green-700"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>

              {/* Ping Mode */}
              <div className="space-y-2">
                <Label htmlFor="ping-mode">Ping Mode <span className="text-red-500">*</span></Label>
                <Select value={pingMode} onValueChange={setPingMode}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select ping mode..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fping">fping</SelectItem>
                    <SelectItem value="ping">ping</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Discovery Mode */}
              <div className="space-y-2">
                <Label htmlFor="discovery-mode">Network Discovery Mode <span className="text-red-500">*</span></Label>
                <Select value={discoveryMode} onValueChange={setDiscoveryMode}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select discovery mode..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ssh-login">SSH Login</SelectItem>
                    <SelectItem value="napalm">Napalm</SelectItem>
                    <SelectItem value="netmiko">Netmiko</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Parser Templates (SSH Login only) */}
              {showParserTemplates && (
                <div className="space-y-2">
                  <Label>Select Parser Templates <span className="text-red-500">*</span></Label>
                  <div className="border rounded-md p-3 max-h-40 overflow-y-auto">
                    {Array.isArray(parserTemplates) && parserTemplates.length > 0 ? (
                      parserTemplates.map(template => (
                        <div key={`parser-template-${template.id}`} className="flex items-center space-x-2 py-1">
                          <Checkbox
                            id={String(template.id)}
                            checked={selectedParserTemplates.includes(String(template.id))}
                            onCheckedChange={(checked) => {
                              const templateIdStr = String(template.id)
                              if (checked) {
                                setSelectedParserTemplates([...selectedParserTemplates, templateIdStr])
                              } else {
                                setSelectedParserTemplates(selectedParserTemplates.filter(id => id !== templateIdStr))
                              }
                            }}
                          />
                          <Label htmlFor={String(template.id)} className="text-sm cursor-pointer">
                            {template.name}
                          </Label>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-gray-500 italic">No parser templates available</p>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Linux Onboarding Panel */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <GitBranch className="h-5 w-5" />
                <span>Linux Onboarding</span>
              </CardTitle>
              <CardDescription>
                Configure Git repository and template settings for Linux device onboarding
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Git Repository */}
              <div className="space-y-2">
                <Label htmlFor="git-repository">Git Repository (Onboarding)</Label>
                <Select value={gitRepository} onValueChange={setGitRepository}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select git repository..." />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.isArray(gitRepositories) && gitRepositories
                      .filter(repo => repo.id && String(repo.id).trim() !== '')
                      .map(repo => (
                      <SelectItem key={`git-repo-${repo.id}`} value={String(repo.id)}>
                        {repo.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Inventory Template */}
              <div className="space-y-2">
                <Label htmlFor="inventory-template">Inventory Template</Label>
                <Select value={inventoryTemplate} onValueChange={setInventoryTemplate}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select inventory template..." />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.isArray(inventoryTemplates) && inventoryTemplates
                      .filter(template => template.id && String(template.id).trim() !== '')
                      .map(template => (
                      <SelectItem key={`inventory-template-${template.id}`} value={String(template.id)}>
                        {template.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Filename */}
              <div className="space-y-2">
                <Label htmlFor="filename">Filename</Label>
                <Input
                  id="filename"
                  value={filename}
                  onChange={(e) => setFilename(e.target.value)}
                  placeholder="inventory.pending.2024-01-01-12.00.00"
                  className="border-2 border-slate-300 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 shadow-sm"
                />
              </div>

              {/* Commit & Push */}
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="commit-push"
                  checked={commitAndPush}
                  onCheckedChange={(checked) => setCommitAndPush(checked === true)}
                />
                <Label htmlFor="commit-push" className="text-sm cursor-pointer">
                  Commit & Push (auto-commit and push the created file)
                </Label>
              </div>
            </CardContent>
          </Card>

          {/* Navigation */}
          <div className="lg:col-span-2">
            <div className="flex justify-between pt-4">
              <Button 
                variant="outline" 
                onClick={goToPreviousPhase}
                className="flex items-center space-x-2"
              >
                <ChevronLeft className="h-4 w-4" />
                <span>Back to Networks</span>
              </Button>
              <Button 
                onClick={goToNextPhase}
                className="flex items-center space-x-2 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700"
                disabled={isScanning}
              >
                {isScanning ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                    <span>Starting Scan...</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4" />
                    <span>Start Network Scan</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Phase 3: Device Onboarding */}
      {currentPhase === 'devices' && (
        <div className="space-y-6">
          {/* Scan Progress */}
          {isScanning && scanJob && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <RefreshCw className="h-5 w-5 animate-spin" />
                  <span>Network Scan Progress</span>
                </CardTitle>
                <CardDescription>
                  Job ID: {scanJob.job_id} | Status: {scanJob.state}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-sm">
                    <span>Progress: {scanJob.progress?.scanned || 0} / {scanJob.progress?.total || 0}</span>
                    <span>{scanJob.progress?.total > 0 ? Math.round((scanJob.progress.scanned / scanJob.progress.total) * 100) : 0}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                      style={{ 
                        width: `${scanJob.progress?.total > 0 ? (scanJob.progress.scanned / scanJob.progress.total) * 100 : 0}%` 
                      }}
                    />
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                    <div className="text-center">
                      <div className="text-lg font-semibold text-green-600">{scanJob.progress?.alive || 0}</div>
                      <div className="text-gray-600">Alive</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-semibold text-blue-600">{scanJob.progress?.authenticated || 0}</div>
                      <div className="text-gray-600">Authenticated</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-semibold text-red-600">{scanJob.progress?.unreachable || 0}</div>
                      <div className="text-gray-600">Unreachable</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-semibold text-orange-600">{scanJob.progress?.auth_failed || 0}</div>
                      <div className="text-gray-600">Auth Failed</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-semibold text-gray-600">{scanJob.progress?.driver_not_supported || 0}</div>
                      <div className="text-gray-600">Driver N/A</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Discovered Devices */}
          {!isScanning && discoveredDevices.length > 0 && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center space-x-2">
                      <Users className="h-5 w-5" />
                      <span>Discovered Devices</span>
                    </CardTitle>
                    <CardDescription>
                      Configure and select devices to onboard
                    </CardDescription>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={openAssignAllModal}
                      disabled={selectedDevices.size === 0}
                    >
                      <Edit className="h-4 w-4 mr-1" />
                      Assign to All
                    </Button>
                    <Button
                      onClick={onboardSelectedDevices}
                      disabled={selectedDevices.size === 0 || isOnboarding}
                      className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700"
                    >
                      {isOnboarding ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                          Onboarding...
                        </>
                      ) : (
                        <>
                          <Upload className="h-4 w-4 mr-2" />
                          Onboard {selectedDevices.size > 0 ? `${selectedDevices.size} ` : ''}Device{selectedDevices.size !== 1 ? 's' : ''}
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-2">
                          <Checkbox
                            checked={selectedDevices.size === discoveredDevices.length && discoveredDevices.length > 0}
                            onCheckedChange={toggleAllDevices}
                          />
                        </th>
                        <th className="text-left p-2">IP Address</th>
                        <th className="text-left p-2">Hostname</th>
                        <th className="text-left p-2">Platform</th>
                        <th className="text-left p-2">Role</th>
                        <th className="text-left p-2">Location</th>
                        <th className="text-left p-2">Credential</th>
                        <th className="text-left p-2">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {discoveredDevices.map((device) => {
                        const metadata = deviceMetadata[device.ip]
                        const credential = credentials.find(c => c.id === device.credential_id)
                        const location = locations.find(l => l.id === metadata?.location)
                        
                        // Debug: Log device table data
                        console.log(`=== DEVICE TABLE ROW DEBUG for ${device.ip} ===`)
                        console.log('Device object:', device)
                        console.log('Metadata object:', metadata)
                        console.log('Displaying hostname:', metadata?.hostname || 'Unknown')
                        console.log('Displaying platform:', metadata?.platform || 'Unknown')
                        console.log('=== END DEVICE TABLE ROW DEBUG ===')
                        
                        return (
                          <tr key={device.ip} className="border-b hover:bg-gray-50">
                            <td className="p-2">
                              <Checkbox
                                checked={selectedDevices.has(device.ip)}
                                onCheckedChange={() => toggleDeviceSelection(device.ip)}
                              />
                            </td>
                            <td className="p-2 font-mono text-sm">{device.ip}</td>
                            <td className="p-2">{metadata?.hostname || 'Unknown'}</td>
                            <td className="p-2">{metadata?.platform || 'Unknown'}</td>
                            <td className="p-2">{metadata?.role || 'unknown'}</td>
                            <td className="p-2">{location?.hierarchicalPath || location?.name || 'Unknown'}</td>
                            <td className="p-2">{credential?.name || 'Unknown'}</td>
                            <td className="p-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openDeviceModal(device.ip)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Navigation */}
          {!isScanning && (
            <div className="flex justify-between">
              <Button 
                variant="outline" 
                onClick={goToPreviousPhase}
                className="flex items-center space-x-2"
              >
                <ChevronLeft className="h-4 w-4" />
                <span>Back to Properties</span>
              </Button>
              
              {discoveredDevices.length === 0 && (
                <Button 
                  onClick={() => goToPhase('networks')}
                  variant="outline"
                  className="flex items-center space-x-2"
                >
                  <RefreshCw className="h-4 w-4" />
                  <span>Start New Scan</span>
                </Button>
              )}
            </div>
          )}
        </div>
      )}
      
      {/* Device Configuration Modal */}
      <Dialog open={isDeviceModalOpen} onOpenChange={setIsDeviceModalOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Configure Device: {editingDeviceIp}</DialogTitle>
            <DialogDescription>
              Set device properties for onboarding
            </DialogDescription>
          </DialogHeader>
          
          {editingDeviceIp && deviceMetadata[editingDeviceIp] && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Hostname */}
              <div className="space-y-2">
                <Label htmlFor="device-hostname">Hostname</Label>
                <Input
                  id="device-hostname"
                  value={deviceMetadata[editingDeviceIp]?.hostname || ''}
                  onChange={(e) => updateDeviceMetadata(editingDeviceIp, 'hostname', e.target.value)}
                  placeholder="Enter hostname"
                  className="border-2 border-slate-300 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 shadow-sm"
                />
              </div>

              {/* Platform */}
              <div className="space-y-2">
                <Label htmlFor="device-platform">Platform</Label>
                <Select 
                  value={deviceMetadata[editingDeviceIp]?.platform || ''} 
                  onValueChange={(value) => updateDeviceMetadata(editingDeviceIp, 'platform', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select platform..." />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.isArray(platforms) && platforms
                      .filter(platform => platform.id && String(platform.id).trim() !== '')
                      .map(platform => (
                      <SelectItem key={`platform-${platform.id}`} value={String(platform.id)}>
                        {platform.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Device Type */}
              <div className="space-y-2">
                <Label htmlFor="device-type">Device Type</Label>
                <Select 
                  value={deviceMetadata[editingDeviceIp]?.device_type || 'cisco'} 
                  onValueChange={(value) => updateDeviceMetadata(editingDeviceIp, 'device_type', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select device type..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cisco">Cisco</SelectItem>
                    <SelectItem value="linux">Linux</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Role */}
              <div className="space-y-2">
                <Label htmlFor="device-role">Role</Label>
                <Select 
                  value={deviceMetadata[editingDeviceIp]?.role || ''} 
                  onValueChange={(value) => updateDeviceMetadata(editingDeviceIp, 'role', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select role..." />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.isArray(roles) && roles
                      .filter(role => role.name && String(role.name).trim() !== '')
                      .map(role => (
                      <SelectItem key={`role-${role.id}`} value={String(role.name)}>
                        {role.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Location */}
              <div className="space-y-2">
                <Label htmlFor="device-location">Location</Label>
                <div className="relative" ref={modalLocationRef}>
                  <Input
                    placeholder="Select location..."
                    value={modalLocationSearch}
                    onChange={(e) => {
                      const q = e.target.value
                      setModalLocationSearch(q)
                      if (!q.trim()) setModalLocationFiltered(locations)
                      else setModalLocationFiltered(locations.filter(l => (l.hierarchicalPath || '').toLowerCase().includes(q.toLowerCase())))
                      setModalShowLocationDropdown(true)
                    }}
                    onFocus={() => setModalShowLocationDropdown(true)}
                    className="h-8 text-sm border-2 bg-white border-gray-300 hover:border-gray-400 focus:border-blue-500"
                  />
                  {modalShowLocationDropdown && (
                    <div className="absolute z-50 mt-1 left-0 right-0 bg-white border border-gray-200 rounded-md shadow-lg max-h-48 overflow-y-auto">
                      {modalLocationFiltered.length > 0 ? (
                        modalLocationFiltered.map(loc => (
                          <div
                            key={`modal-location-${loc.id}`}
                            className="px-3 py-2 hover:bg-gray-100 cursor-pointer text-sm border-b border-gray-100 last:border-b-0"
                            onClick={() => {
                              updateDeviceMetadata(editingDeviceIp, 'location', loc.id)
                              setModalLocationSearch(loc.hierarchicalPath || loc.name)
                              setModalShowLocationDropdown(false)
                            }}
                          >
                            {loc.hierarchicalPath || loc.name}
                          </div>
                        ))
                      ) : (
                        <div className="px-3 py-2 text-sm text-gray-500 italic">No locations found</div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Namespace */}
              <div className="space-y-2">
                <Label htmlFor="device-namespace">Namespace</Label>
                <Select 
                  value={deviceMetadata[editingDeviceIp]?.namespace || ''} 
                  onValueChange={(value) => updateDeviceMetadata(editingDeviceIp, 'namespace', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select namespace..." />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.isArray(namespaces) && namespaces
                      .filter(namespace => namespace.name && String(namespace.name).trim() !== '')
                      .map(namespace => (
                      <SelectItem key={`namespace-${namespace.id}`} value={String(namespace.name)}>
                        {namespace.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Status */}
              <div className="space-y-2">
                <Label htmlFor="device-status">Status</Label>
                <Select 
                  value={deviceMetadata[editingDeviceIp]?.status || ''} 
                  onValueChange={(value) => updateDeviceMetadata(editingDeviceIp, 'status', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select status..." />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.isArray(deviceStatuses) && deviceStatuses
                      .filter(status => status.name && String(status.name).trim() !== '')
                      .map(status => (
                      <SelectItem key={`device-status-${status.id}`} value={String(status.name)}>
                        {status.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Interface Status */}
              <div className="space-y-2">
                <Label htmlFor="device-interface-status">Interface Status</Label>
                <Select 
                  value={deviceMetadata[editingDeviceIp]?.interface_status || ''} 
                  onValueChange={(value) => updateDeviceMetadata(editingDeviceIp, 'interface_status', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select interface status..." />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.isArray(interfaceStatuses) && interfaceStatuses
                      .filter(status => status.name && String(status.name).trim() !== '')
                      .map(status => (
                      <SelectItem key={`interface-status-${status.id}`} value={String(status.name)}>
                        {status.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* IP Status */}
              <div className="space-y-2">
                <Label htmlFor="device-ip-status">IP Address Status</Label>
                <Select 
                  value={deviceMetadata[editingDeviceIp]?.ip_status || ''} 
                  onValueChange={(value) => updateDeviceMetadata(editingDeviceIp, 'ip_status', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select IP status..." />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.isArray(ipAddressStatuses) && ipAddressStatuses
                      .filter(status => status.name && String(status.name).trim() !== '')
                      .map(status => (
                      <SelectItem key={`ip-status-${status.id}`} value={String(status.name)}>
                        {status.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Secret Group */}
              <div className="space-y-2">
                <Label htmlFor="device-secret-group">Secret Group</Label>
                <Select 
                  value={deviceMetadata[editingDeviceIp]?.secret_group_id || ''} 
                  onValueChange={(value) => updateDeviceMetadata(editingDeviceIp, 'secret_group_id', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select secret group..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— none —</SelectItem>
                    {Array.isArray(secretGroups) && secretGroups
                      .filter(group => group.id && String(group.id).trim() !== '')
                      .map(group => (
                      <SelectItem key={`secret-group-${group.id}`} value={String(group.id)}>
                        {group.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeviceModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveDeviceConfiguration} className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700">
              Save Configuration
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign to All Modal */}
      <Dialog open={isAssignAllModalOpen} onOpenChange={setIsAssignAllModalOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Assign to All Selected Devices</DialogTitle>
            <DialogDescription>
              Set common properties for all {selectedDevices.size} selected devices. Leave fields empty to keep existing values.
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Hostname */}
            <div className="space-y-2">
              <Label htmlFor="assign-hostname">Hostname</Label>
              <Input
                id="assign-hostname"
                value={assignAllData.hostname || ''}
                onChange={(e) => setAssignAllData(prev => ({ ...prev, hostname: e.target.value }))}
                placeholder="Leave empty to keep existing"
                className="border-2 border-slate-300 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 shadow-sm"
              />
            </div>

            {/* Platform */}
            <div className="space-y-2">
              <Label htmlFor="assign-platform">Platform</Label>
              <Select 
                value={assignAllData.platform || ''} 
                onValueChange={(value) => setAssignAllData(prev => ({ ...prev, platform: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Leave empty to keep existing" />
                </SelectTrigger>
                <SelectContent>
                  {Array.isArray(platforms) && platforms
                    .filter(platform => platform.id && String(platform.id).trim() !== '')
                    .map(platform => (
                    <SelectItem key={`assign-platform-${platform.id}`} value={String(platform.id)}>
                      {platform.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Role */}
            <div className="space-y-2">
              <Label htmlFor="assign-role">Role</Label>
              <Select 
                value={assignAllData.role || ''} 
                onValueChange={(value) => setAssignAllData(prev => ({ ...prev, role: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Leave empty to keep existing" />
                </SelectTrigger>
                <SelectContent>
                  {Array.isArray(roles) && roles
                    .filter(role => role.name && String(role.name).trim() !== '')
                    .map(role => (
                    <SelectItem key={`assign-role-${role.id}`} value={String(role.name)}>
                      {role.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Location */}
            <div className="space-y-2">
              <Label htmlFor="assign-location">Location</Label>
              <div className="relative" ref={assignLocationRef}>
                <Input
                  placeholder="Leave empty to keep existing"
                  value={assignLocationSearch}
                  onChange={(e) => {
                    const q = e.target.value
                    setAssignLocationSearch(q)
                    if (!q.trim()) setAssignLocationFiltered(locations)
                    else setAssignLocationFiltered(locations.filter(l => (l.hierarchicalPath || '').toLowerCase().includes(q.toLowerCase())))
                    setAssignShowLocationDropdown(true)
                  }}
                  onFocus={() => setAssignShowLocationDropdown(true)}
                  className="h-8 text-sm border-2 bg-white border-gray-300 hover:border-gray-400 focus:border-blue-500"
                />
                {assignShowLocationDropdown && (
                  <div className="absolute z-50 mt-1 left-0 right-0 bg-white border border-gray-200 rounded-md shadow-lg max-h-48 overflow-y-auto">
                    {assignLocationFiltered.length > 0 ? (
                      assignLocationFiltered.map(loc => (
                        <div
                          key={`assign-location-${loc.id}`}
                          className="px-3 py-2 hover:bg-gray-100 cursor-pointer text-sm border-b border-gray-100 last:border-b-0"
                          onClick={() => {
                            setAssignAllData(prev => ({ ...prev, location: loc.id }))
                            setAssignLocationSearch(loc.hierarchicalPath || loc.name)
                            setAssignShowLocationDropdown(false)
                          }}
                        >
                          {loc.hierarchicalPath || loc.name}
                        </div>
                      ))
                    ) : (
                      <div className="px-3 py-2 text-sm text-gray-500 italic">No locations found</div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Namespace */}
            <div className="space-y-2">
              <Label htmlFor="assign-namespace">Namespace</Label>
              <Select 
                value={assignAllData.namespace || ''} 
                onValueChange={(value) => setAssignAllData(prev => ({ ...prev, namespace: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Leave empty to keep existing" />
                </SelectTrigger>
                <SelectContent>
                  {namespaces
                    .filter(namespace => namespace.name && String(namespace.name).trim() !== '')
                    .map(namespace => (
                    <SelectItem key={`assign-namespace-${namespace.id}`} value={String(namespace.name)}>
                      {namespace.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Status */}
            <div className="space-y-2">
              <Label htmlFor="assign-status">Status</Label>
              <Select 
                value={assignAllData.status || ''} 
                onValueChange={(value) => setAssignAllData(prev => ({ ...prev, status: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Leave empty to keep existing" />
                </SelectTrigger>
                <SelectContent>
                  {deviceStatuses
                    .filter(status => status.name && String(status.name).trim() !== '')
                    .map(status => (
                    <SelectItem key={`assign-device-status-${status.id}`} value={String(status.name)}>
                      {status.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Interface Status */}
            <div className="space-y-2">
              <Label htmlFor="assign-interface-status">Interface Status</Label>
              <Select 
                value={assignAllData.interface_status || ''} 
                onValueChange={(value) => setAssignAllData(prev => ({ ...prev, interface_status: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Leave empty to keep existing" />
                </SelectTrigger>
                <SelectContent>
                  {interfaceStatuses
                    .filter(status => status.name && String(status.name).trim() !== '')
                    .map(status => (
                    <SelectItem key={`assign-interface-status-${status.id}`} value={String(status.name)}>
                      {status.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* IP Status */}
            <div className="space-y-2">
              <Label htmlFor="assign-ip-status">IP Address Status</Label>
              <Select 
                value={assignAllData.ip_status || ''} 
                onValueChange={(value) => setAssignAllData(prev => ({ ...prev, ip_status: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Leave empty to keep existing" />
                </SelectTrigger>
                <SelectContent>
                  {ipAddressStatuses
                    .filter(status => status.name && String(status.name).trim() !== '')
                    .map(status => (
                    <SelectItem key={`assign-ip-status-${status.id}`} value={String(status.name)}>
                      {status.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAssignAllModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={applyAssignToAll} className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700">
              Apply to {selectedDevices.size} Devices
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Scan Results Modal */}
      <Dialog open={isScanResultsModalOpen} onOpenChange={setIsScanResultsModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <AlertCircle className="h-5 w-5 text-orange-500" />
              <span>Scan Results Summary</span>
            </DialogTitle>
            <DialogDescription>
              The network scan completed, but no devices were successfully authenticated or are reachable.
            </DialogDescription>
          </DialogHeader>
          
          {scanJob && (
            <div className="space-y-4">
              {/* Scan Statistics */}
              <div className="bg-slate-50 rounded-lg p-4">
                <h3 className="font-semibold text-slate-900 mb-3">Scan Statistics</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                  <div className="text-center">
                    <div className="text-lg font-semibold text-slate-600">{scanJob.progress?.total || 0}</div>
                    <div className="text-slate-500">Total Scanned</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-semibold text-green-600">{scanJob.progress?.alive || 0}</div>
                    <div className="text-slate-500">Alive</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-semibold text-blue-600">{scanJob.progress?.authenticated || 0}</div>
                    <div className="text-slate-500">Authenticated</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-semibold text-red-600">{scanJob.progress?.unreachable || 0}</div>
                    <div className="text-slate-500">Unreachable</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-semibold text-orange-600">{scanJob.progress?.auth_failed || 0}</div>
                    <div className="text-slate-500">Auth Failed</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-semibold text-slate-600">{scanJob.progress?.driver_not_supported || 0}</div>
                    <div className="text-slate-500">Driver N/A</div>
                  </div>
                </div>
              </div>

              {/* Detailed Results */}
              {scanJob.results && scanJob.results.length > 0 && (
                <div className="space-y-3">
                  <h3 className="font-semibold text-slate-900">Device Status Details</h3>
                  <div className="max-h-64 overflow-y-auto border rounded-lg">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-100 sticky top-0">
                        <tr>
                          <th className="text-left p-3 font-medium">IP Address</th>
                          <th className="text-left p-3 font-medium">Status</th>
                          <th className="text-left p-3 font-medium">Issue</th>
                        </tr>
                      </thead>
                      <tbody>
                        {scanJob.results
                          .filter(result => !result.is_alive || !result.is_authenticated)
                          .map((result, index) => (
                          <tr key={`${result.ip}-${index}`} className="border-b">
                            <td className="p-3 font-mono">{result.ip}</td>
                            <td className="p-3">
                              <Badge variant={result.is_alive ? 'secondary' : 'destructive'}>
                                {result.is_alive ? 'Alive' : 'Unreachable'}
                              </Badge>
                            </td>
                            <td className="p-3 text-slate-600">
                              {!result.is_alive 
                                ? 'Device did not respond to network scan'
                                : !result.is_authenticated 
                                ? 'Authentication failed with provided credentials'
                                : 'Driver not supported for this device type'
                              }
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Recommendations */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-semibold text-blue-900 mb-2 flex items-center">
                  <Info className="h-4 w-4 mr-2" />
                  Recommendations
                </h3>
                <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                  <li>Verify the network ranges are correct and devices are powered on</li>
                  <li>Check that the selected credentials are valid for the target devices</li>
                  <li>Ensure network connectivity between the scanner and target devices</li>
                  <li>Consider trying different discovery modes (SSH Login vs Napalm)</li>
                </ul>
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button 
              onClick={() => setIsScanResultsModalOpen(false)}
              className="w-full sm:w-auto"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
