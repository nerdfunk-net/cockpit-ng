// Test script for debugging authentication and empty string issues
// Run this in the browser console to debug authentication state

// Clear invalid tokens and reset authentication
console.log('=== Clearing Authentication ===');
localStorage.removeItem('cockpit-auth');
console.log('Cleared localStorage auth data');

// Force reload to trigger new authentication
console.log('Reloading page to trigger new authentication...');
window.location.reload();
