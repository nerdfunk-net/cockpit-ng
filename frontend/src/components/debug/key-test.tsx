'use client'

export default function KeyTest() {
  console.log('🔍 KeyTest component rendering...')
  
  // Test if the issue is with arrays
  const testArray = [1, 2, 3]
  
  return (
    <div key="test-container">
      <h1 key="test-title">Key Test Component</h1>
      <div key="test-list">
        {testArray.map((item, index) => (
          <div key={`test-item-${index}`}>
            Item {item}
          </div>
        ))}
      </div>
    </div>
  )
}
