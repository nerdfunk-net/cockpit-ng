# OIDC Authentication Setup Guide

This guide explains how to configure and use OpenID Connect (OIDC) authentication with Keycloak or other OIDC providers in Cockpit.

## Overview

OIDC authentication has been implemented to allow Single Sign-On (SSO) using your existing identity providers. The system supports:
- **Multiple OIDC Providers**: Configure multiple Keycloak instances or different identity providers
- **Provider Selection**: Users can choose which provider to use during login
- **Traditional Authentication**: Optional username/password fallback
- **Automatic User Provisioning**: Create users on first login per provider

## Multiple Provider Support

### Architecture

The multi-provider OIDC implementation uses a YAML configuration file (`config/oidc_providers.yaml`) to define multiple identity providers. Key features:

- **Provider Selection UI**: Users see a list of enabled providers on the login page
- **Per-Provider Configuration**: Each provider has its own client credentials, claim mappings, and auto-provisioning settings
- **Provider-Specific Endpoints**: Backend routes include provider_id (e.g., `/auth/oidc/corporate/login`)
- **State-Based Tracking**: Provider ID embedded in OAuth state parameter for callback validation

### Configuration File Structure

Create `config/oidc_providers.yaml`:

```yaml
# Global OIDC Settings
global:
  allow_traditional_login: true  # Allow username/password login alongside SSO

# Provider Definitions
providers:
  corporate:
    enabled: true
    name: "Corporate SSO"
    description: "Sign in with your company account"
    icon: "building"  # Icon identifier for frontend (building, flask, etc.)
    display_order: 1  # Lower numbers appear first

    # OpenID Connect Configuration
    discovery_url: "https://keycloak.company.com/realms/production/.well-known/openid-configuration"
    client_id: "cockpit-prod"
    client_secret: "your-client-secret-here"

    # Custom CA Certificate (for air-gapped environments with self-signed certs)
    # Path can be absolute or relative to project root
    # Optional: Leave empty or omit if using publicly trusted certificates
    ca_cert_path: "config/certs/corporate-ca.cert.pem"
    
    # OAuth Scopes
    scopes:
      - openid
      - profile
      - email
      - offline_access
    
    # Claim Mapping
    claim_mappings:
      username: "preferred_username"  # Which claim to use for username
      email: "email"                   # Which claim to use for email
      name: "name"                     # Which claim to use for display name
    
    # Auto-Provisioning Settings
    auto_provisioning:
      enabled: true           # Create users on first login
      default_role: "user"    # Role for auto-provisioned users (user or admin)

  development:
    enabled: true
    name: "Development Keycloak"
    description: "For testing and development"
    icon: "flask"
    display_order: 2
    
    discovery_url: "http://127.0.0.1:7080/realms/oidc/.well-known/openid-configuration"
    client_id: "oidc"
    client_secret: "hOpFglgyuFLdb5N2nq6ZwkVbLYclhXnA"
    
    scopes:
      - openid
      - profile
      - email
    
    claim_mappings:
      username: "email"       # Use email as username
      email: "email"
      name: "name"
    
    auto_provisioning:
      enabled: true
      default_role: "user"
```

### Backend Components

1. **Settings Manager** ([backend/settings_manager.py](backend/settings_manager.py))
   - Loads and parses `oidc_providers.yaml`
   - Methods: `get_oidc_providers()`, `get_enabled_oidc_providers()`, `get_oidc_provider(provider_id)`

2. **OIDC Service** ([backend/services/oidc_service.py](backend/services/oidc_service.py))
   - Supports provider_id parameter in all methods
   - Per-provider configuration caching
   - Per-provider JWKS caching

3. **OIDC Router** ([backend/routers/oidc.py](backend/routers/oidc.py))
   - `GET /auth/oidc/providers` - List enabled providers
   - `GET /auth/oidc/{provider_id}/login` - Initiate login with specific provider
   - `POST /auth/oidc/{provider_id}/callback` - Handle callback for specific provider
   - `POST /auth/oidc/{provider_id}/logout` - Logout from specific provider

4. **Models** ([backend/models/auth.py](backend/models/auth.py))
   - `OIDCProvider`: Provider information model
   - `OIDCProvidersResponse`: List of providers response
   - Extended models with provider_id tracking

### Frontend Components

1. **Login Page** ([frontend/src/app/login/page.tsx](frontend/src/app/login/page.tsx))
   - Fetches available providers from `/auth/oidc/providers`
   - Displays provider selection buttons with names, descriptions, and icons
   - Handles provider-specific login initiation
   - Supports two modes:
     - **Dual mode**: Traditional login form + SSO providers (when `allow_traditional_login: true`)
     - **SSO-only mode**: Only provider buttons (when `allow_traditional_login: false`)

2. **Callback Handler** ([frontend/src/app/login/callback/page.tsx](frontend/src/app/login/callback/page.tsx))
   - Extracts provider_id from state parameter
   - Calls provider-specific callback endpoint
   - Handles provider-specific error messages

