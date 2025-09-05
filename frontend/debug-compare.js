// Debug helper for Compare page authentication
console.log('=== Compare Page Authentication Debug ===');

// Check authentication state
const authData = localStorage.getItem('cockpit-auth');
if (authData) {
  try {
    const parsed = JSON.parse(authData);
    console.log('Auth data found:', {
      hasToken: !!parsed.state?.token,
      isAuthenticated: !!parsed.state?.isAuthenticated,
      user: parsed.state?.user?.username
    });
  } catch (e) {
    console.error('Failed to parse auth data:', e);
  }
} else {
  console.log('No auth data found in localStorage');
}

// Test API endpoint
fetch('/api/proxy/git-repositories')
  .then(response => {
    console.log('API test response status:', response.status);
    if (response.status === 401) {
      console.log('Authentication required - this is expected');
    }
    return response.json();
  })
  .then(data => {
    console.log('API test response data:', data);
  })
  .catch(error => {
    console.error('API test error:', error);
  });

// Clear any invalid auth and reload if needed
// localStorage.removeItem('cockpit-auth');
// window.location.reload();
