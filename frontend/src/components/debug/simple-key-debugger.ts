'use client'

// Simple but effective React key warning interceptor
export function interceptReactKeyWarnings() {
  console.clear()
  console.log('🔍 Setting up React key warning interceptor...')
  
  const originalConsoleError = console.error
  const originalConsoleWarn = console.warn
  
  let keyWarningCount = 0
  
  const interceptor = function(originalFunction: (...args: unknown[]) => void, _prefix: string) {
    return function(...args: unknown[]) {
      const message = args.join(' ')
      
      if (message.includes('Each child in a list should have a unique "key" prop') ||
          message.includes('Warning: Each child in a list') ||
          message.includes('key prop')) {
        
        keyWarningCount++
        console.group(`🚨 REACT KEY WARNING #${keyWarningCount}:`)
        console.log('📍 Original warning:', ...args)
        
        // Get the stack trace
        const stack = new Error().stack
        if (stack) {
          const stackLines = stack.split('\n')
          const relevantLines = stackLines.filter(line => 
            line.includes('git-compare') || 
            line.includes('components') ||
            line.includes('src/')
          ).slice(0, 5)
          
          if (relevantLines.length > 0) {
            console.log('📍 Relevant stack trace:')
            relevantLines.forEach(line => console.log('  ', line.trim()))
          }
        }
        
        // Try to identify the problematic component
        const componentMatch = message.match(/Check the render method of `(\w+)`/)
        if (componentMatch) {
          console.log(`📍 Problematic component: ${componentMatch[1]}`)
        }
        
        console.groupEnd()
        
        // Still call the original function to maintain normal error display
        originalFunction.apply(console, args)
      } else {
        originalFunction.apply(console, args)
      }
    }
  }
  
  console.error = interceptor(originalConsoleError, 'ERROR')
  console.warn = interceptor(originalConsoleWarn, 'WARN')
  
  console.log('✅ React key warning interceptor active')
  console.log('💡 Now perform actions that trigger the warnings...')
  
  // Return cleanup function
  return () => {
    console.error = originalConsoleError
    console.warn = originalConsoleWarn
    console.log('🔄 React key warning interceptor deactivated')
  }
}

// Manual DOM inspection for common React key issue patterns
export function inspectDOMForKeyIssues() {
  console.log('🔍 Inspecting DOM for potential React key issues...')
  
  const issues: Array<{element: Element, issue: string, children: Element[]}> = []
  
  // Find containers with multiple similar children
  document.querySelectorAll('div, ul, ol').forEach(container => {
    const children = Array.from(container.children)
    
    if (children.length > 1) {
      // Group children by tag name
      const tagGroups = new Map<string, Element[]>()
      children.forEach(child => {
        const tag = child.tagName.toLowerCase()
        if (!tagGroups.has(tag)) {
          tagGroups.set(tag, [])
        }
        tagGroups.get(tag)!.push(child)
      })
      
      // Report groups with multiple elements
      tagGroups.forEach((elements, tag) => {
        if (elements.length > 1) {
          issues.push({
            element: container,
            issue: `Container has ${elements.length} ${tag} elements`,
            children: elements
          })
        }
      })
    }
  })
  
  if (issues.length > 0) {
    console.group('🚨 Potential React key issues found:')
    issues.forEach((issue, index) => {
      console.log(`${index + 1}. ${issue.issue}`)
      console.log('   Container:', issue.element)
      console.log('   Classes:', issue.element.className)
      console.log('   Children:', issue.children)
      
      // Try to identify if this looks like a React component
      const containerClasses = issue.element.className?.toString() || ''
      if (containerClasses.includes('space-') || 
          containerClasses.includes('grid') || 
          containerClasses.includes('flex')) {
        console.log('   🎯 This looks like a Tailwind/React component!')
      }
    })
    console.groupEnd()
  } else {
    console.log('✅ No obvious DOM patterns found that suggest React key issues')
  }
  
  return issues
}

// Find React components in the DOM by looking for React Fiber nodes
export function findReactComponents() {
  console.log('🔍 Searching for React components in DOM...')
  
  const reactElements: Array<{element: Element, fiberNode: unknown}> = []
  
  document.querySelectorAll('*').forEach(element => {
    // Check for React fiber nodes (different possible property names)
    const fiberKeys = Object.keys(element).filter(key => 
      key.startsWith('__reactFiber') || 
      key.startsWith('__reactInternalInstance') ||
      key.startsWith('_reactInternalFiber')
    )
    
    if (fiberKeys.length > 0 && fiberKeys[0]) {
      const fiberNode = (element as unknown as { [key: string]: unknown })[fiberKeys[0]]
      reactElements.push({ element, fiberNode })
    }
  })
  
  if (reactElements.length > 0) {
    console.group(`🎯 Found ${reactElements.length} React elements:`)
    reactElements.slice(0, 10).forEach((item, index) => { // Limit output
      const fiberNode = item.fiberNode as { type?: { name?: string }; elementType?: { name?: string } } | null
      const componentName = fiberNode?.type?.name || 
                           fiberNode?.elementType?.name || 
                           'Unknown'
      console.log(`${index + 1}. ${componentName}:`, item.element)
    })
    if (reactElements.length > 10) {
      console.log(`... and ${reactElements.length - 10} more`)
    }
    console.groupEnd()
  } else {
    console.log('❌ No React fiber nodes found in DOM')
  }
  
  return reactElements
}

// Comprehensive debugging function
export function debugReactKeysSimple() {
  console.clear()
  console.log('🚀 Starting simple React key debugging...')
  
  // Step 1: Set up warning interceptor
  const cleanup = interceptReactKeyWarnings()
  
  // Step 2: Inspect DOM
  setTimeout(() => {
    inspectDOMForKeyIssues()
  }, 500)
  
  // Step 3: Find React components
  setTimeout(() => {
    findReactComponents()
  }, 1000)
  
  // Step 4: Instructions
  setTimeout(() => {
    console.log('')
    console.log('📋 Next steps:')
    console.log('1. Interact with the page (click buttons, type in inputs)')
    console.log('2. Watch for 🚨 REACT KEY WARNING messages')
    console.log('3. Check the stack traces for component locations')
    console.log('')
    console.log('💡 To stop monitoring, run: cleanup()')
    
    // Make cleanup available globally for manual stopping
    ;(window as { stopReactKeyDebugging?: () => void }).stopReactKeyDebugging = cleanup
  }, 1500)
}