## Quick Start: Single Provider

For a simple single-provider setup, create `config/oidc_providers.yaml`:

```yaml
global:
  allow_traditional_login: true

providers:
  keycloak:
    enabled: true
    name: "Sign in with SSO"
    discovery_url: "http://127.0.0.1:7080/realms/oidc/.well-known/openid-configuration"
    client_id: "oidc"
    client_secret: "your-secret-here"
    scopes:
      - openid
      - profile
      - email
    claim_mappings:
      username: "preferred_username"
      email: "email"
      name: "name"
    auto_provisioning:
      enabled: true
      default_role: "user"
```

No environment variables needed - the YAML file is the only configuration required.

## Architecture (Legacy Single Provider)

> **Note**: Legacy environment variable configuration is still supported for backwards compatibility, but the YAML configuration method is recommended for all deployments.

### Backend Components (Single Provider)

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

### Custom CA Certificates (Air-Gapped Environments)

For environments with self-signed certificates or private Certificate Authorities:

**Configuration:**
```yaml
providers:
  corporate:
    # ... other settings ...
    ca_cert_path: "config/certs/corporate-ca.cert.pem"
```

**Features:**
- Each provider can use a different CA certificate
- Supports both absolute and relative paths
- Certificate must be in PEM format
- Place certificates in `config/certs/` directory
- Multiple CA certificates supported (one per provider)

**Setup:**
1. Export your CA certificate in PEM format
2. Copy to `config/certs/` directory
3. Add `ca_cert_path` to provider configuration
4. Restart backend service

**Example for multiple providers:**
```yaml
providers:
  corporate:
    ca_cert_path: "config/certs/corporate-ca.pem"

  development:
    ca_cert_path: "config/certs/dev-ca.pem"

  partners:
    ca_cert_path: "config/certs/partner-ca.pem"
```

### HTTPS in Production

For production deployments:
- Use HTTPS for all URLs
- Update redirect URIs to use `https://`
- Configure valid SSL certificates
- Enable HSTS headers
- Use custom CA certificates for internal CAs

## Troubleshooting

### "OIDC authentication is not enabled"

- Set `OIDC_ENABLED=true` in `.env`
- Restart backend service

### "Unable to connect to OIDC provider"

- Check `OIDC_DISCOVERY_URL` is accessible
- Verify Keycloak is running
- Check network/firewall settings
- Test URL in browser: should return JSON config

### "SSL: CERTIFICATE_VERIFY_FAILED" or "unable to get local issuer certificate"

This error occurs when using self-signed certificates or private CAs:

**Solution:**
1. Export your CA certificate:
   ```bash
   # From Keycloak/OIDC provider server
   openssl s_client -connect keycloak.example.com:443 -showcerts
   # Copy the CA certificate (between BEGIN/END CERTIFICATE)
   ```

2. Save as PEM file:
   ```bash
   mkdir -p config/certs
   # Save certificate as config/certs/ca.cert.pem
   ```

3. Configure provider:
   ```yaml
   providers:
     corporate:
       ca_cert_path: "config/certs/ca.cert.pem"
   ```

4. Restart backend:
   ```bash
   cd backend
   python start.py
   ```

**Verify certificate path:**
- Check file exists: `ls -l config/certs/ca.cert.pem`
- Check permissions: File should be readable
- Check format: File should start with `-----BEGIN CERTIFICATE-----`
- Check logs for: `Loaded custom CA certificate for provider 'corporate'`

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

## Multi-Provider Troubleshooting

### "OIDC provider 'xyz' not found"

- Check provider_id in `oidc_providers.yaml` matches the one being used
- Provider IDs are case-sensitive
- Restart backend after YAML changes

### "OIDC provider 'xyz' is not enabled"

- Set `enabled: true` for the provider in YAML config
- Check YAML syntax is valid
- Restart backend service

### No providers appearing on login page

- Verify at least one provider has `enabled: true`
- Check backend logs for YAML parsing errors
- Ensure `config/oidc_providers.yaml` exists
- Test endpoint: `GET /api/proxy/auth/oidc/providers`

### Provider-specific callback failures

- Verify `discovery_url` is accessible for each provider
- Check `client_id` and `client_secret` match each Keycloak client
- Ensure each provider's redirect URI includes: `http://localhost:3000/login/callback`
- Review provider-specific logs in backend

### State parameter provider mismatch

- State format should be: `provider_id:random_state`
- Clear browser sessionStorage and cookies
- Ensure callback URL doesn't modify state parameter
- Check for URL encoding issues

### Users from different providers conflict

- Use different `claim_mappings.username` fields per provider to avoid conflicts
- Example: Corporate uses `preferred_username`, Dev uses `email`
- Consider adding provider prefix to usernames if needed
- Review user provisioning logs

