import { useState, useEffect } from 'react'
import { useApi } from '@/hooks/use-api'
import type { StoredCredential } from '../types'

export function useCredentialManager() {
  const { apiCall } = useApi()
  const [storedCredentials, setStoredCredentials] = useState<StoredCredential[]>([])
  const [selectedCredentialId, setSelectedCredentialId] = useState<string>('manual')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  const loadStoredCredentials = async () => {
    try {
      // Fetch both general and user's private credentials (source not specified = all accessible)
      const response = await apiCall<StoredCredential[]>('credentials?include_expired=false')
      // Filter for SSH credentials only
      const sshCredentials = response.filter(cred => cred.type === 'ssh')
      setStoredCredentials(sshCredentials)
    } catch (error) {
      console.error('Error loading credentials:', error)
      setStoredCredentials([])
    }
  }

  useEffect(() => {
    loadStoredCredentials()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleCredentialChange = async (credId: string) => {
    setSelectedCredentialId(credId)

    if (credId === 'manual') {
      // Manual entry - clear fields
      setUsername('')
      setPassword('')
    } else {
      // Find the selected credential and fetch the password
      const credential = storedCredentials.find(c => c.id.toString() === credId)
      if (credential) {
        setUsername(credential.username)
        try {
          const response = await apiCall<{password: string}>(`credentials/${credId}/password`)
          setPassword(response.password)
        } catch (error) {
          console.error('Error fetching credential password:', error)
          alert('Error loading credential password. Please try manual entry.')
          setSelectedCredentialId('manual')
        }
      }
    }
  }

  return {
    storedCredentials,
    selectedCredentialId,
    username,
    password,
    setUsername,
    setPassword,
    handleCredentialChange,
  }
}
