# OIDC Multi-Provider Implementation Files

This directory contains all the necessary files to implement the same multi-provider OIDC authentication system in other applications.

## Directory Structure

```
doc/oidc/
├── README.md                           # This file
├── backend/                            # Backend implementation files
│   ├── oidc_service.py                # Core OIDC service (Python/FastAPI)
│   ├── oidc.py                        # API router with endpoints
│   ├── auth.py                        # Pydantic models for OIDC
│   └── settings_manager.py            # YAML config loader
├── frontend/                           # Frontend implementation files
│   ├── login-page.tsx                 # Login page with provider selection (Next.js/React)
│   └── callback-page.tsx              # OAuth callback handler (Next.js/React)
├── config/                             # Configuration files
│   ├── oidc_providers.yaml            # Active configuration example
│   └── oidc_providers.yaml.example    # Comprehensive example with all options
└── examples/                           # Documentation and guides
    ├── OIDC_SETUP.md                  # User-facing setup guide
    └── OIDC_QUICKSTART.md             # Quick start guide
```

## Files Included

### Backend Files

#### 1. `backend/oidc_service.py` (Core Service)
**Purpose**: Main OIDC service class handling all provider operations

**Key Features**:
- Multi-provider support with per-provider caching
- OpenID Connect discovery endpoint fetching
- JWKS caching and token verification
- Custom CA certificate support for self-signed certificates
- User claim extraction with provider-specific mappings
- Auto-provisioning with configurable rules

**Dependencies**:
```python
httpx          # Async HTTP client
python-jose    # JWT handling
pyyaml         # YAML parsing
```

**Main Methods**:
- `get_oidc_config(provider_id)` - Fetch/cache OIDC discovery config
- `exchange_code_for_tokens(provider_id, code)` - Exchange auth code for tokens
- `verify_id_token(provider_id, id_token)` - Verify and decode ID token
- `extract_user_data(provider_id, claims)` - Extract user data from claims
- `provision_or_get_user(provider_id, user_data)` - Auto-provision users

#### 2. `backend/oidc.py` (API Router)
**Purpose**: FastAPI router with all OIDC endpoints

**Endpoints**:
- `GET /auth/oidc/enabled` - Check if OIDC is enabled
- `GET /auth/oidc/providers` - List enabled providers
- `GET /auth/oidc/{provider_id}/login` - Initiate OIDC login
- `POST /auth/oidc/{provider_id}/callback` - Handle OAuth callback
- `POST /auth/oidc/{provider_id}/logout` - Handle OIDC logout
- `GET /auth/oidc/debug` - Debug endpoint for configuration

**Adaptation Notes**:
- Replace `@router.get` decorators with your framework's routing
- Adjust dependency injection patterns
- Modify response models to match your API structure

#### 3. `backend/auth.py` (Data Models)
**Purpose**: Pydantic models for OIDC request/response validation

**Models**:
- `OIDCConfig` - OIDC discovery configuration
- `OIDCProvider` - Provider display information
- `OIDCProvidersResponse` - Providers list response
- `OIDCCallbackRequest` - Callback request payload
- `LoginResponse` - Authentication response
- `ApprovalPendingResponse` - User approval pending response

**Adaptation Notes**:
- For TypeScript: Convert to interfaces or Zod schemas
- For Django: Convert to Django REST Framework serializers
- For Express: Use TypeScript interfaces or class-validator

#### 4. `backend/settings_manager.py` (Config Loader)
**Purpose**: Load and manage OIDC providers from YAML configuration

**Key Methods**:
- `load_oidc_providers()` - Load YAML configuration
- `get_oidc_providers()` - Get all providers
- `get_enabled_oidc_providers()` - Get enabled providers (sorted)
- `get_oidc_provider(provider_id)` - Get specific provider
- `get_oidc_global_settings()` - Get global OIDC settings
- `is_oidc_enabled()` - Check if OIDC is enabled

