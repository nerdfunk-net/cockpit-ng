'use client'

import React from 'react'

// Console-based React key analyzer
export function analyzeReactKeys() {
  console.log('🔍 Starting React Key Analysis...')
  
  // Override React's createElement to catch key issues
  const originalCreateElement = React.createElement
  let keyWarnings: Array<{component: string, issue: string, stack: string}> = []
  
  // @ts-ignore - We're temporarily overriding React's createElement for debugging
  React.createElement = function(...args) {
    const [type, props, ...children] = args
    
    // Check if this is a component with children that might need keys
    if (props && children.length > 1) {
      children.forEach((child, index) => {
        if (React.isValidElement(child) && child.key === null) {
          const componentName = typeof type === 'string' ? type : type?.name || 'Unknown'
          keyWarnings.push({
            component: componentName,
            issue: `Child at index ${index} missing key`,
            stack: new Error().stack || 'No stack available'
          })
        }
      })
    }
    
    return originalCreateElement.apply(this, args as [any, any, ...any[]])
  }
  
  // Restore original after a short delay
  setTimeout(() => {
    // @ts-ignore
    React.createElement = originalCreateElement
    
    if (keyWarnings.length > 0) {
      console.group('🚨 React Key Issues Found:')
      keyWarnings.forEach((warning, index) => {
        console.log(`${index + 1}. ${warning.component}: ${warning.issue}`)
        console.trace('Stack trace:', warning.stack)
      })
      console.groupEnd()
    } else {
      console.log('✅ No React key issues detected')
    }
    
    keyWarnings = []
  }, 1000)
}

// DOM-based key finder
export function findElementsWithoutKeys() {
  console.log('🔍 Scanning DOM for elements that might need keys...')
  
  const suspiciousElements: Array<{element: Element, reason: string}> = []
  
  // Find all elements with multiple children
  document.querySelectorAll('*').forEach(element => {
    const children = Array.from(element.children)
    
    // Check for multiple similar children (common pattern that needs keys)
    if (children.length > 1) {
      const tagCounts = new Map<string, number>()
      children.forEach(child => {
        const tag = child.tagName.toLowerCase()
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1)
      })
      
      tagCounts.forEach((count, tag) => {
        if (count > 1) {
          suspiciousElements.push({
            element,
            reason: `Has ${count} ${tag} children - might need React keys`
          })
        }
      })
    }
    
    // Check for elements with data-reactroot or other React indicators
    if (element.hasAttribute('data-reactroot') || 
        (element.className && typeof element.className === 'string' && element.className.includes('react')) ||
        element.hasAttribute('data-react')) {
      const reactChildren = Array.from(element.children)
      if (reactChildren.length > 1) {
        suspiciousElements.push({
          element,
          reason: `React container with ${reactChildren.length} children`
        })
      }
    }
  })
  
  if (suspiciousElements.length > 0) {
    console.group('🔍 Suspicious Elements Found:')
    suspiciousElements.forEach((item, index) => {
      console.log(`${index + 1}. ${item.reason}`)
      console.log('Element:', item.element)
      console.log('Children:', Array.from(item.element.children))
    })
    console.groupEnd()
  } else {
    console.log('✅ No suspicious elements found')
  }
  
  return suspiciousElements
}

// React Fiber tree walker (advanced debugging)
export function walkReactFiber() {
  console.log('🔍 Walking React Fiber tree for key analysis...')
  
  // Try to access React Fiber internals (this is hacky but useful for debugging)
  const reactRoot = document.querySelector('[data-reactroot]') as any
  if (!reactRoot || !reactRoot._reactInternalFiber && !reactRoot._reactInternalInstance) {
    console.warn('Could not find React internals. Make sure React DevTools is installed.')
    return
  }
  
  const getFiber = (element: any) => {
    return element._reactInternalFiber || 
           element._reactInternalInstance ||
           Object.keys(element).find(key => key.startsWith('__reactInternalInstance'))
  }
  
  const fiber = getFiber(reactRoot)
  if (!fiber) {
    console.warn('Could not access React Fiber tree')
    return
  }
  
  function walkFiber(node: any, depth = 0) {
    if (!node) return
    
    const indent = '  '.repeat(depth)
    const name = node.type?.name || node.type || 'Unknown'
    const key = node.key || 'NO_KEY'
    
    if (node.child && !node.key && depth > 0) {
      console.warn(`${indent}⚠️  ${name} (${key}) - Potential key issue`)
    } else {
      console.log(`${indent}${name} (${key})`)
    }
    
    // Walk children
    let child = node.child
    while (child) {
      walkFiber(child, depth + 1)
      child = child.sibling
    }
  }
  
  try {
    walkFiber(fiber)
  } catch (error) {
    console.error('Error walking fiber tree:', error)
  }
}

// Console debugging helper
export function debugReactKeys() {
  console.clear()
  console.log('🚀 Starting comprehensive React key debugging...')
  
  // Method 1: Analyze createElement calls
  analyzeReactKeys()
  
  // Method 2: DOM-based analysis
  setTimeout(() => {
    findElementsWithoutKeys()
  }, 500)
  
  // Method 3: Fiber tree analysis
  setTimeout(() => {
    walkReactFiber()
  }, 1000)
  
  // Method 4: Listen for React warnings
  const originalWarn = console.warn
  console.warn = function(...args) {
    if (args.some(arg => typeof arg === 'string' && arg.includes('key'))) {
      console.group('🚨 React Key Warning Intercepted:')
      originalWarn.apply(console, args)
      console.trace('Warning origin:')
      console.groupEnd()
    } else {
      originalWarn.apply(console, args)
    }
  }
  
  console.log('✅ Debugging setup complete. Check console for results...')
}
