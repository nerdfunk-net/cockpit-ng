# OIDC Quick Start Guide

Quick reference for setting up OIDC/SSO authentication with Keycloak.

## 1️⃣ Create Keycloak Client

In your Keycloak admin console:

1. Navigate to **Clients** → **Create Client**
2. **Client ID**: `cockpit` (or your preferred name)
3. **Client Protocol**: `openid-connect`
4. Click **Next**

### Client Settings

- **Client authentication**: `ON` (makes it confidential)
- **Authorization**: `OFF`
- **Authentication flow**: Enable only `Standard flow`
- **Valid redirect URIs**: `http://localhost:3000/login/callback`
- **Web origins**: `http://localhost:3000`

### Get Client Secret

1. Go to **Credentials** tab
2. Copy the **Client Secret**

## 2️⃣ Configure Backend

Edit `backend/.env`:

```bash
# Enable OIDC
OIDC_ENABLED=true

# Discovery URL (replace 'cockpit' with your realm name)
OIDC_DISCOVERY_URL=http://127.0.0.1:7080/realms/cockpit/.well-known/openid-configuration

# Client credentials (from Keycloak)
OIDC_CLIENT_ID=cockpit
OIDC_CLIENT_SECRET=your-client-secret-from-keycloak

# Redirect URI (must match Keycloak configuration)
OIDC_REDIRECT_URI=http://localhost:3000/login/callback

# Scopes
OIDC_SCOPES=openid,profile,email,offline_access

# Claim mapping (recommended for Keycloak)
OIDC_CLAIM_USERNAME=preferred_username
OIDC_CLAIM_EMAIL=email
OIDC_CLAIM_NAME=name

# Auto-create users on first login
OIDC_AUTO_PROVISION=true
```

## 3️⃣ Install Dependencies

```bash
cd backend
pip install -r requirements.txt
```

Required packages:
- `httpx` - Async HTTP client
- `python-jose[cryptography]` - JWT/OIDC token verification

## 4️⃣ Start Services

```bash
# Backend
cd backend
python start.py

# Frontend (separate terminal)
cd frontend
npm run dev
```

## 5️⃣ Test Login

1. Navigate to http://localhost:3000/login
2. You should see "Sign in with SSO" button
3. Click it and authenticate with Keycloak
4. You'll be redirected back and logged in

## 🔧 Troubleshooting

### Button doesn't appear
- Check `OIDC_ENABLED=true` in `.env`
- Restart backend server
- Check browser console for errors

### "Unable to connect to OIDC provider"
- Verify `OIDC_DISCOVERY_URL` is accessible
- Test in browser: Should return JSON configuration
- Check Keycloak is running on correct port

### "Invalid redirect URI"
- `OIDC_REDIRECT_URI` must match **exactly** what's in Keycloak
- Include protocol (http/https)
- Check for trailing slashes
- Verify port number

### "Client secret invalid"
- Copy secret from Keycloak Credentials tab
- Check for extra spaces in `.env` file
- Ensure client type is "confidential"

### "Username claim not found"
- Check backend logs for available claims
- Verify `OIDC_CLAIM_USERNAME=preferred_username`
- Try `OIDC_CLAIM_USERNAME=email` as alternative

### Enable debug logging
```bash
# In backend/.env
LOG_LEVEL=DEBUG
```

Then check logs for detailed information about:
- OIDC discovery
- Token exchange
- Available claims
- User provisioning

## 📊 Claim Reference

Common Keycloak claims:

| Claim | Use For | Example Value |
|-------|---------|---------------|
| `preferred_username` | **Username** (recommended) | `admin` |
| `email` | Email / Alt username | `admin@example.com` |
| `name` | Display name | `Admin User` |
| `given_name` | First name | `Admin` |
| `family_name` | Last name | `User` |
| `sub` | Unique user ID | `f:abc123:uuid` |

## 🔐 Production Checklist

- [ ] Use HTTPS for all URLs
- [ ] Change `OIDC_REDIRECT_URI` to production domain
- [ ] Update Keycloak Valid Redirect URIs
- [ ] Use strong `SECRET_KEY` in backend
- [ ] Keep `OIDC_CLIENT_SECRET` secure
- [ ] Configure proper SSL certificates
- [ ] Review OIDC scopes (only request what you need)
- [ ] Test user provisioning
- [ ] Test logout flow
- [ ] Review Keycloak client settings

## 📚 Full Documentation

See [OIDC_SETUP.md](../OIDC_SETUP.md) for complete documentation including:
- Architecture details
- Security considerations
- Advanced configuration
- API endpoints
- Token verification process