**Adaptation Notes**:
- Extract only OIDC-related methods (lines 1194-1283)
- Replace file paths to match your project structure
- Adjust logging to match your logging system

### Frontend Files

#### 5. `frontend/login-page.tsx` (Login UI)
**Purpose**: Login page with provider selection buttons

**Features**:
- Fetches enabled providers from API
- Displays provider selection buttons with icons
- Supports dual mode (SSO + traditional login)
- Supports SSO-only mode
- Stores OAuth state in sessionStorage
- Redirects to provider authorization URL

**Key Components**:
- `OIDCProviderButtons` - Renders provider selection
- `handleOIDCLogin` - Initiates provider login flow

**Adaptation Notes**:
- For Vue: Convert to Vue composition API
- For Angular: Convert to Angular component with services
- For vanilla JS: Extract logic into plain JavaScript

#### 6. `frontend/callback-page.tsx` (Callback Handler)
**Purpose**: OAuth callback handler that completes authentication

**Features**:
- Extracts code and state from URL parameters
- Validates OAuth state parameter
- Extracts provider_id from state
- Calls provider-specific callback endpoint
- Handles success and error states
- Stores authentication token
- Redirects to application

**Adaptation Notes**:
- Replace `useSearchParams` with your router's query param API
- Adjust token storage to match your auth system
- Modify redirect logic to match your app structure

### Configuration Files

#### 7. `config/oidc_providers.yaml` (Active Config)
**Purpose**: Working configuration example with actual provider setup

**Structure**:
```yaml
providers:
  provider_id:
    # MANDATORY
    enabled: bool
    discovery_url: string
    client_id: string
    client_secret: string
    redirect_uri: string

    # OPTIONAL
    name: string
    description: string
    icon: string
    display_order: int
    ca_cert_path: string
    scopes: [string]
    claim_mappings:
      username: string
      email: string
      name: string
    auto_provision: bool
    default_role: string
    username_prefix: string

global:
  allow_traditional_login: bool
  session_timeout: int
  auto_redirect_single_provider: bool
```

#### 8. `config/oidc_providers.yaml.example` (Full Example)
**Purpose**: Comprehensive example with all configuration options documented

**Includes**:
- Detailed comments for each field
- Examples for multiple provider types (Keycloak, Azure AD, Okta)
- Field reference summary
- Mandatory vs optional field documentation
- Troubleshooting guide
- Quick start checklist

### Documentation Files

#### 9. `examples/OIDC_SETUP.md`
**Purpose**: Complete user-facing setup guide for configuring OIDC

**Covers**:
- Keycloak configuration steps
- Provider setup instructions
- Testing procedures
- Troubleshooting common issues

#### 10. `examples/OIDC_QUICKSTART.md`
**Purpose**: Quick start guide for developers

**Covers**:
- Minimal configuration steps
- Quick testing procedure
- Common configuration examples

## How to Use These Files

### Option 1: Direct Copy (Same Tech Stack)

If using **Python/FastAPI + Next.js/React**:

1. **Copy backend files** to your project:
   ```bash
   cp doc/oidc/backend/*.py your-project/backend/
   ```

2. **Copy frontend files** to your project:
   ```bash
   cp doc/oidc/frontend/*.tsx your-project/frontend/src/app/login/
   ```

3. **Copy configuration**:
   ```bash
   cp doc/oidc/config/oidc_providers.yaml.example your-project/config/
   # Edit and rename to oidc_providers.yaml
   ```

4. **Install dependencies**:
   ```bash
   # Backend
   pip install httpx python-jose pyyaml

   # Frontend (if not already installed)
   npm install lucide-react
   ```

5. **Integrate into your app**:
   - Add OIDC router to FastAPI app
   - Add login/callback routes to Next.js routing
   - Configure providers in YAML file

### Option 2: Adapt to Different Framework

If using a different tech stack:

1. **Read the implementation guide**: `../../OIDC_IMPLEMENTATION_GUIDE.md`

