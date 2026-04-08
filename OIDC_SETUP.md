# OIDC / SSO Setup Guide

Cockpit-NG supports OpenID Connect (OIDC) Single Sign-On with any compliant identity provider. Multiple providers can be configured simultaneously, and traditional username/password login can be kept active alongside SSO.

---

## How It Works

1. The user clicks an SSO button on the login page.
2. The browser is redirected to the identity provider.
3. After authentication the provider redirects back to `http(s)://{host}/login/callback`.
4. Cockpit-NG exchanges the authorization code for tokens, verifies the ID token, and issues its own JWT.
5. If `auto_provision` is enabled, new users are created automatically in an **inactive** state and must be approved by an admin before they can log in.

---

## Configuration File

The configuration lives at:

```
config/oidc_providers.yaml
```

This directory is mounted into all containers at `/app/config/`. Changes take effect after a container restart — no image rebuild required.

Copy the bundled example to get started:

```bash
cp config/oidc_providers.yaml.example config/oidc_providers.yaml
```

---

## File Structure

```yaml
providers:
  <provider-id>:         # Unique identifier, used in URLs and logs
    # Mandatory fields
    enabled: true
    discovery_url: "..."
    client_id: "..."
    client_secret: "..."
    redirect_uri: "..."

    # Optional fields (defaults shown)
    name: "<provider-id>"
    description: ""
    icon: ""
    display_order: 999
    ca_cert_path: null
    scopes: [openid, profile, email]
    claim_mappings:
      username: preferred_username
      email: email
      name: name
      groups: groups
    auto_provision: true
    default_role: user
    username_prefix: ""

global:
  allow_traditional_login: true
  session_timeout: 480          # minutes
  auto_redirect_single_provider: false
```

---

## Mandatory Fields

Every enabled provider must have these five fields:

| Field | Description |
|-------|-------------|
| `enabled` | `true` to activate, `false` to disable without removing config |
| `discovery_url` | OIDC discovery endpoint (`.well-known/openid-configuration`) |
| `client_id` | OAuth 2.0 client ID from your identity provider |
| `client_secret` | OAuth 2.0 client secret from your identity provider |
| `redirect_uri` | Callback URL — **must match the provider's registered redirect URI exactly** |

The `redirect_uri` is always:

```
http(s)://<frontend-host>:<port>/login/callback
```

Examples:
- Development: `http://localhost:3000/login/callback`
- Production: `https://cockpit.example.com/login/callback`

---

## Provider Examples

### Keycloak

```yaml
providers:
  corporate:
    enabled: true
    discovery_url: "https://keycloak.example.com/realms/production/.well-known/openid-configuration"
    client_id: "cockpit-ng"
    client_secret: "your-client-secret"
    redirect_uri: "https://cockpit.example.com/login/callback"
    name: "Corporate SSO"
    description: "Sign in with your company account"
    icon: "building"
    scopes:
      - openid
      - profile
      - email
      - offline_access
```

**Keycloak client setup:**
1. Create a new client with **Client authentication** enabled
2. Set **Valid redirect URIs** to `https://cockpit.example.com/login/callback`
3. Set **Valid post logout redirect URIs** to `https://cockpit.example.com`
4. Copy the **Client secret** from the Credentials tab

---

### Azure AD / Entra ID

```yaml
providers:
  azure:
    enabled: true
    discovery_url: "https://login.microsoftonline.com/<tenant-id>/v2.0/.well-known/openid-configuration"
    client_id: "your-azure-app-id"
    client_secret: "your-azure-client-secret"
    redirect_uri: "https://cockpit.example.com/login/callback"
    name: "Microsoft Account"
    icon: "building"
    scopes:
      - openid
      - profile
      - email
      - User.Read
    claim_mappings:
      username: preferred_username   # or "upn"
      email: email
      name: name
```

**Azure AD app registration:**
1. Register a new application in the Azure Portal
2. Add a **Web** redirect URI: `https://cockpit.example.com/login/callback`
3. Under **Certificates & secrets**, create a new client secret
4. Under **API permissions**, add `User.Read` (Microsoft Graph, delegated)

---

### Okta

```yaml
providers:
  okta:
    enabled: true
    discovery_url: "https://<your-domain>.okta.com/.well-known/openid-configuration"
    client_id: "your-okta-client-id"
    client_secret: "your-okta-client-secret"
    redirect_uri: "https://cockpit.example.com/login/callback"
    name: "Okta SSO"
    icon: "shield"
    scopes:
      - openid
      - profile
      - email
      - groups
    claim_mappings:
      username: preferred_username
      email: email
      name: name
      groups: groups
```

