# OIDC Authentication Setup Guide

This guide explains how to configure and use OpenID Connect (OIDC) authentication with your Keycloak instance in Cockpit.

## Overview

OIDC authentication has been implemented to allow Single Sign-On (SSO) using your existing Keycloak identity provider. Users can now login using either:
- Traditional username/password authentication
- OIDC SSO via the "Sign in with SSO" button

## Architecture

### Backend Components

1. **Configuration** ([backend/config.py](backend/config.py))
   - OIDC settings loaded from environment variables
   - Discovery URL for automatic endpoint configuration
   - Client credentials and claim mappings

2. **OIDC Service** ([backend/services/oidc_service.py](backend/services/oidc_service.py))
   - Handles OIDC discovery and configuration
   - Token verification using JWKS
   - User provisioning and mapping
   - Authorization code exchange

3. **OIDC Router** ([backend/routers/oidc.py](backend/routers/oidc.py))
   - `/auth/oidc/enabled` - Check if OIDC is enabled
   - `/auth/oidc/login` - Initiate authentication flow
   - `/auth/oidc/callback` - Handle provider callback
   - `/auth/oidc/logout` - Handle logout

4. **Models** ([backend/models/auth.py](backend/models/auth.py))
   - Pydantic models for OIDC requests and responses

### Frontend Components

1. **Login Page** ([frontend/src/app/login/page.tsx](frontend/src/app/login/page.tsx))
   - Displays SSO button when OIDC is enabled
   - Initiates OIDC flow and redirects to provider
   - Maintains traditional login form

2. **Callback Page** ([frontend/src/app/login/callback/page.tsx](frontend/src/app/login/callback/page.tsx))
   - Handles redirect from OIDC provider
   - Exchanges authorization code for tokens
   - Creates user session and redirects to dashboard

## Configuration

### Step 1: Update Environment Variables

Edit `backend/.env` and configure these settings:

```bash
# Enable OIDC authentication
OIDC_ENABLED=true

# OIDC Discovery URL (auto-discovers endpoints)
# For Keycloak: http://{host}:{port}/realms/{realm}/.well-known/openid-configuration
OIDC_DISCOVERY_URL=http://127.0.0.1:7080/realms/oidc/.well-known/openid-configuration

# OIDC Client Configuration
OIDC_CLIENT_ID=oidc
OIDC_CLIENT_SECRET=hOpFglgyuFLdb5N2nq6ZwkVbLYclhXnA

# Redirect URI (where users return after authentication)
OIDC_REDIRECT_URI=http://localhost:3000/login/callback

# Scopes (comma-separated)
OIDC_SCOPES=openid,profile,email,offline_access

# Claim Mapping (extract user info from ID token)
OIDC_CLAIM_USERNAME=email
OIDC_CLAIM_EMAIL=email
OIDC_CLAIM_NAME=name

# Auto-provision new users on first login
OIDC_AUTO_PROVISION=true
```

### Step 2: Install Dependencies

The OIDC implementation requires additional Python packages:

```bash
cd backend
pip install httpx python-jose[cryptography]
```

Or install from the updated requirements:

```bash
pip install -r requirements.txt
```

### Step 3: Configure Keycloak Client

In your Keycloak admin console:

1. **Create/Configure Client:**
   - Client ID: `oidc` (or match `OIDC_CLIENT_ID`)
   - Client Protocol: `openid-connect`
   - Access Type: `confidential`
   - Valid Redirect URIs: `http://localhost:3000/login/callback`
   - Web Origins: `http://localhost:3000`

2. **Client Credentials:**
   - Copy the client secret from Credentials tab
   - Update `OIDC_CLIENT_SECRET` in `.env`

3. **Mappers (Optional):**
   - Ensure email, name, and preferred_username are included in ID token
   - Add custom claims if needed

### Step 4: Restart Services

```bash
# Backend
cd backend
python start.py

# Frontend (in separate terminal)
cd frontend
npm run dev
```

## Usage

### User Login Flow

1. Navigate to the login page: `http://localhost:3000/login`
2. Click "Sign in with SSO" button
3. Redirect to Keycloak login page
4. Enter Keycloak credentials
5. Redirect back to application
6. Automatic user provisioning (if enabled)
7. Redirect to dashboard with active session

### State Parameter

The implementation uses the `state` parameter for CSRF protection:
- Generated on login initiation
- Stored in sessionStorage
- Validated on callback
- Prevents CSRF attacks

### Token Flow

1. **Authorization Code Request:**
   - User clicks SSO button
   - App generates authorization URL with state
   - User redirects to Keycloak

2. **Authorization Code Exchange:**
   - Keycloak redirects back with code
   - Backend exchanges code for tokens
   - ID token verified using JWKS

3. **User Provisioning:**
   - Extract claims from ID token
   - Check if user exists in local database
   - Create new user if auto-provision enabled
   - Update user info if changed

4. **Session Creation:**
   - Generate internal JWT token
   - Return to frontend
   - Store in auth store
   - User logged in

## User Provisioning

### Auto-Provisioning (OIDC_AUTO_PROVISION=true)

When enabled, new users are automatically created on first login:
- Username from `OIDC_CLAIM_USERNAME`
- Email from `OIDC_CLAIM_EMAIL`
- Real name from `OIDC_CLAIM_NAME`
- Default role: `user`
- Random password (not used for OIDC login)

### Manual Provisioning (OIDC_AUTO_PROVISION=false)

