# OIDC Multi-Provider Implementation Guide

This document provides a complete guide for implementing the same multi-provider OIDC authentication system in other applications.

## 📁 Reference Implementation Files

**All necessary implementation files are available in the `doc/oidc/` directory:**

```
doc/oidc/
├── README.md                    # Detailed file descriptions and usage instructions
├── backend/                     # Complete Python/FastAPI implementation
│   ├── oidc_service.py         # Core OIDC service with SSL support
│   ├── oidc.py                 # API router with all endpoints
│   ├── auth.py                 # Pydantic models
│   └── settings_manager.py     # YAML configuration loader
├── frontend/                    # React/Next.js components
│   ├── login-page.tsx          # Login page with provider selection
│   └── callback-page.tsx       # OAuth callback handler
├── config/                      # Configuration files
│   ├── oidc_providers.yaml     # Active configuration example
│   └── oidc_providers.yaml.example  # Comprehensive example with docs
└── examples/                    # Documentation
    ├── OIDC_SETUP.md           # User-facing setup guide
    └── OIDC_QUICKSTART.md      # Quick start guide
```

**See `doc/oidc/README.md` for:**
- Detailed file descriptions
- Integration instructions
- Dependencies list
- Copy/adaptation guide

## Quick Start

### For Same Tech Stack (Python/FastAPI + Next.js/React)

```bash
# 1. Copy all files
cp -r doc/oidc/backend/* your-app/backend/
cp -r doc/oidc/frontend/* your-app/frontend/src/app/login/
cp doc/oidc/config/oidc_providers.yaml.example your-app/config/

# 2. Install dependencies
pip install httpx python-jose[cryptography] pyyaml
npm install lucide-react

# 3. Configure
cd your-app/config
cp oidc_providers.yaml.example oidc_providers.yaml
# Edit oidc_providers.yaml with your provider details

# 4. Integrate and test
```

### For Different Tech Stack

Give this guide and the `doc/oidc/` directory to an AI agent:

```
I want to implement multi-provider OIDC authentication as described in:
- OIDC_IMPLEMENTATION_GUIDE.md (this guide)
- doc/oidc/README.md (reference files)

Study the reference implementation in doc/oidc/ directory.

My tech stack:
- Backend: [Express/Django/etc.]
- Frontend: [Vue/Angular/etc.]

Please adapt the implementation to my stack while maintaining:
- Multi-provider support
- YAML-only configuration
- Custom CA certificate support
- Per-provider caching
- State-based routing
```

## Architecture Overview

### Core Features

This OIDC implementation has unique features not found in standard single-provider setups:

✅ **Multi-Provider Support**: Single application, multiple identity providers
✅ **YAML-Only Configuration**: No config.py or environment variable dependencies for OIDC
✅ **Custom CA Certificates**: Per-provider SSL certificate support for air-gapped environments
✅ **Per-Provider Caching**: Separate cache for configs, JWKS, and SSL contexts
✅ **State-Based Routing**: Provider ID embedded in OAuth state parameter
✅ **Flexible Claim Mapping**: Each provider can use different claim names
✅ **Auto-Provisioning**: Configurable per-provider user creation rules
✅ **Dual Auth Modes**: SSO-only or SSO + traditional login

### Configuration Structure (YAML-Only)

**Mandatory fields per provider:**
- `enabled`: true/false
- `discovery_url`: OIDC discovery endpoint
- `client_id`: OAuth client ID
- `client_secret`: OAuth client secret
- `redirect_uri`: OAuth callback URL

**Optional fields with defaults:**
- `name`: Display name (default: provider_id)
- `description`: Help text (default: "")
- `icon`: Icon name (default: "")
- `display_order`: Sort order (default: 999)
- `ca_cert_path`: Custom CA cert path (default: null)
- `scopes`: OAuth scopes (default: ["openid", "profile", "email"])
- `claim_mappings.username`: Username claim (default: "preferred_username")
- `claim_mappings.email`: Email claim (default: "email")
- `claim_mappings.name`: Name claim (default: "name")
- `auto_provision`: Auto-create users (default: true)
- `default_role`: New user role (default: "user")
- `username_prefix`: Username prefix (default: "")

See `doc/oidc/config/oidc_providers.yaml.example` for complete documentation.

### Component Flow

```
User → Login Page (fetches providers) → Provider Button Click
  ↓
Backend /auth/oidc/{provider_id}/login
  ↓ (returns authorization URL with state)
User redirected to OIDC Provider
  ↓
Provider authenticates user
  ↓ (redirects back with code + state)
Callback Handler (extracts provider_id from state)
  ↓
Backend /auth/oidc/{provider_id}/callback
  ├─ Exchange code for tokens (with SSL support)
  ├─ Verify ID token
  ├─ Extract user data (with provider-specific claims)
  ├─ Provision/get user
  └─ Return JWT
    ↓
Frontend stores token → Redirect to app
```

## Implementation Guide

### Phase 1: Configuration

**Reference**: `doc/oidc/config/oidc_providers.yaml.example`