**Okta application setup:**
1. Create a new **OIDC Web Application**
2. Add `https://cockpit.example.com/login/callback` as a **Sign-in redirect URI**
3. Copy the **Client ID** and **Client Secret** from the app settings

---

## Optional Fields Reference

| Field | Default | Description |
|-------|---------|-------------|
| `name` | provider ID | Display name on the login button |
| `description` | `""` | Help text shown below the login button |
| `icon` | `""` | Icon on the login button (`building`, `flask`, `users`, `shield`, `key`, `globe`) |
| `display_order` | `999` | Sort order on the login page (lower = first) |
| `ca_cert_path` | `null` | Path to a PEM CA certificate for self-signed providers |
| `scopes` | `[openid, profile, email]` | OAuth 2.0 scopes to request |
| `claim_mappings.username` | `preferred_username` | Token claim to use as the Cockpit-NG username |
| `claim_mappings.email` | `email` | Token claim to use as the email address |
| `claim_mappings.name` | `name` | Token claim to use as the display name |
| `auto_provision` | `true` | Create users automatically on first login |
| `default_role` | `user` | Role assigned to auto-provisioned users (`user` or `admin`) |
| `username_prefix` | `""` | Prefix added to usernames to avoid conflicts across providers |

---

## Global Settings

```yaml
global:
  # Show the traditional username/password form alongside SSO buttons
  allow_traditional_login: true

  # OIDC session timeout in minutes (separate from JWT token expiry)
  session_timeout: 480

  # Skip the login page and redirect directly to the provider if only one is enabled
  auto_redirect_single_provider: false
```

---

## Self-Signed / Internal CA Certificates

If your identity provider uses a certificate signed by an internal CA:

1. Export the CA certificate in **PEM format** (text file starting with `-----BEGIN CERTIFICATE-----`).
2. Place it in `config/certs/`:
   ```bash
   cp your-ca.pem config/certs/corporate-ca.cert.pem
   ```
3. Reference it in the provider config:
   ```yaml
   ca_cert_path: "config/certs/corporate-ca.cert.pem"
   ```

If your certificate is in DER/CRT/CER format, use the included conversion script:

```bash
config/certs/convert-cert.sh your-ca.crt config/certs/corporate-ca.cert.pem
```

---

## User Provisioning

When `auto_provision: true` (the default):

- Users are **created automatically** on their first OIDC login.
- New accounts are set to **inactive** and cannot log in until an administrator approves them.
- The user receives a message: *"Your account has been created but requires administrator approval."*

**To approve a new user:**

1. Navigate to **Settings → User Management**.
2. Find the user (they will show as inactive).
3. Set **Active** to enabled and assign the appropriate roles.

When `auto_provision: false`, the user must already exist in the database before OIDC login will succeed.

---

## Multiple Providers

Multiple providers can be active at the same time. Each must have a unique provider ID. Use `username_prefix` to prevent username collisions:

```yaml
providers:
  corporate:
    enabled: true
    username_prefix: "corp_"
    # ...

  partners:
    enabled: true
    username_prefix: "ext_"
    # ...
```

---

## Applying Changes

After editing `config/oidc_providers.yaml`, restart the backend:

```bash
# Docker deployment
cd docker
docker compose restart cockpit-web

# Local development — restart the backend process
```

---

## Troubleshooting

### SSO button does not appear on the login page

- Verify `enabled: true` for the provider.
- Check backend logs: `docker compose logs cockpit-web`
- Confirm `config/oidc_providers.yaml` is present and valid YAML.

### "Invalid redirect_uri" error from the provider

The `redirect_uri` in `oidc_providers.yaml` must **exactly** match the value registered in the identity provider (scheme, host, port, and path).

### SSL / TLS certificate errors

Set `ca_cert_path` to the CA certificate in PEM format. Verify the file is readable inside the container:

```bash
docker compose exec cockpit-web ls /app/config/certs/
```

### "Account awaiting approval" after login

An admin must activate the account in **Settings → User Management**.

### Debug endpoint (admin only)

The API exposes a debug endpoint that validates the OIDC configuration for all enabled providers:

```bash
curl -H "Authorization: Bearer <admin-token>" \
  http://localhost:8000/auth/oidc/debug
```

The response lists each provider's endpoints, detected issues, and CA certificate status.

### Check which providers are active

```bash
curl http://localhost:8000/auth/oidc/providers
```