Users must exist in the database before OIDC login:
- Create users manually via user management
- Username must match the OIDC claim
- OIDC login will update email/name if changed

## Claim Mapping

The implementation extracts user information from these ID token claims:

| Setting | Default (Keycloak) | Description |
|---------|---------|-------------|
| `OIDC_CLAIM_USERNAME` | `preferred_username` | Username for user identification (Keycloak login username) |
| `OIDC_CLAIM_EMAIL` | `email` | User's email address |
| `OIDC_CLAIM_NAME` | `name` | User's display name (full name) |

### Keycloak Standard Claims

Keycloak provides these claims in the ID token when using the `openid`, `profile`, and `email` scopes:

| Claim | Description | Example |
|-------|-------------|---------|
| `preferred_username` | **Login username** (recommended for OIDC_CLAIM_USERNAME) | `john.doe` |
| `email` | Email address | `john.doe@example.com` |
| `name` | Full display name | `John Doe` |
| `given_name` | First name | `John` |
| `family_name` | Last name | `Doe` |
| `sub` | Unique user ID (UUID) | `f:abc123:user-uuid` |

### Customizing Claims

**Recommended for Keycloak:**

```bash
# Use Keycloak's login username (recommended)
OIDC_CLAIM_USERNAME=preferred_username
OIDC_CLAIM_EMAIL=email
OIDC_CLAIM_NAME=name
```

**Alternative configurations:**

```bash
# Use email as username instead of login username
OIDC_CLAIM_USERNAME=email

# Use first name only for display name
OIDC_CLAIM_NAME=given_name
```

## Security Considerations

### Token Verification

- ID tokens are verified using RS256 algorithm
- JWKS keys fetched from provider and cached
- Issuer and audience validation enforced
- Token signature verified with public keys

### State Parameter

- 32-byte random token generated per request
- Stored in sessionStorage (client-side)
- Validated on callback to prevent CSRF
- Cleared after successful authentication

### HTTPS in Production

For production deployments:
- Use HTTPS for all URLs
- Update `OIDC_REDIRECT_URI` to use `https://`
- Configure valid SSL certificates
- Enable HSTS headers

## Troubleshooting

### "OIDC authentication is not enabled"

- Set `OIDC_ENABLED=true` in `.env`
- Restart backend service

### "Unable to connect to OIDC provider"

- Check `OIDC_DISCOVERY_URL` is accessible
- Verify Keycloak is running
- Check network/firewall settings
- Test URL in browser: should return JSON config

### "Invalid state parameter"

- State mismatch (CSRF protection)
- Clear browser sessionStorage
- Try login flow again

### "Failed to exchange authorization code"

- Check `OIDC_CLIENT_SECRET` matches Keycloak
- Verify client type is "confidential"
- Check `OIDC_REDIRECT_URI` matches Keycloak config
- Review Keycloak client logs

### "Username claim not found in token"

- Check `OIDC_CLAIM_USERNAME` setting
- Verify claim is included in ID token
- Add mapper in Keycloak if needed
- Test with different claim name

### "User does not exist and auto-provisioning is disabled"

- Set `OIDC_AUTO_PROVISION=true` or
- Manually create user with matching username

## API Endpoints

### Check OIDC Status
```
GET /auth/oidc/enabled
Response: { "enabled": true }
```

### Initiate Login
```
GET /auth/oidc/login
Response: {
  "authorization_url": "https://...",
  "state": "..."
}
```

### Handle Callback
```
POST /auth/oidc/callback
Body: { "code": "...", "state": "..." }
Response: {
  "access_token": "...",
  "token_type": "bearer",
  "expires_in": 600,
  "user": { ... }
}
```

### Logout
```
POST /auth/oidc/logout
Response: {
  "logout_url": "...",
  "requires_redirect": true
}
```

## Dual Authentication

The application supports both authentication methods simultaneously:
- Traditional username/password login
- OIDC SSO login
- Users can use either method
- Sessions are identical regardless of login method

## Testing

### Manual Testing

1. Enable OIDC with valid configuration
2. Navigate to login page
3. Verify "Sign in with SSO" button appears
4. Click button and complete Keycloak login
5. Verify redirect to dashboard
6. Check user was created (if auto-provision enabled)

### Logging

Enable debug logging to troubleshoot:

```bash
LOG_LEVEL=DEBUG
```

Backend logs will show:
- OIDC configuration loading
- Token exchange requests
- User provisioning attempts
- Error details

## Production Deployment

For production environments:

1. **Use HTTPS everywhere:**
   ```bash
   OIDC_DISCOVERY_URL=https://keycloak.yourdomain.com/realms/prod/.well-known/openid-configuration
   OIDC_REDIRECT_URI=https://cockpit.yourdomain.com/login/callback
   ```

2. **Secure client secret:**
   - Use strong, random secret
   - Store in secrets manager
   - Rotate periodically

3. **Configure proper scopes:**
   - Only request needed scopes
   - Review with security team

4. **Test thoroughly:**
   - Login/logout flows
   - User provisioning
   - Token expiration
   - Error scenarios

## Support

For issues or questions:
- Check logs for error details
- Review Keycloak client configuration
- Verify network connectivity
- Test discovery URL manually

## References

- [OpenID Connect Specification](https://openid.net/specs/openid-connect-core-1_0.html)
- [Keycloak Documentation](https://www.keycloak.org/documentation)
- [OAuth 2.0 Authorization Code Flow](https://oauth.net/2/grant-types/authorization-code/)