1. Create `config/oidc_providers.yaml`
2. Define at least one provider with all mandatory fields
3. (Optional) Add custom CA certificate path for self-signed certs
4. (Optional) Customize claim mappings and auto-provisioning

### Phase 2: Backend Service

**Reference**: `doc/oidc/backend/oidc_service.py`

Key methods to implement:
- `get_oidc_config(provider_id)` - Fetch/cache discovery config with SSL support
- `exchange_code_for_tokens(provider_id, code)` - Exchange code for tokens
- `verify_id_token(provider_id, id_token)` - Verify JWT
- `extract_user_data(provider_id, claims)` - Extract user data with claim mappings
- `provision_or_get_user(provider_id, user_data)` - Auto-provision users

**Critical features:**
- Per-provider SSL context for custom CA certificates
- Per-provider caching (configs, JWKS, SSL contexts)
- Required field validation with clear error messages
- No fallbacks to config.py (YAML-only)

### Phase 3: API Endpoints

**Reference**: `doc/oidc/backend/oidc.py`

Endpoints to implement:
- `GET /auth/oidc/providers` - List enabled providers
- `GET /auth/oidc/{provider_id}/login` - Initiate login (returns auth URL + state)
- `POST /auth/oidc/{provider_id}/callback` - Handle callback (exchanges code for JWT)
- `POST /auth/oidc/{provider_id}/logout` - Handle logout (optional)

**Critical features:**
- State parameter includes provider_id: `"provider_id:random_token"`
- State validation in callback
- Provider-specific error messages

### Phase 4: Frontend

**Reference**:
- `doc/oidc/frontend/login-page.tsx` - Login UI
- `doc/oidc/frontend/callback-page.tsx` - Callback handler

**Login Page:**
- Fetch providers from `/auth/oidc/providers`
- Display provider buttons (with icons/descriptions)
- Store OAuth state in sessionStorage
- Redirect to provider authorization URL

**Callback Handler:**
- Extract code and state from URL
- Validate state parameter
- Extract provider_id from state
- Call `/auth/oidc/{provider_id}/callback`
- Store token and redirect

### Phase 5: Testing

Use the testing checklist below to verify each component.

## Key Code Patterns

### Pattern 1: YAML-Only Configuration (No Fallbacks)

```python
# ❌ OLD WAY (with config.py fallbacks)
client_id = provider_config.get("client_id", settings.oidc_client_id)

# ✅ NEW WAY (YAML-only with validation)
client_id = provider_config.get("client_id")
if not client_id:
    raise HTTPException(
        status_code=500,
        detail=f"Provider '{provider_id}' missing required 'client_id'"
    )

# ✅ Optional fields with hardcoded defaults
scopes = provider_config.get("scopes", ["openid", "profile", "email"])
username_claim = claim_mappings.get("username", "preferred_username")
```

### Pattern 2: Per-Provider SSL Context

```python
def _get_ssl_context(self, provider_id: str) -> Optional[ssl.SSLContext]:
    """Get cached SSL context with custom CA certificate."""
    if provider_id in self._ssl_contexts:
        return self._ssl_contexts[provider_id]

    provider = settings_manager.get_oidc_provider(provider_id)
    ca_cert_path = provider.get("ca_cert_path")

    if not ca_cert_path:
        return None

    # Resolve path and load certificate
    ca_cert_file = Path(ca_cert_path)
    if not ca_cert_file.is_absolute():
        ca_cert_file = Path(__file__).parent.parent / ca_cert_path

    if not ca_cert_file.exists():
        logger.warning(f"CA cert not found: {ca_cert_file}")
        return None

    # Create and cache SSL context
    ssl_context = ssl.create_default_context()
    ssl_context.load_verify_locations(cafile=str(ca_cert_file))
    self._ssl_contexts[provider_id] = ssl_context

    return ssl_context

# Use SSL context in HTTP requests
async def get_oidc_config(self, provider_id: str):
    ssl_context = self._get_ssl_context(provider_id)

    client_kwargs = {"timeout": 10.0}
    if ssl_context:
        client_kwargs["verify"] = ssl_context

    async with httpx.AsyncClient(**client_kwargs) as client:
        response = await client.get(provider['discovery_url'])
        return response.json()
```

### Pattern 3: State-Based Provider Routing

```python
# Backend: Generate state with provider ID
state = secrets.token_urlsafe(32)
state_with_provider = f"{provider_id}:{state}"

# Backend: Validate state in callback
if callback_data.state:
    state_provider, _ = callback_data.state.split(":", 1)
    if state_provider != provider_id:
        raise HTTPException(status_code=400, detail="Provider mismatch")

# Frontend: Store state
sessionStorage.setItem('oidc_state', data.state)

# Frontend: Extract provider ID from state
const [providerId] = state.split(":", 2)
```

### Pattern 4: Provider-Specific Claim Mapping

