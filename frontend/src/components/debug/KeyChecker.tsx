// Create this temporary debugging component
import React, { useEffect } from 'react';

export const KeyChecker = ({ children, name }: { children: React.ReactNode, name: string }) => {
  useEffect(() => {
    console.log(`🔍 Checking keys for: ${name}`)
    
    const childArray = React.Children.toArray(children)
    console.log(`📊 ${name} has ${childArray.length} children`)
    
    const missingKeys: number[] = []
    
    childArray.forEach((child, index) => {
      if (React.isValidElement(child)) {
        const hasKey = child.key !== null
        const childType = typeof child.type === 'string' ? child.type : 
                         typeof child.type === 'function' ? child.type.name || 'Component' :
                         'Unknown'
        const keyInfo = hasKey ? `key="${child.key}"` : 'NO KEY'
        
        console.log(`  Child ${index}: ${hasKey ? '✅' : '❌'} ${childType} - ${keyInfo}`)
        
        if (!hasKey) {
          missingKeys.push(index)
        }
      } else {
        console.log(`  Child ${index}: ❓ Non-element (${typeof child})`)
      }
    })
    
    if (missingKeys.length > 0) {
      console.warn(`🚨 ${name} has ${missingKeys.length} children missing keys at indices: [${missingKeys.join(', ')}]`)
    }
  }, [children, name])

  return <>{children}</>;
};
