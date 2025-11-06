# OIDC Multi-Provider Implementation Guide

This document provides a complete guide for implementing the same multi-provider OIDC authentication system in other applications. It can be given to an AI agent or developer to replicate the exact architecture.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Implementation Approaches](#implementation-approaches)
3. [Step-by-Step Implementation](#step-by-step-implementation)
4. [Code Patterns and Examples](#code-patterns-and-examples)
5. [Testing Checklist](#testing-checklist)

---

## Architecture Overview

### Core Concepts

This OIDC implementation supports **multiple identity providers** with these key features:

- **YAML-based configuration**: `config/oidc_providers.yaml` defines multiple providers
- **Provider selection UI**: Users choose which provider to use at login
- **Per-provider settings**: Each provider has its own credentials, claim mappings, and auto-provisioning rules
- **State-based routing**: Provider ID embedded in OAuth state parameter for callback handling
- **Flexible modes**: Supports SSO-only mode or dual authentication (SSO + traditional login)

### Tech Stack Requirements

**Backend:**
- Python 3.8+ with FastAPI (or similar async web framework)
- Libraries: `httpx` (HTTP client), `python-jose` (JWT handling), `pyyaml` (YAML parsing)
- Database: Any (SQLite, PostgreSQL, etc.) for user management

**Frontend:**
- React/Next.js or similar (TypeScript recommended)
- Fetch API for backend communication
- Session storage for OAuth state management

### Architecture Components

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend (Next.js)                       │
├─────────────────────────────────────────────────────────────────┤
│  Login Page                                                      │
│  ├─ Fetch providers from /auth/oidc/providers                   │
│  ├─ Display provider selection buttons                          │
│  └─ Initiate login: /auth/oidc/{provider_id}/login             │
│                                                                  │
│  Callback Handler                                               │
│  ├─ Extract provider_id from state parameter                   │
│  ├─ Exchange code: POST /auth/oidc/{provider_id}/callback      │
│  └─ Store JWT and redirect to app                              │
└─────────────────────────────────────────────────────────────────┘
                              ▼ API calls
┌─────────────────────────────────────────────────────────────────┐
│                      Backend (FastAPI)                           │
├─────────────────────────────────────────────────────────────────┤
│  Settings Manager                                                │
│  ├─ Load config/oidc_providers.yaml                            │
│  ├─ Parse and validate provider definitions                     │
│  └─ Methods: get_oidc_providers(), get_enabled_providers()     │
│                                                                  │
│  OIDC Service (Per-Provider)                                    │
│  ├─ Discovery: Fetch .well-known/openid-configuration          │
│  ├─ JWKS caching: Per-provider public key cache                │
│  ├─ Token exchange: Authorization code → tokens                │
│  ├─ Token verification: Validate and decode ID token           │
│  └─ User provisioning: Create/update users from claims         │
│                                                                  │
│  OIDC Router                                                     │
│  ├─ GET /auth/oidc/providers (list enabled)                    │
│  ├─ GET /auth/oidc/{provider_id}/login (initiate)              │
│  ├─ POST /auth/oidc/{provider_id}/callback (exchange)          │
│  └─ POST /auth/oidc/{provider_id}/logout (terminate)           │
└─────────────────────────────────────────────────────────────────┘
                              ▼ OIDC flow
┌─────────────────────────────────────────────────────────────────┐
│              Identity Providers (Keycloak, etc.)                 │
│  ├─ Provider 1: Corporate Keycloak                              │
│  ├─ Provider 2: Development Keycloak                            │
│  └─ Provider N: Partner IdP                                     │
└─────────────────────────────────────────────────────────────────┘
```

---

## Implementation Approaches

### Approach 1: AI-Guided Implementation (Recommended)

**Give this document to an AI agent with these instructions:**

```
I want to implement multi-provider OIDC authentication in my application 
exactly as described in OIDC_IMPLEMENTATION_GUIDE.md. My tech stack is:
- Backend: [your framework - FastAPI/Express/Django/etc.]
- Frontend: [your framework - Next.js/React/Vue/etc.]
- Database: [your database]

Please implement:
1. Configuration system (YAML-based)
2. Backend OIDC service with provider support
3. API endpoints for provider management
4. Frontend login page with provider selection
5. OAuth callback handler

Follow the architecture and code patterns in the guide exactly.
```

### Approach 2: Copy Reference Implementation

**Extract and adapt the following files from Cockpit:**

1. Copy entire OIDC implementation:
   ```bash
   # Backend files to copy
   backend/services/oidc_service.py
   backend/routers/oidc.py
   backend/models/auth.py (OIDC models only)
   
   # Configuration
   config/oidc_providers.yaml.example
   
   # Frontend
   frontend/src/app/login/page.tsx (provider selection UI)
   frontend/src/app/login/callback/page.tsx (callback handler)
   ```

2. Adapt to your tech stack:
   - Replace FastAPI decorators with your framework's routing
   - Replace Next.js components with your frontend framework
   - Adjust import paths and module structure

### Approach 3: Package as Reusable Library (Future)

For multiple applications, consider extracting to a library:
- **Backend**: Create `oidc-multi-provider-python` package
- **Frontend**: Create `oidc-provider-ui-react` NPM package
- **Benefit**: Single source of truth, easier updates

---

## Step-by-Step Implementation

### Phase 1: Configuration System

#### 1.1 Create YAML Configuration Structure

**File: `config/oidc_providers.yaml`**

```yaml
providers:
  provider_id:
    enabled: bool
    name: string
    description: string
    icon: string
    display_order: int
    discovery_url: string
    client_id: string
    client_secret: string
    scopes: list[string]
    claim_mappings:
      username: string
      email: string
      name: string
    auto_provisioning:
      enabled: bool
      default_role: string

global:
  allow_traditional_login: bool
```

#### 1.2 Settings Manager

Create a settings manager that:
- Loads `config/oidc_providers.yaml`
- Parses and validates YAML structure
- Provides methods:
  - `get_oidc_providers()` → Dict[str, Dict]
  - `get_enabled_oidc_providers()` → List[Dict]
  - `get_oidc_provider(provider_id)` → Dict | None
  - `is_oidc_enabled()` → bool

**Python Example:**
```python
import yaml
from typing import Dict, List, Optional

class SettingsManager:
    def load_oidc_providers(self) -> Dict:
        with open('config/oidc_providers.yaml') as f:
            return yaml.safe_load(f)
    
    def get_enabled_oidc_providers(self) -> List[Dict]:
        config = self.load_oidc_providers()
        providers = []
        for pid, cfg in config.get('providers', {}).items():
            if cfg.get('enabled', False):
                cfg['provider_id'] = pid
                providers.append(cfg)
        return sorted(providers, key=lambda p: p.get('display_order', 999))
```

### Phase 2: Backend OIDC Service

#### 2.1 OIDC Service Class

Create a service class with **per-provider** support:

**Key Methods:**

```python
class OIDCService:
    def __init__(self):
        # Per-provider caches
        self._configs: Dict[str, OIDCConfig] = {}
        self._jwks_caches: Dict[str, Dict] = {}
        self._jwks_cache_times: Dict[str, datetime] = {}
    
    async def get_oidc_config(self, provider_id: str) -> OIDCConfig:
        """Fetch OpenID Connect discovery configuration"""
        # 1. Get provider config from settings manager
        # 2. Check cache for this provider_id
        # 3. If not cached, fetch from discovery_url
        # 4. Cache and return
    
    async def exchange_code_for_tokens(self, provider_id: str, code: str) -> Dict:
        """Exchange authorization code for tokens"""
        # 1. Get provider config
        # 2. Get OIDC config (endpoints)
        # 3. POST to token_endpoint with code
        # 4. Return tokens (access_token, id_token, refresh_token)
    
    async def verify_id_token(self, provider_id: str, id_token: str) -> Dict:
        """Verify and decode ID token using JWKS"""
        # 1. Get JWKS for this provider
        # 2. Extract kid from token header
        # 3. Find matching key in JWKS
        # 4. Verify signature, issuer, audience
        # 5. Return claims
    
    def extract_user_data(self, provider_id: str, claims: Dict) -> Dict:
        """Extract user data using provider-specific claim mappings"""
        # 1. Get provider config
        # 2. Get claim_mappings
        # 3. Extract username, email, name from claims
        # 4. Return normalized user data
    
    async def provision_or_get_user(self, provider_id: str, user_data: Dict) -> Dict:
        """Auto-provision or retrieve existing user"""
        # 1. Check if user exists by username
        # 2. If exists, update email/name if changed
        # 3. If not exists and auto_provision enabled, create user
        # 4. Return user object
```

#### 2.2 Critical Implementation Details

**Discovery Configuration:**
```python
async def get_oidc_config(self, provider_id: str):
    provider = settings_manager.get_oidc_provider(provider_id)
    if not provider or not provider.get('enabled'):
        raise ProviderNotFoundError()
    
    if provider_id in self._configs:
        return self._configs[provider_id]
    
    async with httpx.AsyncClient() as client:
        response = await client.get(provider['discovery_url'])
        config_data = response.json()
    
    self._configs[provider_id] = OIDCConfig(**config_data)
    return self._configs[provider_id]
```

**Token Verification:**
```python
async def verify_id_token(self, provider_id: str, id_token: str):
    config = await self.get_oidc_config(provider_id)
    jwks = await self.get_jwks(provider_id)
    provider = settings_manager.get_oidc_provider(provider_id)
    
    # Decode header to get kid
    header = jwt.get_unverified_header(id_token)
    kid = header.get('kid')
    
    # Find matching key
    key = next((k for k in jwks['keys'] if k['kid'] == kid), None)
    
    # Verify and decode
    claims = jwt.decode(
        id_token,
        key,
        algorithms=['RS256', 'RS384', 'RS512'],
        audience=provider['client_id'],
        issuer=config.issuer
    )
    return claims
```

### Phase 3: API Endpoints

#### 3.1 Provider List Endpoint

```
GET /auth/oidc/providers
Response: {
  "providers": [
    {
      "provider_id": "corporate",
      "name": "Corporate SSO",
      "description": "Sign in with company account",
      "icon": "building",
      "display_order": 1
    }
  ],
  "allow_traditional_login": true
}
```

#### 3.2 Login Initiation Endpoint

```
GET /auth/oidc/{provider_id}/login
Response: {
  "authorization_url": "https://keycloak.com/auth?client_id=...",
  "state": "corporate:random_state_token",
  "provider_id": "corporate"
}
```

**Implementation:**
```python
@router.get("/{provider_id}/login")
async def oidc_login(provider_id: str):
    config = await oidc_service.get_oidc_config(provider_id)
    state = oidc_service.generate_state()
    
    # Include provider_id in state for callback validation
    state_with_provider = f"{provider_id}:{state}"
    
    auth_url = oidc_service.generate_authorization_url(
        provider_id, config, state_with_provider
    )
    
    return {
        "authorization_url": auth_url,
        "state": state_with_provider,
        "provider_id": provider_id
    }
```

#### 3.3 Callback Endpoint

```
POST /auth/oidc/{provider_id}/callback
Body: {
  "code": "auth_code_from_provider",
  "state": "corporate:random_state_token"
}
Response: {
  "access_token": "jwt_token",
  "token_type": "bearer",
  "expires_in": 3600,
  "user": { ... }
}
```

**Implementation:**
```python
@router.post("/{provider_id}/callback")
async def oidc_callback(provider_id: str, callback_data: OIDCCallbackRequest):
    # Validate state includes correct provider_id
    if callback_data.state:
        state_provider, _ = callback_data.state.split(':', 1)
        if state_provider != provider_id:
            raise ValueError("State provider mismatch")
    
    # Exchange code for tokens
    tokens = await oidc_service.exchange_code_for_tokens(
        provider_id, callback_data.code
    )
    
    # Verify ID token
    claims = await oidc_service.verify_id_token(
        provider_id, tokens['id_token']
    )
    
    # Extract user data
    user_data = oidc_service.extract_user_data(provider_id, claims)
    
    # Provision or get user
    user = await oidc_service.provision_or_get_user(provider_id, user_data)
    
    # Create application JWT
    access_token = create_access_token(user)
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "expires_in": 3600,
        "user": user
    }
```

### Phase 4: Frontend Implementation

#### 4.1 Login Page Component

**Requirements:**
- Fetch providers from API on mount
- Display provider selection buttons
- Handle provider-specific login initiation
- Support two modes: dual (SSO + password) or SSO-only

**React/Next.js Example:**

```typescript
'use client'

import { useState, useEffect } from 'react'

interface OIDCProvider {
  provider_id: string
  name: string
  description?: string
  icon?: string
  display_order: number
}

export default function LoginPage() {
  const [providers, setProviders] = useState<OIDCProvider[]>([])
  const [allowTraditional, setAllowTraditional] = useState(true)
  const [loadingProvider, setLoadingProvider] = useState<string | null>(null)
  
  // Fetch providers on mount
  useEffect(() => {
    fetch('/api/auth/oidc/providers')
      .then(res => res.json())
      .then(data => {
        setProviders(data.providers || [])
        setAllowTraditional(data.allow_traditional_login)
      })
  }, [])
  
  // Handle provider login
  const handleProviderLogin = async (providerId: string) => {
    setLoadingProvider(providerId)
    
    try {
      const response = await fetch(`/api/auth/oidc/${providerId}/login`)
      const data = await response.json()
      
      if (data.state) {
        sessionStorage.setItem('oidc_state', data.state)
        sessionStorage.setItem('oidc_provider_id', data.provider_id)
      }
      
      // Redirect to OIDC provider
      window.location.href = data.authorization_url
    } catch (error) {
      console.error('OIDC login failed:', error)
      setLoadingProvider(null)
    }
  }
  
  return (
    <div>
      {/* Traditional login form (if allowed) */}
      {allowTraditional && <LoginForm />}
      
      {/* Provider selection */}
      {providers.length > 0 && (
        <div>
          {allowTraditional && <div>Or sign in with</div>}
          
          {providers.map(provider => (
            <button
              key={provider.provider_id}
              onClick={() => handleProviderLogin(provider.provider_id)}
              disabled={loadingProvider !== null}
            >
              {loadingProvider === provider.provider_id ? (
                <Spinner />
              ) : (
                <>
                  <Icon name={provider.icon} />
                  <div>
                    <div>{provider.name}</div>
                    {provider.description && <div>{provider.description}</div>}
                  </div>
                </>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
```

#### 4.2 Callback Handler Component

**Requirements:**
- Extract provider_id from state parameter
- Call provider-specific callback endpoint
- Handle errors with provider context

```typescript
'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

export default function OIDCCallbackPage() {
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing')
  const [error, setError] = useState('')
  const router = useRouter()
  const searchParams = useSearchParams()
  
  useEffect(() => {
    const handleCallback = async () => {
      try {
        const code = searchParams.get('code')
        const state = searchParams.get('state')
        
        if (!code) throw new Error('No authorization code')
        
        // Validate state
        const storedState = sessionStorage.getItem('oidc_state')
        if (storedState && state !== storedState) {
          throw new Error('Invalid state parameter')
        }
        
        // Extract provider_id from state (format: "provider_id:random")
        let providerId = 'default'
        if (state?.includes(':')) {
          [providerId] = state.split(':', 2)
        } else {
          providerId = sessionStorage.getItem('oidc_provider_id') || 'default'
        }
        
        // Clear session storage
        sessionStorage.removeItem('oidc_state')
        sessionStorage.removeItem('oidc_provider_id')
        
        // Exchange code for tokens
        const response = await fetch(`/api/auth/oidc/${providerId}/callback`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code, state })
        })
        
        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.detail || 'Authentication failed')
        }
        
        const data = await response.json()
        
        // Store token and user
        if (data.access_token) {
          // Store in your auth system (localStorage, cookies, zustand, etc.)
          storeAuth(data.access_token, data.user)
          setStatus('success')
          setTimeout(() => router.push('/'), 1000)
        }
      } catch (err) {
        setError(err.message)
        setStatus('error')
      }
    }
    
    handleCallback()
  }, [searchParams, router])
  
  return (
    <div>
      {status === 'processing' && <div>Authenticating...</div>}
      {status === 'success' && <div>Success! Redirecting...</div>}
      {status === 'error' && <div>Error: {error}</div>}
    </div>
  )
}
```

### Phase 5: Data Models

#### 5.1 Backend Models

```python
from pydantic import BaseModel
from typing import Optional, List

class OIDCProvider(BaseModel):
    provider_id: str
    name: str
    description: Optional[str] = None
    icon: Optional[str] = None
    display_order: int = 999

class OIDCProvidersResponse(BaseModel):
    providers: List[OIDCProvider]
    allow_traditional_login: bool = True

class OIDCCallbackRequest(BaseModel):
    code: str
    state: Optional[str] = None

class LoginResponse(BaseModel):
    access_token: str
    token_type: str
    expires_in: int
    user: dict
    oidc_provider: Optional[str] = None
```

---

## Code Patterns and Examples

### Pattern 1: State Parameter with Provider ID

**Why:** OAuth state parameter prevents CSRF attacks. We embed provider_id for callback routing.

**Format:** `"{provider_id}:{random_token}"`

**Example:** `"corporate:a7f2e9c1b3d5..."`

**Backend (Login):**
```python
state = secrets.token_urlsafe(32)
state_with_provider = f"{provider_id}:{state}"
```

**Backend (Callback):**
```python
if state:
    state_provider, state_token = state.split(':', 1)
    if state_provider != provider_id:
        raise ValueError("Provider mismatch")
```

**Frontend (Store):**
```javascript
sessionStorage.setItem('oidc_state', data.state)
sessionStorage.setItem('oidc_provider_id', providerId)
```

**Frontend (Validate):**
```javascript
const [providerId] = state.split(':', 2)
```

### Pattern 2: Per-Provider Configuration Cache

**Why:** Avoid repeated discovery endpoint calls. Cache per provider.

```python
class OIDCService:
    def __init__(self):
        self._configs: Dict[str, OIDCConfig] = {}
        self._jwks_caches: Dict[str, Dict] = {}
        self._jwks_cache_times: Dict[str, datetime] = {}
    
    async def get_oidc_config(self, provider_id: str):
        if provider_id in self._configs:
            return self._configs[provider_id]
        
        # Fetch and cache
        config = await fetch_discovery(provider_id)
        self._configs[provider_id] = config
        return config
```

### Pattern 3: Provider-Specific Claim Mapping

**Why:** Different providers may use different claim names.

```python
def extract_user_data(self, provider_id: str, claims: Dict):
    provider = settings_manager.get_oidc_provider(provider_id)
    mappings = provider.get('claim_mappings', {})
    
    username_claim = mappings.get('username', 'preferred_username')
    email_claim = mappings.get('email', 'email')
    name_claim = mappings.get('name', 'name')
    
    return {
        'username': claims.get(username_claim),
        'email': claims.get(email_claim),
        'realname': claims.get(name_claim),
        'provider_id': provider_id
    }
```

### Pattern 4: Conditional Login UI

**Why:** Support SSO-only mode or dual authentication.

```typescript
// SSO-only mode
if (!allowTraditionalLogin && providers.length > 0) {
  return <ProviderSelectionOnly providers={providers} />
}

// Dual mode
return (
  <>
    <TraditionalLoginForm />
    {providers.length > 0 && (
      <>
        <Divider text="Or sign in with" />
        <ProviderButtons providers={providers} />
      </>
    )}
  </>
)
```

---

## Testing Checklist

### Backend Tests

- [ ] YAML configuration loading
  - [ ] Valid YAML loads successfully
  - [ ] Invalid YAML returns error
  - [ ] Missing file returns default/empty config
  - [ ] Multiple providers parsed correctly

- [ ] Settings Manager
  - [ ] `get_oidc_providers()` returns all providers
  - [ ] `get_enabled_oidc_providers()` filters by enabled flag
  - [ ] `get_oidc_provider(id)` returns specific provider
  - [ ] Providers sorted by display_order

- [ ] OIDC Service
  - [ ] Discovery endpoint fetches config
  - [ ] Config cached per provider
  - [ ] JWKS fetched and cached
  - [ ] Token exchange returns tokens
  - [ ] ID token verification succeeds with valid token
  - [ ] Claim extraction uses provider mappings
  - [ ] Auto-provisioning creates users when enabled
  - [ ] Auto-provisioning blocked when disabled

- [ ] API Endpoints
  - [ ] `/auth/oidc/providers` returns enabled providers
  - [ ] `/auth/oidc/{id}/login` generates auth URL
  - [ ] `/auth/oidc/{id}/callback` exchanges code
  - [ ] State validation prevents CSRF
  - [ ] Invalid provider_id returns 404
  - [ ] Disabled provider returns 403

### Frontend Tests

- [ ] Login Page
  - [ ] Fetches providers on mount
  - [ ] Displays provider buttons when available
  - [ ] Shows traditional form when allowed
  - [ ] Hides traditional form in SSO-only mode
  - [ ] Provider click initiates login
  - [ ] State stored in sessionStorage
  - [ ] Redirects to provider authorization URL

- [ ] Callback Handler
  - [ ] Extracts code and state from URL
  - [ ] Validates state parameter
  - [ ] Extracts provider_id from state
  - [ ] Calls correct provider callback endpoint
  - [ ] Stores token on success
  - [ ] Redirects to app on success
  - [ ] Shows error message on failure

### Integration Tests

- [ ] Complete login flow with Provider A
- [ ] Complete login flow with Provider B
- [ ] User auto-provisioned on first login
- [ ] User info updated on subsequent login
- [ ] State mismatch rejected
- [ ] Invalid code rejected
- [ ] Expired tokens rejected
- [ ] Multiple concurrent logins (different providers)

### Security Tests

- [ ] CSRF protection (state validation)
- [ ] Token signature verification
- [ ] Issuer validation
- [ ] Audience validation
- [ ] Token expiration checked
- [ ] Client secret not exposed to frontend
- [ ] HTTPS enforced in production

---

## Quick Reference: File Checklist

When implementing in a new application, create these files:

### Backend

- [ ] `config/oidc_providers.yaml` - Provider configuration
- [ ] `config/oidc_providers.yaml.example` - Example with documentation
- [ ] `backend/settings_manager.py` - YAML loader and provider manager
- [ ] `backend/services/oidc_service.py` - Core OIDC logic
- [ ] `backend/routers/oidc.py` - API endpoints
- [ ] `backend/models/auth.py` - Pydantic/data models

### Frontend

- [ ] `frontend/login/page.tsx` - Login page with provider selection
- [ ] `frontend/login/callback/page.tsx` - OAuth callback handler

### Documentation

- [ ] `OIDC_SETUP.md` - User-facing setup guide
- [ ] `config/README.md` - Configuration directory guide
- [ ] `.env.example` - Environment variable reference

---

## Framework-Specific Adaptations

### For Express.js (Node.js)

**Replace:**
- FastAPI → Express with async handlers
- Pydantic → TypeScript interfaces or Zod schemas
- httpx → axios or node-fetch
- python-jose → jsonwebtoken
- PyYAML → js-yaml

**Example:**
```typescript
import express from 'express'
import jwt from 'jsonwebtoken'
import yaml from 'js-yaml'
import axios from 'axios'

class OIDCService {
  async getOIDCConfig(providerId: string): Promise<OIDCConfig> {
    const provider = settingsManager.getOIDCProvider(providerId)
    const response = await axios.get(provider.discovery_url)
    return response.data
  }
}

router.get('/auth/oidc/:providerId/login', async (req, res) => {
  const { providerId } = req.params
  const config = await oidcService.getOIDCConfig(providerId)
  // ... rest of implementation
})
```

### For Django

**Replace:**
- FastAPI → Django views with DRF
- Settings manager → Django settings + custom loader
- Async methods → Sync or async views (Django 4.1+)

**Example:**
```python
from django.http import JsonResponse
from django.views import View

class OIDCProviderListView(View):
    def get(self, request):
        providers = settings_manager.get_enabled_oidc_providers()
        return JsonResponse({
            'providers': providers,
            'allow_traditional_login': True
        })
```

### For Vue.js/Nuxt.js

**Replace:**
- React hooks → Vue composition API
- useRouter → useRouter from vue-router
- sessionStorage → Same (browser API)

**Example:**
```vue
<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'

const providers = ref([])
const router = useRouter()

onMounted(async () => {
  const response = await fetch('/api/auth/oidc/providers')
  const data = await response.json()
  providers.value = data.providers
})

const handleProviderLogin = async (providerId) => {
  const response = await fetch(`/api/auth/oidc/${providerId}/login`)
  const data = await response.json()
  sessionStorage.setItem('oidc_state', data.state)
  window.location.href = data.authorization_url
}
</script>
```

---

## Troubleshooting Guide for Implementation

### Common Issues

**Issue: "Provider not found"**
- Check YAML syntax
- Verify provider_id matches exactly
- Ensure provider has `enabled: true`

**Issue: "Discovery endpoint failed"**
- Test URL in browser
- Check network/firewall
- Verify URL format (must end in `/.well-known/openid-configuration`)

**Issue: "Token verification failed"**
- Check client_id matches OIDC provider
- Verify JWKS endpoint accessible
- Ensure clock sync (token timestamps)

**Issue: "State parameter mismatch"**
- Verify state stored in sessionStorage
- Check state format: `provider_id:random_token`
- Ensure callback doesn't modify state

**Issue: "User not provisioned"**
- Check `auto_provisioning.enabled: true`
- Verify claim mappings extract username
- Check username claim exists in token

---

## Summary

This guide provides everything needed to replicate the multi-provider OIDC implementation:

1. **Architecture**: Component diagram and flow explanation
2. **Configuration**: YAML structure and settings manager
3. **Backend**: OIDC service with per-provider support
4. **API**: Endpoints for provider management and authentication
5. **Frontend**: Login UI and callback handler
6. **Patterns**: Reusable code patterns for common scenarios
7. **Testing**: Comprehensive test checklist
8. **Adaptations**: Framework-specific guidance

**Recommended Approach:**
Give this document to an AI agent with your tech stack details and ask it to implement each phase sequentially, testing as you go.
