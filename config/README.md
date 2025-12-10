# Configuration Directory

This directory contains YAML configuration files for various Cockpit features.

## Files

### `oidc_providers.yaml`
**OpenID Connect (OIDC) / Single Sign-On (SSO) Configuration**

Configure multiple identity providers (Keycloak, Azure AD, Okta, etc.) for SSO authentication.

- **Example**: `oidc_providers.yaml.example` - Copy this file and customize it
- **Documentation**: See `OIDC_SETUP.md` in the project root for detailed setup instructions
- **Status**: If this file doesn't exist, OIDC/SSO will be disabled

**Quick Setup:**
```bash
# Copy the example file
cp oidc_providers.yaml.example oidc_providers.yaml

# Edit the file and enable at least one provider
# Update discovery_url, client_id, and client_secret
vim oidc_providers.yaml

# Restart the backend
cd ../backend
python start.py
```

### `checkmk.yaml`
CheckMK monitoring integration configuration.

### `snmp_mapping.yaml`
SNMP device mapping and transformation rules.

## Configuration Priority

For OIDC configuration, the system uses this priority order:
1. **YAML Configuration** (`oidc_providers.yaml`) - **Recommended**
2. Legacy environment variables in `.env` - Supported for backward compatibility

The YAML configuration method supports multiple providers and is the recommended approach for all deployments.

## Security Notes

- **Never commit secrets**: Add `oidc_providers.yaml` to `.gitignore`
- **Use strong secrets**: Generate secure client secrets from your OIDC provider
- **HTTPS in production**: Always use HTTPS URLs for production deployments
- **Restrict permissions**: Ensure configuration files are readable only by the application user

## Getting Help

- **OIDC Setup**: See `OIDC_SETUP.md` in the project root
- **Example Configurations**: Check `*.example` files in this directory
- **Troubleshooting**: Enable DEBUG logging in backend and check logs
