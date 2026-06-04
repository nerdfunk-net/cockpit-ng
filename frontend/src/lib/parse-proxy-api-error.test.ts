import { describe, it, expect } from 'vitest'
import { parseProxyApiErrorMessage } from './parse-proxy-api-error'

describe('parseProxyApiErrorMessage', () => {
  it('extracts string detail from proxy API errors', () => {
    const err = new Error(
      'API Error 400: {"detail":"Role: The selected role was not found in Nautobot."}'
    )
    expect(parseProxyApiErrorMessage(err)).toBe(
      'Role: The selected role was not found in Nautobot.'
    )
  })

  it('extracts message from sanitized 500 detail object', () => {
    const err = new Error(
      'API Error 500: {"detail":{"message":"An internal error occurred","error_id":"abc"}}'
    )
    expect(parseProxyApiErrorMessage(err)).toBe('An internal error occurred')
  })

  it('returns original message when body is not JSON', () => {
    const err = new Error('Network failure')
    expect(parseProxyApiErrorMessage(err)).toBe('Network failure')
  })
})