2. **Study the reference files**:
   - Backend logic: `backend/oidc_service.py`
   - API design: `backend/oidc.py`
   - Frontend flow: `frontend/login-page.tsx` and `frontend/callback-page.tsx`

3. **Adapt patterns** to your framework:
   - Replace FastAPI with Express/Django/etc.
   - Replace React hooks with Vue/Angular/etc.
   - Adjust data validation to your system

4. **Follow the architecture** from the guide:
   - YAML-based configuration
   - Per-provider caching
   - State-based provider routing
   - Claim mapping support

### Option 3: Give to AI Agent

Provide these files and the main implementation guide to an AI coding assistant:

```
I want to implement the same OIDC multi-provider authentication in my app.

Tech stack:
- Backend: [your framework]
- Frontend: [your framework]
- Database: [your database]

Please analyze these reference files in doc/oidc/ and OIDC_IMPLEMENTATION_GUIDE.md,
then implement the same system adapted to my tech stack.

Start with the configuration system, then backend service, then frontend.
```

## Integration Checklist

When integrating into your application:

### Backend Integration

- [ ] Copy/adapt OIDC service files
- [ ] Install required dependencies
- [ ] Add OIDC router to your API app
- [ ] Create `config/oidc_providers.yaml`
- [ ] Add user management integration
- [ ] Test OIDC endpoints

### Frontend Integration

- [ ] Copy/adapt login page component
- [ ] Copy/adapt callback handler component
- [ ] Add routes for `/login` and `/login/callback`
- [ ] Integrate with your auth state management
- [ ] Add provider selection UI to login page
- [ ] Test full authentication flow

### Configuration

- [ ] Configure at least one OIDC provider
- [ ] Set up provider in Keycloak/Azure AD/Okta
- [ ] Test discovery endpoint accessibility
- [ ] Configure claim mappings
- [ ] Set auto-provisioning rules
- [ ] (Optional) Add custom CA certificate for self-signed certs

### Testing

- [ ] Test provider list endpoint
- [ ] Test login initiation
- [ ] Test callback handling
- [ ] Test token verification
- [ ] Test user provisioning
- [ ] Test with multiple providers
- [ ] Test error scenarios

## Key Differences from Standard OIDC

This implementation has unique features:

1. **Multi-Provider Support**: Single application, multiple identity providers
2. **Provider-Specific Caching**: Separate cache per provider (configs, JWKS, SSL contexts)
3. **State-Based Routing**: Provider ID embedded in OAuth state parameter
4. **Custom CA Certificates**: Per-provider SSL certificate support for air-gapped environments
5. **Flexible Claim Mapping**: Each provider can use different claim names
6. **Conditional Auto-Provisioning**: Per-provider provisioning rules
7. **Dual Authentication Modes**: SSO-only or SSO + traditional login

## Dependencies

### Backend (Python)
```txt
httpx>=0.24.0          # Async HTTP client
python-jose[cryptography]>=3.3.0  # JWT handling
pyyaml>=6.0            # YAML parsing
fastapi>=0.100.0       # Web framework (optional, can use others)
pydantic>=2.0.0        # Data validation
```

### Frontend (JavaScript/TypeScript)
```json
{
  "dependencies": {
    "react": "^18.0.0",
    "next": "^14.0.0",
    "lucide-react": "^0.263.0"
  }
}
```

## Support

For questions or issues:

1. **Read the implementation guide**: `../../OIDC_IMPLEMENTATION_GUIDE.md`
2. **Check examples**: Review files in `examples/` directory
3. **Study reference code**: Examine backend and frontend files
4. **Check configuration**: Review `config/oidc_providers.yaml.example`

## License

These files are provided as reference implementation examples. Adapt freely to your needs.

## Version

These files are current as of the OIDC refactoring that made configuration **YAML-only** (no config.py dependencies).

All hardcoded defaults are documented in `config/oidc_providers.yaml.example`.
