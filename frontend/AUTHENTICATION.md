# Cookie-Based Authentication System

This application now uses a **cookie-based authentication system** instead of localStorage persistence.

## 🍪 How It Works

### Authentication Storage
- **Tokens**: Stored in `cockpit_auth_token` cookie
- **User Info**: Stored in `cockpit_user_info` cookie
- **Duration**: 1 day expiry (configurable)
- **Security**: Secure cookies in production, SameSite=strict

### Cookie Configuration
```typescript
{
  expires: 1,           // 1 day
  secure: production,   // HTTPS only in production
  sameSite: 'strict',   // CSRF protection
}
```

## 🔐 Security Features

### Automatic Logout Triggers
1. **Cookie Expiry**: After 24 hours
2. **JWT Token Expiry**: After 15 minutes (refreshed automatically)
3. **Cookie Clearing**: When user clears browser cookies
4. **External Cookie Removal**: Detected every 30 seconds
5. **Inactivity**: After 15 minutes of no user activity

### Session Management
- **Auto-Refresh**: Tokens refreshed 2 minutes before expiry
- **Activity Tracking**: Mouse, keyboard, scroll, touch events
- **Background Monitoring**: Checks for cookie presence every 30 seconds
- **Graceful Degradation**: Falls back to logout on any auth failure

## 🎯 User Experience

### Login Process
1. User enters credentials
2. JWT token received from backend
3. Token + user info stored in secure cookies
4. Automatic session management begins

### Logout Scenarios
- **Manual Logout**: Click logout button
- **Browser Cookie Clear**: Automatic logout within 30 seconds
- **Session Timeout**: Automatic logout after inactivity
- **Token Expiry**: Automatic logout if refresh fails

## 🧪 Testing Authentication

### Test Cookie Clearing
1. Login to the application
2. Open browser DevTools → Application → Cookies
3. Delete `cockpit_auth_token` or `cockpit_user_info` cookies
4. Wait up to 30 seconds → Should automatically logout

### Test Browser Restart
1. Login to the application
2. Close browser completely
3. Reopen browser and navigate to app
4. Should remain logged in (cookies persist)

### Test Inactivity
1. Login to the application
2. Don't interact with the app for 15+ minutes
3. Token refresh should stop automatically
4. Manual token refresh will fail due to inactivity

## 🔧 Migration from localStorage

The new system automatically:
- ✅ Clears old localStorage tokens on logout
- ✅ Removes legacy `cockpit-auth` localStorage entries
- ✅ Maintains backward compatibility during transition

## 🐛 Debugging Authentication

### Browser Console Logs
Look for these session manager messages:
```
Session Manager: Cookies cleared externally, logging out
Session Manager: Token about to expire and user is active, refreshing now  
Session Manager: Token has expired, logging out
Session Manager: User inactive, skipping token refresh
```

### Cookie Inspection
Check these cookies in DevTools:
- `cockpit_auth_token` - JWT token
- `cockpit_user_info` - User profile data (JSON)

### Common Issues
1. **Still logged in after cookie clear**: Wait up to 30 seconds for detection
2. **Logout on page refresh**: Check cookie expiry and secure flag settings
3. **Frequent re-logins**: Check JWT token expiry and refresh logic

## 📝 Configuration

Cookie settings can be modified in `frontend/src/lib/auth-store.ts`:
```typescript
const COOKIE_CONFIG = {
  expires: 1,              // Days until cookie expires
  secure: production,      // Require HTTPS
  sameSite: 'strict',      // CSRF protection level
}
```