### Icon not displaying correctly

- Valid icon values: `building`, `flask`, or leave empty for default
- Icons are rendered by frontend (lucide-react)
- Check frontend console for icon errors

## Configuration Examples

### Example 1: Production + Staging Keycloak

```yaml
global:
  allow_traditional_login: false  # SSO-only mode

providers:
  production:
    enabled: true
    name: "Production Environment"
    description: "For production access"
    icon: "building"
    display_order: 1
    discovery_url: "https://sso.company.com/realms/prod/.well-known/openid-configuration"
    client_id: "cockpit"
    client_secret: "prod-secret"
    scopes: [openid, profile, email]
    claim_mappings:
      username: "preferred_username"
      email: "email"
      name: "name"
    auto_provisioning:
      enabled: true
      default_role: "user"

  staging:
    enabled: true
    name: "Staging Environment"
    description: "For testing and QA"
    icon: "flask"
    display_order: 2
    discovery_url: "https://sso-staging.company.com/realms/stage/.well-known/openid-configuration"
    client_id: "cockpit-stage"
    client_secret: "stage-secret"
    scopes: [openid, profile, email]
    claim_mappings:
      username: "preferred_username"
      email: "email"
      name: "name"
    auto_provisioning:
      enabled: true
      default_role: "user"
```

### Example 2: Corporate + External Partner Access

```yaml
global:
  allow_traditional_login: true  # Allow password login for admins

providers:
  corporate:
    enabled: true
    name: "Employee Login"
    description: "For company employees"
    icon: "building"
    display_order: 1
    discovery_url: "https://sso.company.com/realms/employees/.well-known/openid-configuration"
    client_id: "cockpit-internal"
    client_secret: "internal-secret"
    scopes: [openid, profile, email, groups]
    claim_mappings:
      username: "preferred_username"
      email: "email"
      name: "name"
    auto_provisioning:
      enabled: true
      default_role: "user"

  partners:
    enabled: true
    name: "Partner Access"
    description: "For external partners"
    icon: "users"
    display_order: 2
    discovery_url: "https://partners.company.com/realms/partners/.well-known/openid-configuration"
    client_id: "cockpit-partners"
    client_secret: "partners-secret"
    scopes: [openid, email]
    claim_mappings:
      username: "email"  # Use email as username for partners
      email: "email"
      name: "name"
    auto_provisioning:
      enabled: false  # Manually create partner accounts
      default_role: "user"
```

### Example 3: Local Development

```yaml
global:
  allow_traditional_login: true  # Enable password login for local dev

providers:
  local:
    enabled: true
    name: "Local Keycloak"
    description: "Development environment"
    icon: "flask"
    display_order: 1
    discovery_url: "http://127.0.0.1:7080/realms/oidc/.well-known/openid-configuration"
    client_id: "oidc"
    client_secret: "dev-secret"
    scopes: [openid, profile, email]
    claim_mappings:
      username: "email"
      email: "email"
      name: "name"
    auto_provisioning:
      enabled: true
      default_role: "admin"  # Dev users get admin by default
```

## Migration from Environment Variables

If you have existing OIDC configuration using environment variables (`.env`), migrate to YAML:

**Old (.env):**
```bash
OIDC_ENABLED=true
OIDC_DISCOVERY_URL=http://127.0.0.1:7080/realms/oidc/.well-known/openid-configuration
OIDC_CLIENT_ID=oidc
OIDC_CLIENT_SECRET=hOpFglgyuFLdb5N2nq6ZwkVbLYclhXnA
OIDC_REDIRECT_URI=http://localhost:3000/login/callback
OIDC_SCOPES=openid,profile,email
OIDC_CLAIM_USERNAME=preferred_username
OIDC_CLAIM_EMAIL=email
OIDC_CLAIM_NAME=name
OIDC_AUTO_PROVISION=true
```

**New (config/oidc_providers.yaml):**
```yaml
global:
  allow_traditional_login: true

providers:
  default:
    enabled: true
    name: "Sign in with SSO"
    discovery_url: "http://127.0.0.1:7080/realms/oidc/.well-known/openid-configuration"
    client_id: "oidc"
    client_secret: "hOpFglgyuFLdb5N2nq6ZwkVbLYclhXnA"
    scopes: [openid, profile, email]
    claim_mappings:
      username: "preferred_username"
      email: "email"
      name: "name"
    auto_provisioning:
      enabled: true
      default_role: "user"
```

After migration, you can remove the OIDC_* environment variables from `.env`.

## References

- [OpenID Connect Specification](https://openid.net/specs/openid-connect-core-1_0.html)
- [Keycloak Documentation](https://www.keycloak.org/documentation)
- [OAuth 2.0 Authorization Code Flow](https://oauth.net/2/grant-types/authorization-code/)
- [YAML Configuration Reference](https://yaml.org/spec/1.2/spec.html)
