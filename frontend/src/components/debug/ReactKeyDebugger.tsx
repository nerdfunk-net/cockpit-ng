'use client'

import React, { Component, ErrorInfo, ReactNode } from 'react'

interface Props {
  children: ReactNode
  name: string
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
}

export class ReactKeyDebugger extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null }
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`🚨 React Error in ${this.props.name}:`, error)
    console.error('🔍 Component Stack:', errorInfo.componentStack)
    console.error('🔍 Error Stack:', error.stack)
    
    this.setState({
      error,
      errorInfo
    })
  }

  override render() {
    if (this.state.hasError) {
      return (
        <div className="border-2 border-red-500 p-4 m-2 bg-red-50">
          <h3 className="text-red-700 font-bold">Error in {this.props.name}</h3>
          <details className="mt-2">
            <summary className="cursor-pointer text-red-600">Error Details</summary>
            <pre className="text-xs text-red-800 mt-2 overflow-auto">
              {this.state.error && this.state.error.toString()}
              {this.state.errorInfo && this.state.errorInfo.componentStack}
            </pre>
          </details>
        </div>
      )
    }

    return this.props.children
  }
}

// Enhanced Key Validator Hook
export function useKeyValidator(name: string, children: ReactNode) {
  React.useEffect(() => {
    const validateKeys = () => {
      try {
        const childArray = React.Children.toArray(children)
        const duplicateKeys = new Map<string, number>()
        const missingKeys: number[] = []
        
        childArray.forEach((child, index) => {
          if (React.isValidElement(child)) {
            const key = child.key
            if (key === null) {
              missingKeys.push(index)
            } else {
              const count = duplicateKeys.get(key) || 0
              duplicateKeys.set(key, count + 1)
            }
          }
        })
        
        if (missingKeys.length > 0) {
          console.warn(`🔑 ${name}: Missing keys at indices [${missingKeys.join(', ')}]`)
        }
        
        duplicateKeys.forEach((count, key) => {
          if (count > 1) {
            console.warn(`🔑 ${name}: Duplicate key "${key}" found ${count} times`)
          }
        })
        
        return { missingKeys, duplicateKeys: Array.from(duplicateKeys.entries()).filter(([_, count]) => count > 1) }
      } catch (error) {
        console.error(`🚨 Key validation error in ${name}:`, error)
        return { missingKeys: [], duplicateKeys: [] }
      }
    }
    
    validateKeys()
  }, [name, children])
}