```python
def extract_user_data(self, provider_id: str, claims: Dict):
    provider = settings_manager.get_oidc_provider(provider_id)
    mappings = provider.get("claim_mappings", {})

    # Use provider-specific claim names with defaults
    username_claim = mappings.get("username", "preferred_username")
    email_claim = mappings.get("email", "email")
    name_claim = mappings.get("name", "name")

    username = claims.get(username_claim)
    if not username:
        raise HTTPException(
            status_code=401,
            detail=f"Username claim '{username_claim}' not found in token"
        )

    return {
        "username": username,
        "email": claims.get(email_claim),
        "realname": claims.get(name_claim, username),
        "provider_id": provider_id
    }
```

## Testing Checklist

### Configuration
- [ ] YAML file loads successfully
- [ ] Multiple providers parsed correctly
- [ ] Mandatory fields validated
- [ ] CA certificate paths resolved correctly

### Backend Service
- [ ] Discovery endpoint fetched with SSL support
- [ ] Per-provider configs cached
- [ ] Per-provider SSL contexts cached
- [ ] Custom CA certificates work for HTTPS
- [ ] JWKS fetched and cached per provider
- [ ] Token exchange successful
- [ ] ID token verification works
- [ ] Claim extraction uses provider mappings
- [ ] Auto-provisioning creates users when enabled
- [ ] Auto-provisioning blocked when disabled
- [ ] Missing required fields raise clear errors

### API Endpoints
- [ ] `/auth/oidc/providers` returns enabled providers only
- [ ] `/auth/oidc/{id}/login` generates correct auth URL
- [ ] State includes provider ID
- [ ] `/auth/oidc/{id}/callback` exchanges code for JWT
- [ ] State validation prevents CSRF
- [ ] Invalid provider returns 404
- [ ] Disabled provider returns 403

### Frontend
- [ ] Providers fetched on login page load
- [ ] Provider buttons displayed correctly
- [ ] State stored in sessionStorage
- [ ] Redirect to provider works
- [ ] Callback extracts provider ID from state
- [ ] Token stored on success
- [ ] App redirected after auth

### Integration
- [ ] Complete flow with Provider A
- [ ] Complete flow with Provider B
- [ ] Multiple providers work simultaneously
- [ ] User auto-provisioned on first login
- [ ] State mismatch rejected
- [ ] Invalid code rejected

### Security
- [ ] CSRF protection (state validation)
- [ ] Token signature verified
- [ ] Issuer validated
- [ ] Audience validated
- [ ] Token expiration checked
- [ ] Client secret never exposed to frontend
- [ ] SSL certificates validated

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Provider not found" | Check `enabled: true` in YAML, verify provider_id matches exactly |
| "Discovery endpoint failed" | Test URL in browser, check network/firewall, verify /.well-known/openid-configuration path |
| "SSL: CERTIFICATE_VERIFY_FAILED" | Add `ca_cert_path` to provider config, ensure cert is in PEM format |
| "Missing required field" | OIDC config is YAML-only now - ensure all mandatory fields are in oidc_providers.yaml |
| "Token verification failed" | Check client_id matches, verify JWKS accessible, ensure clock sync |
| "User not provisioned" | Check `auto_provision: true`, verify claim mappings extract username |
| "State mismatch" | Verify state stored in sessionStorage, check format: `provider_id:token` |

## Framework Adaptations

### Express.js (Node.js)
- Replace: FastAPI → Express, Pydantic → Zod, httpx → axios, python-jose → jsonwebtoken, PyYAML → js-yaml
- SSL Support: Use `https.Agent` with custom CA certificate

### Django
- Replace: FastAPI → Django views with DRF, async → sync or async views (Django 4.1+)
- SSL Support: Use `requests` with `verify` parameter

### Vue.js/Nuxt.js
- Replace: React hooks → Vue composition API, useRouter → Vue Router
- sessionStorage: Same (browser API)

See `doc/oidc/README.md` for detailed framework examples.

## Summary

### What You Get

1. **Complete Reference Implementation**: All files in `doc/oidc/`
2. **YAML-Only Configuration**: No environment variable dependencies
3. **Multi-Provider Support**: Single app, multiple identity providers
4. **Custom CA Certificates**: Air-gapped environment support
5. **Comprehensive Documentation**: Setup guides, examples, troubleshooting

### Implementation Options

| Option | Best For | Time Estimate |
|--------|----------|---------------|
| **Copy Files** | Same tech stack (Python/FastAPI + Next.js/React) | 2-4 hours |
| **AI-Guided** | Different tech stack, want AI assistance | 4-8 hours |
| **Manual** | Learning, highly customized requirements | 1-2 days |

### Next Steps

1. Read `doc/oidc/README.md` for detailed file descriptions
2. Choose your implementation option
3. Copy/adapt reference files
4. Configure providers in YAML
5. Test using the checklist above

For questions or issues, refer to:
- `doc/oidc/README.md` - File usage and integration guide
- `doc/oidc/examples/OIDC_SETUP.md` - User setup guide
- Reference implementation in `doc/oidc/backend/` and `doc/oidc/frontend/`
