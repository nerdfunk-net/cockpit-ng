'use client'

import { useState, useMemo, useEffect } from 'react'
import { useAuthStore } from '@/lib/auth-store'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { RefreshCw, Search, Eye, GitCompare, RotateCw, RotateCcw, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, CheckCircle, AlertCircle, Info, Plus, ChevronDown, Zap, Play, BarChart3, Trash2, Download } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu'

interface Device {
  id: string
  name: string
  role: string
  status: string
  location: string
  checkmk_status: string
  diff?: string
  normalized_config?: Record<string, unknown>
  checkmk_config?: Record<string, unknown>
}

// Helper function to extract site value from device configuration
const getSiteFromDevice = (device: Device, defaultSite: string = 'cmk'): string => {
  // First try to get site from normalized_config.attributes.site
  const normalizedSite = (device.normalized_config?.attributes as any)?.site as string
  if (normalizedSite) {
    return normalizedSite
  }
  
  // Then try checkmk_config.attributes.site
  const checkmkSite = (device.checkmk_config?.attributes as any)?.site as string
  if (checkmkSite) {
    return checkmkSite
  }
  
  // If no site found, return the default site
  return defaultSite
}

export function CheckMKSyncDevicesPage() {
  const { token } = useAuthStore()
  const [devices, setDevices] = useState<Device[]>([])
  const [selectedDevices, setSelectedDevices] = useState<Set<string>>(new Set())
  const [addingDevices, setAddingDevices] = useState<Set<string>>(new Set())
  const [syncingDevices, setSyncingDevices] = useState<Set<string>>(new Set())
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(25)
  const [filters, setFilters] = useState({
    name: '',
    role: '',
    status: '',
    location: '',
    site: '',
    checkmk_status: ''
  })
  const [checkmkStatusFilters, setCheckmkStatusFilters] = useState({
    equal: true,
    diff: true,
    missing: true
  })
  const [roleFilters, setRoleFilters] = useState<Record<string, boolean>>({})
  const [statusFilters, setStatusFilters] = useState<Record<string, boolean>>({})
  const [locationFilters, setLocationFilters] = useState<Record<string, boolean>>({})
  const [siteFilters, setSiteFilters] = useState<Record<string, boolean>>({})
  const [defaultSite, setDefaultSite] = useState<string>('cmk')
  const [selectedDeviceForView, setSelectedDeviceForView] = useState<Device | null>(null)
  const [selectedDeviceForDiff, setSelectedDeviceForDiff] = useState<Device | null>(null)
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'warning' | 'info', message: string } | null>(null)
  const [showStatusModal, setShowStatusModal] = useState(false)
  const [isActivating, setIsActivating] = useState(false)
  
  // Job results state
  const [availableJobs, setAvailableJobs] = useState<Array<{id: string, status: string, created_at: string, processed_devices: number}>>([])
  const [selectedJobId, setSelectedJobId] = useState<string>('')
  const [loadingResults, setLoadingResults] = useState(false)

  // Background job state
  const [currentJobId, setCurrentJobId] = useState<string | null>(null)
  const [isJobRunning, setIsJobRunning] = useState(false)
  const [jobProgress, setJobProgress] = useState<{
    processed: number
    total: number
    message: string
    status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  } | null>(null)
  const [showProgressModal, setShowProgressModal] = useState(false)

  // Job persistence functions
  const saveJobStateToStorage = (jobId: string | null, isRunning: boolean) => {
    if (jobId) {
      localStorage.setItem('nb2cmk_current_job_id', jobId)
      localStorage.setItem('nb2cmk_is_job_running', isRunning.toString())
    } else {
      localStorage.removeItem('nb2cmk_current_job_id')
      localStorage.removeItem('nb2cmk_is_job_running')
    }
  }

  const loadJobStateFromStorage = () => {
    const savedJobId = localStorage.getItem('nb2cmk_current_job_id')
    const savedIsRunning = localStorage.getItem('nb2cmk_is_job_running') === 'true'
    return { savedJobId, savedIsRunning }
  }

  const clearJobState = () => {
    setCurrentJobId(null)
    setIsJobRunning(false)
    setJobProgress(null)
    setDevices([])
    saveJobStateToStorage(null, false)
    setStatusMessage({
      type: 'info',
      message: 'Job state cleared. You can start a new comparison job.'
    })
    setShowStatusModal(true)
    setTimeout(() => {
      setStatusMessage(null)
      setShowStatusModal(false)
    }, 3000)
  }

  // Fetch available completed jobs from backend
  const fetchAvailableJobs = async () => {
    try {
      const response = await fetch('/api/proxy/nb2cmk/jobs', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })
      if (response.ok) {
        const data = await response.json()
        // Filter only completed jobs with device results
        const completedJobs = data.jobs.filter((job: any) => 
          job.status === 'completed' && job.progress && job.progress.processed > 0
        ).map((job: any) => ({
          id: job.id,
          status: job.status,
          created_at: job.started_at,
          processed_devices: job.progress?.processed || 0
        }))
        setAvailableJobs(completedJobs)
      }
    } catch (error) {
      console.error('Error fetching available jobs:', error)
    }
  }

  const loadJobResults = async () => {
    if (!selectedJobId || !token || selectedJobId === 'no-jobs') return
    
    setLoadingResults(true)
    try {
      const response = await fetch(`/api/proxy/nb2cmk/job/${selectedJobId}/results`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        setDevices(data.devices || [])
        setStatusMessage({
          type: 'success',
          message: `Loaded ${data.devices?.length || 0} device comparison results from job ${selectedJobId.slice(0, 8)}...`
        })
        setShowStatusModal(true)
        
        // Auto-hide success message after 3 seconds
        setTimeout(() => {
          setStatusMessage(null)
          setShowStatusModal(false)
        }, 3000)
      } else {
        const errorData = await response.json()
        setStatusMessage({
          type: 'error',
          message: `Failed to load job results: ${errorData.detail || 'Unknown error'}`
        })
        setShowStatusModal(true)
      }
    } catch (error) {
      console.error('Error loading job results:', error)
      setStatusMessage({
        type: 'error',
        message: 'Error loading job results'
      })
      setShowStatusModal(true)
    } finally {
      setLoadingResults(false)
    }
  }

  // Fetch default site from backend
  const fetchDefaultSite = async () => {
    try {
      const response = await fetch('/api/proxy/nb2cmk/get_default_site', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })
      if (response.ok) {
        const data = await response.json()
        setDefaultSite(data.default_site || 'cmk')
      }
    } catch (error) {
      console.error('Error fetching default site:', error)
      // Keep default value 'cmk' if fetch fails
    }
  }

  // Check for pending changes
  const checkPendingChanges = async (): Promise<boolean> => {
    if (!token) return false
    
    try {
      const response = await fetch('/api/proxy/checkmk/changes/pending', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        // Check if there are any pending changes (non-empty list)
        // The response structure is: { data: { value: [...] } }
        return data.data && data.data.value && data.data.value.length > 0
      }
      return false
    } catch (error) {
      console.error('Error checking pending changes:', error)
      return false
    }
  }

  // Load job state and default site when component mounts
  useEffect(() => {
    if (token) {
      fetchDefaultSite()
      fetchAvailableJobs() // Fetch available job results
      
      // Load previous job state from localStorage
      const { savedJobId, savedIsRunning } = loadJobStateFromStorage()
      if (savedJobId) {
        setCurrentJobId(savedJobId)
        setIsJobRunning(savedIsRunning)
        
        // Check if the job is still actually running by getting its current status
        // Do this after a short delay to ensure the component is fully loaded
        const checkJobStatus = async () => {
          try {
            const response = await fetch(`/api/proxy/nb2cmk/job/${savedJobId}/progress`, {
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              }
            })
            
            if (response.ok) {
              const data = await response.json()
              const jobStillRunning = data.status === 'running' || data.status === 'pending'
              setIsJobRunning(jobStillRunning)
              saveJobStateToStorage(savedJobId, jobStillRunning)
              
              setJobProgress({
                processed: data.processed_devices,
                total: data.total_devices,
                message: data.progress_message,
                status: data.status
              })
              
              // If completed, silently load results
              if (data.status === 'completed') {
                const resultResponse = await fetch(`/api/proxy/nb2cmk/job/${savedJobId}/results`, {
                  headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                  }
                })
                
                if (resultResponse.ok) {
                  const resultData = await resultResponse.json()
                  setDevices(resultData.devices || [])
                }
              }
            }
          } catch (error) {
            console.error('Error checking restored job status:', error)
          }
        }
        
        setTimeout(checkJobStatus, 100)
      }
    }
  }, [token])

  // Auto-check progress for running jobs every 5 seconds
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null
    
    if (currentJobId && isJobRunning) {
      interval = setInterval(() => {
        handleGetProgress(currentJobId, true) // Silent check
      }, 5000)
    }
    
    return () => {
      if (interval) {
        clearInterval(interval)
      }
    }
  }, [currentJobId, isJobRunning])

  // Extract unique roles and statuses from the current device data
  const availableRoles = useMemo(() => {
    const roles = new Set(devices.map(device => device.role).filter(Boolean))
    return Array.from(roles).sort()
  }, [devices])

  const availableStatuses = useMemo(() => {
    const statuses = new Set(devices.map(device => device.status).filter(Boolean))
    return Array.from(statuses).sort()
  }, [devices])

  const availableLocations = useMemo(() => {
    const locations = new Set(devices.map(device => device.location).filter(Boolean))
    return Array.from(locations).sort()
  }, [devices])

  const availableSites = useMemo(() => {
    const sites = new Set(devices.map(device => getSiteFromDevice(device, defaultSite)).filter(Boolean))
    return Array.from(sites).sort()
  }, [devices, defaultSite])

  // Initialize filters when available roles/statuses change
  useEffect(() => {
    if (availableRoles.length > 0) {
      setRoleFilters(prev => {
        const newFilters = { ...prev }
        availableRoles.forEach(role => {
          if (!(role in newFilters)) {
            newFilters[role] = true // Default to selected
          }
        })
        return newFilters
      })
    }
  }, [availableRoles])

  useEffect(() => {
    if (availableStatuses.length > 0) {
      setStatusFilters(prev => {
        const newFilters = { ...prev }
        availableStatuses.forEach(status => {
          if (!(status in newFilters)) {
            newFilters[status] = true // Default to selected
          }
        })
        return newFilters
      })
    }
  }, [availableStatuses])

  useEffect(() => {
    if (availableLocations.length > 0) {
      setLocationFilters(prev => {
        const newFilters = { ...prev }
        availableLocations.forEach(location => {
          if (!(location in newFilters)) {
            newFilters[location] = true // Default to selected
          }
        })
        return newFilters
      })
    }
  }, [availableLocations])

  useEffect(() => {
    if (availableSites.length > 0) {
      setSiteFilters(prev => {
        const newFilters = { ...prev }
        availableSites.forEach(site => {
          if (!(site in newFilters)) {
            newFilters[site] = true // Default to selected
          }
        })
        return newFilters
      })
    }
  }, [availableSites])

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedDevices(new Set(filteredDevices.map(device => device.id)))
    } else {
      setSelectedDevices(new Set())
    }
  }

  const handleSelectDevice = (deviceId: string, checked: boolean) => {
    const newSelected = new Set(selectedDevices)
    if (checked) {
      newSelected.add(deviceId)
    } else {
      newSelected.delete(deviceId)
    }
    setSelectedDevices(newSelected)
  }

  // Background job functions
  const handleStartCheck = async () => {
    if (!token) {
      setStatusMessage({ type: 'error', message: 'Authentication required' })
      setShowStatusModal(true)
      return
    }

    try {
      setIsJobRunning(true)
      const response = await fetch('/api/proxy/nb2cmk/start-diff-job', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      if (response.ok) {
        const data = await response.json()
        setCurrentJobId(data.job_id)
        setIsJobRunning(true)
        saveJobStateToStorage(data.job_id, true)
        setStatusMessage({
          type: 'success',
          message: `Background job started with ID: ${data.job_id}`
        })
        setShowStatusModal(true)
        
        // Auto-hide success message after 3 seconds
        setTimeout(() => {
          setStatusMessage(null)
          setShowStatusModal(false)
        }, 3000)
      } else {
        const errorData = await response.json()
        setStatusMessage({
          type: 'error',
          message: `Failed to start background job: ${errorData.detail || 'Unknown error'}`
        })
        setShowStatusModal(true)
        setIsJobRunning(false)
      }
    } catch (error) {
      console.error('Error starting background job:', error)
      setStatusMessage({
        type: 'error',
        message: 'Error starting background job'
      })
      setShowStatusModal(true)
      setIsJobRunning(false)
    }
  }

  const handleGetProgress = async (jobId?: string, silent = false) => {
    const targetJobId = jobId || currentJobId
    
    if (!targetJobId || !token) {
      if (!silent) {
        setStatusMessage({ type: 'error', message: 'No active job found' })
        setShowStatusModal(true)
      }
      return
    }

    try {
      const response = await fetch(`/api/proxy/nb2cmk/job/${targetJobId}/progress`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      if (response.ok) {
        const data = await response.json()
        const newProgress = {
          processed: data.processed_devices,
          total: data.total_devices,
          message: data.progress_message,
          status: data.status as 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
        }
        
        setJobProgress(newProgress)
        
        // Update job running state and save to storage
        const jobFinished = data.status === 'completed' || data.status === 'failed' || data.status === 'cancelled'
        const jobStillRunning = data.status === 'running' || data.status === 'pending'
        
        setIsJobRunning(jobStillRunning)
        saveJobStateToStorage(targetJobId, jobStillRunning)
        
        // If this is not a silent check, show the modal
        if (!silent) {
          setShowProgressModal(true)
        }
        
        // If job is completed and we have results, we can automatically load them
        if (data.status === 'completed' && devices.length === 0) {
          // Silently load the results
          handleViewDiff(targetJobId, true)
        }
      } else {
        const errorData = await response.json()
        if (!silent) {
          setStatusMessage({
            type: 'error',
            message: `Failed to get job progress: ${errorData.detail || 'Unknown error'}`
          })
          setShowStatusModal(true)
        }
      }
    } catch (error) {
      console.error('Error getting job progress:', error)
      if (!silent) {
        setStatusMessage({
          type: 'error',
          message: 'Error getting job progress'
        })
        setShowStatusModal(true)
      }
    }
  }

  const handleViewDiff = async (jobId?: string, silent = false) => {
    const targetJobId = jobId || currentJobId
    
    if (!targetJobId || !token) {
      if (!silent) {
        setStatusMessage({ type: 'error', message: 'No completed job found' })
        setShowStatusModal(true)
      }
      return
    }

    try {
      const response = await fetch(`/api/proxy/nb2cmk/job/${targetJobId}/results`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      if (response.ok) {
        const data = await response.json()
        setDevices(data.devices || [])
        
        if (!silent) {
          setStatusMessage({
            type: 'success',
            message: `Loaded ${data.devices?.length || 0} device comparison results`
          })
          setShowStatusModal(true)
          
          // Auto-hide success message after 3 seconds
          setTimeout(() => {
            setStatusMessage(null)
            setShowStatusModal(false)
          }, 3000)
        }
      } else {
        const errorData = await response.json()
        if (!silent) {
          setStatusMessage({
            type: 'error',
            message: `Failed to get job results: ${errorData.detail || 'Unknown error'}`
          })
          setShowStatusModal(true)
        }
      }
    } catch (error) {
      console.error('Error getting job results:', error)
      if (!silent) {
        setStatusMessage({
          type: 'error',
          message: 'Error getting job results'
        })
        setShowStatusModal(true)
      }
    }
  }

  const handleSyncDevices = async () => {
    if (selectedDevices.size === 0) {
      alert('Please select devices to sync')
      return
    }
    
    // Placeholder for sync functionality
    console.log('Syncing devices:', Array.from(selectedDevices))
  }

  const handleActivateChanges = async () => {
    if (!token) {
      setStatusMessage({ type: 'error', message: 'Authentication required' })
      setShowStatusModal(true)
      return
    }

    setIsActivating(true)
    setStatusMessage({ 
      type: 'info', 
      message: 'Checking for pending changes...' 
    })
    setShowStatusModal(true)
    
    try {
      // First check if there are pending changes
      const hasPendingChanges = await checkPendingChanges()
      
      if (!hasPendingChanges) {
        setStatusMessage({ 
          type: 'info', 
          message: 'No pending changes to activate in CheckMK' 
        })
        setShowStatusModal(true)
        setIsActivating(false)
        return
      }

      // If there are pending changes, proceed with activation
      setStatusMessage({ 
        type: 'info', 
        message: 'Activating pending changes in CheckMK...' 
      })
      
      const response = await fetch('/api/proxy/checkmk/changes/activate', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      if (response.ok) {
        setStatusMessage({ 
          type: 'success', 
          message: 'Successfully activated pending changes in CheckMK' 
        })
        setShowStatusModal(true)
        
        // Auto-hide success message after 3 seconds
        setTimeout(() => {
          setStatusMessage(null)
          setShowStatusModal(false)
        }, 3000)
      } else {
        const errorData = await response.json()
        setStatusMessage({ 
          type: 'error', 
          message: `Failed to activate changes: ${errorData.detail || 'Unknown error'}` 
        })
        setShowStatusModal(true)
      }
    } catch (error) {
      console.error('Error activating changes:', error)
      setStatusMessage({ 
        type: 'error', 
        message: 'Error activating changes in CheckMK' 
      })
      setShowStatusModal(true)
    } finally {
      setIsActivating(false)
    }
  }

  const handleAddDevice = async (device: Device) => {
    if (!token) {
      setStatusMessage({ type: 'error', message: 'Authentication required' })
      setShowStatusModal(true)
      return
    }

    // Add device to loading set
    setAddingDevices(prev => new Set(prev.add(device.id)))
    
    try {
      const response = await fetch(`/api/proxy/nb2cmk/device/${device.id}/add`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      if (response.ok) {
        const result = await response.json()
        setStatusMessage({ 
          type: 'success', 
          message: `Successfully added ${result.hostname} to CheckMK`
        })
        setShowStatusModal(true)
        
        // Update device status to 'equal' since it's now added
        setDevices(prevDevices => 
          prevDevices.map(d => 
            d.id === device.id 
              ? { ...d, checkmk_status: 'equal' }
              : d
          )
        )
        
        // Auto-hide success message after 3 seconds
        setTimeout(() => {
          setStatusMessage(null)
          setShowStatusModal(false)
        }, 3000)
      } else {
        const errorData = await response.json()
        setStatusMessage({ 
          type: 'error', 
          message: `Failed to add device: ${errorData.detail || 'Unknown error'}`
        })
        setShowStatusModal(true)
      }
    } catch (error) {
      console.error('Error adding device:', error)
      setStatusMessage({ 
        type: 'error', 
        message: 'Error adding device to CheckMK'
      })
      setShowStatusModal(true)
    } finally {
      // Remove device from loading set
      setAddingDevices(prev => {
        const newSet = new Set(prev)
        newSet.delete(device.id)
        return newSet
      })
    }
  }

  const handleSyncDevice = async (device: Device) => {
    if (!token) {
      setStatusMessage({ type: 'error', message: 'Authentication required' })
      setShowStatusModal(true)
      return
    }

    // Add device to syncing set
    setSyncingDevices(prev => new Set(prev.add(device.id)))
    
    try {
      const response = await fetch(`/api/proxy/nb2cmk/device/${device.id}/update`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      if (response.ok) {
        const result = await response.json()
        setStatusMessage({ 
          type: 'success', 
          message: `Successfully synced ${result.hostname} in CheckMK${result.folder_changed ? ' (moved to new folder)' : ''}`
        })
        setShowStatusModal(true)
        
        // Update device status to 'equal' since it's now synced
        setDevices(prevDevices => 
          prevDevices.map(d => 
            d.id === device.id 
              ? { ...d, checkmk_status: 'equal' }
              : d
          )
        )
        
        // Auto-hide success message after 3 seconds
        setTimeout(() => {
          setStatusMessage(null)
          setShowStatusModal(false)
        }, 3000)
      } else {
        const errorData = await response.json()
        setStatusMessage({ 
          type: 'error', 
          message: `Failed to sync device: ${errorData.detail || 'Unknown error'}`
        })
        setShowStatusModal(true)
      }
    } catch (error) {
      console.error('Error syncing device:', error)
      setStatusMessage({ 
        type: 'error', 
        message: 'Error syncing device in CheckMK'
      })
      setShowStatusModal(true)
    } finally {
      // Remove device from syncing set
      setSyncingDevices(prev => {
        const newSet = new Set(prev)
        newSet.delete(device.id)
        return newSet
      })
    }
  }

  // Filter devices based on column filters
  const filteredDevices = useMemo(() => {
    return devices.filter(device => {
      // Check CheckMK status checkbox filters
      const checkmkStatusMatch = 
        (checkmkStatusFilters.equal && device.checkmk_status === 'equal') ||
        (checkmkStatusFilters.diff && device.checkmk_status === 'diff') ||
        (checkmkStatusFilters.missing && device.checkmk_status === 'missing') ||
        (!checkmkStatusFilters.equal && !checkmkStatusFilters.diff && !checkmkStatusFilters.missing) ||
        (device.checkmk_status !== 'equal' && device.checkmk_status !== 'diff' && device.checkmk_status !== 'missing')
      
      // Check role checkbox filters
      const roleMatch = Object.keys(roleFilters).length === 0 || roleFilters[device.role] === true
      
      // Check status checkbox filters
      const statusMatch = Object.keys(statusFilters).length === 0 || statusFilters[device.status] === true
      
      // Check location checkbox filters
      const locationMatch = Object.keys(locationFilters).length === 0 || locationFilters[device.location] === true
      
      // Check site checkbox filters
      const deviceSite = getSiteFromDevice(device, defaultSite)
      const siteMatch = Object.keys(siteFilters).length === 0 || siteFilters[deviceSite] === true
      
      return (
        device.name.toLowerCase().includes(filters.name.toLowerCase()) &&
        roleMatch &&
        statusMatch &&
        locationMatch &&
        siteMatch &&
        checkmkStatusMatch
      )
    })
  }, [devices, filters, checkmkStatusFilters, roleFilters, statusFilters, locationFilters, siteFilters, defaultSite])

  // Pagination logic (use filtered devices)
  const totalPages = Math.ceil(filteredDevices.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const currentDevices = filteredDevices.slice(startIndex, endIndex)

  // Reset to first page when filters change
  const handleFilterChange = (column: string, value: string) => {
    setFilters(prev => ({ ...prev, [column]: value }))
    setCurrentPage(1)
  }

  const clearAllFilters = () => {
    setFilters({
      name: '',
      role: '',
      status: '',
      location: '',
      site: '',
      checkmk_status: ''
    })
    setCheckmkStatusFilters({
      equal: true,
      diff: true,
      missing: true
    })
    // Reset role filters to all true
    const resetRoleFilters = availableRoles.reduce((acc: Record<string, boolean>, role: string) => {
      acc[role] = true
      return acc
    }, {})
    setRoleFilters(resetRoleFilters)
    // Reset status filters to all true
    const resetStatusFilters = availableStatuses.reduce((acc: Record<string, boolean>, status: string) => {
      acc[status] = true
      return acc
    }, {})
    setStatusFilters(resetStatusFilters)
    // Reset location filters to all true
    const resetLocationFilters = availableLocations.reduce((acc: Record<string, boolean>, location: string) => {
      acc[location] = true
      return acc
    }, {})
    setLocationFilters(resetLocationFilters)
    // Reset site filters to all true
    const resetSiteFilters = availableSites.reduce((acc: Record<string, boolean>, site: string) => {
      acc[site] = true
      return acc
    }, {})
    setSiteFilters(resetSiteFilters)
    setCurrentPage(1)
  }

  const handlePageSizeChange = (newSize: string) => {
    setItemsPerPage(parseInt(newSize))
    setCurrentPage(1)
  }

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active':
        return <Badge variant="default" className="bg-green-100 text-green-800">Active</Badge>
      case 'inactive':
        return <Badge variant="secondary">Inactive</Badge>
      case 'staged':
        return <Badge variant="outline">Staged</Badge>
      default:
        return <Badge variant="secondary">{status}</Badge>
    }
  }

  const getCheckMKStatusBadge = (checkmkStatus: string) => {
    switch (checkmkStatus.toLowerCase()) {
      case 'equal':
        return <Badge variant="default" className="bg-green-100 text-green-800">Synced</Badge>
      case 'diff':
        return <Badge variant="default" className="bg-yellow-100 text-yellow-800">Different</Badge>
      case 'host_not_found':
      case 'missing':
        return <Badge variant="destructive">Missing</Badge>
      case 'error':
        return <Badge variant="secondary">Error</Badge>
      case 'unknown':
        return <Badge variant="outline">Unknown</Badge>
      default:
        return <Badge variant="outline">{checkmkStatus}</Badge>
    }
  }

  // Always render the full interface - don't show separate loading page

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">CheckMK Sync Devices</h1>
          <p className="text-gray-600 mt-1">Compare and synchronize devices between Nautobot and CheckMK</p>
        </div>
      </div>


      {/* Main Content */}
      <div className="rounded-xl border shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-blue-400/80 to-blue-500/80 text-white py-2 px-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Search className="h-4 w-4" />
              <div>
                <h3 className="text-sm font-semibold">CheckMK Device Comparison</h3>
                <p className="text-blue-100 text-xs">Compare Nautobot devices with CheckMK hosts</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAllFilters}
                className="text-white hover:bg-white/20 text-xs h-6"
              >
                <RotateCcw className="h-3 w-3 mr-1" />
                Clear Filters
              </Button>
            </div>
          </div>
        </div>
        <div className="p-0">
          {/* Filters Row */}
          <div className="bg-gray-50 border-b p-4">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-4">
              {/* Device Name Filter */}
              <div className="space-y-1">
                <Label className="text-xs font-medium text-gray-600">Device Name</Label>
                <Input
                  placeholder="Filter by name..."
                  value={filters.name}
                  onChange={(e) => handleFilterChange('name', e.target.value)}
                  className="h-8 text-xs border-2 bg-white border-gray-300 hover:border-gray-400 focus:border-blue-500"
                />
              </div>

              {/* Role Filter */}
              <div className="space-y-1">
                <Label className="text-xs font-medium text-gray-600">Role</Label>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8 text-xs justify-between min-w-[120px]">
                      Role Filter
                      {Object.values(roleFilters).filter(Boolean).length < availableRoles.length && (
                        <Badge variant="secondary" className="ml-1 h-4 px-1 text-xs">
                          {Object.values(roleFilters).filter(Boolean).length}
                        </Badge>
                      )}
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-40">
                    <DropdownMenuLabel className="text-xs">Filter by Role</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {availableRoles.map((role) => (
                      <DropdownMenuCheckboxItem
                        key={role}
                        checked={roleFilters[role] || false}
                        onCheckedChange={(checked) => 
                          setRoleFilters(prev => ({ ...prev, [role]: !!checked }))
                        }
                      >
                        {role}
                      </DropdownMenuCheckboxItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Status Filter */}
              <div className="space-y-1">
                <Label className="text-xs font-medium text-gray-600">Status</Label>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8 text-xs justify-between min-w-[120px]">
                      Status Filter
                      {Object.values(statusFilters).filter(Boolean).length < availableStatuses.length && (
                        <Badge variant="secondary" className="ml-1 h-4 px-1 text-xs">
                          {Object.values(statusFilters).filter(Boolean).length}
                        </Badge>
                      )}
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-40">
                    <DropdownMenuLabel className="text-xs">Filter by Status</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {availableStatuses.map((status) => (
                      <DropdownMenuCheckboxItem
                        key={status}
                        checked={statusFilters[status] || false}
                        onCheckedChange={(checked) => 
                          setStatusFilters(prev => ({ ...prev, [status]: !!checked }))
                        }
                      >
                        {status}
                      </DropdownMenuCheckboxItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Location Filter */}
              <div className="space-y-1">
                <Label className="text-xs font-medium text-gray-600">Location</Label>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8 text-xs justify-between min-w-[120px]">
                      Location Filter
                      {Object.values(locationFilters).filter(Boolean).length < availableLocations.length && (
                        <Badge variant="secondary" className="ml-1 h-4 px-1 text-xs">
                          {Object.values(locationFilters).filter(Boolean).length}
                        </Badge>
                      )}
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-40">
                    <DropdownMenuLabel className="text-xs">Filter by Location</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {availableLocations.map((location) => (
                      <DropdownMenuCheckboxItem
                        key={location}
                        checked={locationFilters[location] || false}
                        onCheckedChange={(checked) => 
                          setLocationFilters(prev => ({ ...prev, [location]: !!checked }))
                        }
                      >
                        {location}
                      </DropdownMenuCheckboxItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Site Filter */}
              <div className="space-y-1">
                <Label className="text-xs font-medium text-gray-600">Site</Label>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8 text-xs justify-between min-w-[120px]">
                      Site Filter
                      {Object.values(siteFilters).filter(Boolean).length < availableSites.length && (
                        <Badge variant="secondary" className="ml-1 h-4 px-1 text-xs">
                          {Object.values(siteFilters).filter(Boolean).length}
                        </Badge>
                      )}
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-40">
                    <DropdownMenuLabel className="text-xs">Filter by Site</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {availableSites.map((site) => (
                      <DropdownMenuCheckboxItem
                        key={site}
                        checked={siteFilters[site] || false}
                        onCheckedChange={(checked) => 
                          setSiteFilters(prev => ({ ...prev, [site]: !!checked }))
                        }
                      >
                        {site}
                      </DropdownMenuCheckboxItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* CheckMK Status Filter */}
              <div className="space-y-1">
                <Label className="text-xs font-medium text-gray-600">CheckMK Status</Label>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8 text-xs justify-between min-w-[120px]">
                      Status Filter
                      {Object.values(checkmkStatusFilters).filter(Boolean).length < 3 && (
                        <Badge variant="secondary" className="ml-1 h-4 px-1 text-xs">
                          {Object.values(checkmkStatusFilters).filter(Boolean).length}
                        </Badge>
                      )}
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-40">
                    <DropdownMenuLabel className="text-xs">Filter by Status</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuCheckboxItem
                      checked={checkmkStatusFilters.equal}
                      onCheckedChange={(checked) => 
                        setCheckmkStatusFilters(prev => ({ ...prev, equal: !!checked }))
                      }
                    >
                      Equal
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem
                      checked={checkmkStatusFilters.diff}
                      onCheckedChange={(checked) => 
                        setCheckmkStatusFilters(prev => ({ ...prev, diff: !!checked }))
                      }
                    >
                      Diff
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem
                      checked={checkmkStatusFilters.missing}
                      onCheckedChange={(checked) => 
                        setCheckmkStatusFilters(prev => ({ ...prev, missing: !!checked }))
                      }
                    >
                      Missing
                    </DropdownMenuCheckboxItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-100 border-b">
                <tr>
                  <th className="px-4 py-3 text-left">
                    <Checkbox
                      checked={currentDevices.length > 0 && currentDevices.every(device => selectedDevices.has(device.id))}
                      onCheckedChange={handleSelectAll}
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Device Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Role</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Location</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Site</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">CheckMK</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">{devices.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                      No devices found. Select a job from the dropdown above and click "Load" to view comparison results.
                    </td>
                  </tr>
                ) : filteredDevices.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                      No devices match the current filters.
                    </td>
                  </tr>
                ) : (
                  currentDevices.map((device, index) => (
                    <tr key={device.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-4 py-3">
                        <Checkbox
                          checked={selectedDevices.has(device.id)}
                          onCheckedChange={(checked) => 
                            handleSelectDevice(device.id, checked as boolean)
                          }
                        />
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">
                        {device.name}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {device.role}
                      </td>
                      <td className="px-4 py-3">
                        {getStatusBadge(device.status)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {device.location}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {getSiteFromDevice(device, defaultSite)}
                      </td>
                      <td className="px-4 py-3">
                        {getCheckMKStatusBadge(device.checkmk_status)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          {/* View Button - Always visible and enabled */}
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => setSelectedDeviceForView(device)}
                            title="View device details"
                            className="h-8 w-8 p-0"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          
                          {/* Add Button - Only for missing devices */}
                          {device.checkmk_status === 'missing' && (
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => handleAddDevice(device)}
                              disabled={addingDevices.has(device.id)}
                              title="Add device to CheckMK"
                              className="h-8 w-8 p-0 text-green-600 hover:text-green-700"
                            >
                              {addingDevices.has(device.id) ? (
                                <RefreshCw className="h-4 w-4 animate-spin" />
                              ) : (
                                <Plus className="h-4 w-4" />
                              )}
                            </Button>
                          )}
                          
                          {/* Compare and Sync Buttons - Only for diff devices */}
                          {device.checkmk_status === 'diff' && (
                            <>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => setSelectedDeviceForDiff(device)}
                                title="Show differences"
                                className="h-8 w-8 p-0"
                              >
                                <GitCompare className="h-4 w-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => handleSyncDevice(device)}
                                disabled={syncingDevices.has(device.id)}
                                title="Sync device changes"
                                className="h-8 w-8 p-0 text-blue-600 hover:text-blue-700"
                              >
                                {syncingDevices.has(device.id) ? (
                                  <RefreshCw className="h-4 w-4 animate-spin" />
                                ) : (
                                  <RotateCw className="h-4 w-4" />
                                )}
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="bg-gray-50 px-4 py-3 border-t flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600">
                Showing {startIndex + 1} to {Math.min(endIndex, filteredDevices.length)} of {filteredDevices.length} devices
                {filteredDevices.length !== devices.length && (
                  <span className="text-gray-500"> (filtered from {devices.length} total)</span>
                )}
              </span>
              <Select value={itemsPerPage.toString()} onValueChange={handlePageSizeChange}>
                <SelectTrigger className="w-20 h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                  <SelectItem value="200">200</SelectItem>
                </SelectContent>
              </Select>
              <span className="text-sm text-gray-600">per page</span>
            </div>

            <div className="flex items-center space-x-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
              >
                <ChevronsLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              
              {/* Page numbers */}
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const startPage = Math.max(1, currentPage - 2)
                const pageNum = startPage + i
                if (pageNum > totalPages) return null
                
                return (
                  <Button
                    key={pageNum}
                    variant={currentPage === pageNum ? "default" : "outline"}
                    size="sm"
                    onClick={() => setCurrentPage(pageNum)}
                    className="w-8"
                  >
                    {pageNum}
                  </Button>
                )
              })}

              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
              >
                <ChevronsRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Job Results Selection */}
          <div className="bg-gray-50 p-4 border-t">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <Label className="text-sm font-medium text-gray-700">Load Job Results:</Label>
                <Select value={selectedJobId} onValueChange={setSelectedJobId}>
                  <SelectTrigger className="h-10 text-sm min-w-[300px]">
                    <SelectValue placeholder="Select a completed job to load results..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableJobs.map((job) => (
                      <SelectItem key={job.id} value={job.id}>
                        {new Date(job.created_at).toLocaleDateString()} - {job.processed_devices} devices ({job.id.slice(0, 8)}...)
                      </SelectItem>
                    ))}
                    {availableJobs.length === 0 && (
                      <SelectItem value="no-jobs" disabled>No completed jobs found</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex space-x-2">
                <Button 
                  onClick={loadJobResults} 
                  disabled={!selectedJobId || selectedJobId === 'no-jobs' || loadingResults}
                  size="sm"
                  className="bg-green-600 hover:bg-green-700 disabled:bg-gray-300"
                >
                  {loadingResults ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4 mr-2" />
                  )}
                  Load Results
                </Button>
                <Button 
                  onClick={fetchAvailableJobs} 
                  variant="outline"
                  size="sm"
                  title="Refresh Job List"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh Jobs
                </Button>
              </div>
            </div>
          </div>

          {/* Device Actions */}
          <div className="bg-white p-4 border-t">
            <div className="flex justify-between items-center">
              <div className="text-sm text-gray-600">
                {selectedDevices.size > 0 && (
                  <span>{selectedDevices.size} device(s) selected</span>
                )}
                {selectedJobId && devices.length > 0 && (
                  <span className="ml-4 text-blue-600">
                    Showing results from job: {selectedJobId.slice(0, 8)}...
                  </span>
                )}
              </div>
              <div className="flex space-x-2">
                <Button 
                  onClick={handleSyncDevices}
                  disabled={selectedDevices.size === 0}
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  <RefreshCw className="h-4 w-4" />
                  Sync Devices ({selectedDevices.size})
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* View Device Dialog */}
      <Dialog open={!!selectedDeviceForView} onOpenChange={(open) => !open && setSelectedDeviceForView(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Device Details: {selectedDeviceForView?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold mb-2">Basic Information</h3>
              <div className="grid grid-cols-2 gap-4">
                <div><strong>Name:</strong> {selectedDeviceForView?.name}</div>
                <div><strong>Role:</strong> {selectedDeviceForView?.role}</div>
                <div><strong>Status:</strong> {selectedDeviceForView?.status}</div>
                <div><strong>Location:</strong> {selectedDeviceForView?.location}</div>
                <div><strong>Site:</strong> {selectedDeviceForView ? getSiteFromDevice(selectedDeviceForView, defaultSite) : ''}</div>
                <div><strong>CheckMK Status:</strong> {selectedDeviceForView && getCheckMKStatusBadge(selectedDeviceForView.checkmk_status)}</div>
              </div>
            </div>
            
            {selectedDeviceForView?.normalized_config && (
              <div>
                <h3 className="font-semibold mb-2">Normalized Config (Nautobot)</h3>
                <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto">
                  {JSON.stringify(selectedDeviceForView.normalized_config, null, 2)}
                </pre>
              </div>
            )}
            
            {selectedDeviceForView?.checkmk_config && (
              <div>
                <h3 className="font-semibold mb-2">CheckMK Config</h3>
                <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto">
                  {JSON.stringify(selectedDeviceForView.checkmk_config, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Status Message Modal */}
      <Dialog open={showStatusModal} onOpenChange={setShowStatusModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              {statusMessage?.type === 'error' && <AlertCircle className="h-5 w-5 text-red-500" />}
              {statusMessage?.type === 'success' && <CheckCircle className="h-5 w-5 text-green-500" />}
              {statusMessage?.type === 'warning' && <AlertCircle className="h-5 w-5 text-yellow-500" />}
              {statusMessage?.type === 'info' && <Info className="h-5 w-5 text-blue-500" />}
              <span>
                {statusMessage?.type === 'error' ? 'Error' :
                 statusMessage?.type === 'success' ? 'Success' :
                 statusMessage?.type === 'warning' ? 'Warning' :
                 'Information'}
              </span>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">{statusMessage?.message}</p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Show Diff Dialog */}
      <Dialog open={!!selectedDeviceForDiff} onOpenChange={(open) => !open && setSelectedDeviceForDiff(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Configuration Differences: {selectedDeviceForDiff?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold mb-2">Differences Found</h3>
              <div className="bg-yellow-50 border border-yellow-200 rounded p-4">
                <p className="text-sm whitespace-pre-wrap">{selectedDeviceForDiff?.diff || 'No differences found'}</p>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Progress Modal */}
      <Dialog open={showProgressModal} onOpenChange={setShowProgressModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <BarChart3 className="h-5 w-5 text-blue-500" />
              <span>Job Progress</span>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {jobProgress && (
              <>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Status:</span>
                    <Badge 
                      variant={
                        jobProgress.status === 'completed' ? 'default' : 
                        jobProgress.status === 'running' ? 'secondary' :
                        jobProgress.status === 'failed' ? 'destructive' :
                        'outline'
                      }
                    >
                      {jobProgress.status.charAt(0).toUpperCase() + jobProgress.status.slice(1)}
                    </Badge>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Progress:</span>
                    <span>{jobProgress.processed} of {jobProgress.total} devices</span>
                  </div>
                  
                  {/* Progress Bar */}
                  {jobProgress.total > 0 && (
                    <div className="space-y-1">
                      <Progress 
                        value={(jobProgress.processed / jobProgress.total) * 100}
                        className="w-full"
                      />
                      <div className="text-xs text-center text-gray-500">
                        {Math.round((jobProgress.processed / jobProgress.total) * 100)}%
                      </div>
                    </div>
                  )}
                  
                  {/* Progress Message */}
                  {jobProgress.message && (
                    <div className="bg-gray-50 p-3 rounded text-sm">
                      {jobProgress.message}
                    </div>
                  )}
                  
                  {/* Job ID */}
                  {currentJobId && (
                    <div className="text-xs text-gray-500 font-mono">
                      Job ID: {currentJobId}
                    </div>
                  )}
                </div>

                {/* Action buttons */}
                <div className="flex space-x-2 pt-2">
                  {jobProgress.status === 'completed' && (
                    <Button 
                      onClick={() => {
                        setShowProgressModal(false)
                        handleViewDiff()
                      }}
                      className="flex-1 bg-green-600 hover:bg-green-700"
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      View Results
                    </Button>
                  )}
                  <Button 
                    onClick={() => setShowProgressModal(false)}
                    variant="outline"
                    className="flex-1"
                  >
                    Close
                  </Button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

