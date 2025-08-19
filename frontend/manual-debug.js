// Manual React Key Debugging Script
// Copy and paste this into your browser console

console.clear();
console.log('🚀 Manual React Key Debugging');

// Override console.error to catch React warnings
const originalError = console.error;
console.error = function(...args) {
  const message = args.join(' ');
  
  if (message.includes('Each child in a list should have a unique "key" prop')) {
    console.group('🚨 REACT KEY WARNING CAUGHT:');
    console.log('Message:', message);
    console.trace('Stack trace:');
    console.groupEnd();
  }
  
  // Call original
  originalError.apply(console, args);
};

console.log('✅ React key warning interceptor active');
console.log('💡 Now trigger the warning by interacting with the page...');

// Also scan the DOM for suspicious patterns
console.log('🔍 Scanning DOM for potential issues...');

document.querySelectorAll('div').forEach((div, index) => {
  const children = Array.from(div.children);
  if (children.length > 1) {
    const classes = div.className || '';
    if (classes.includes('space-') || classes.includes('grid') || classes.includes('flex')) {
      console.log(`Suspicious div #${index}:`, div);
      console.log(`  Classes: ${classes}`);
      console.log(`  Children (${children.length}):`, children);
    }
  }
});
