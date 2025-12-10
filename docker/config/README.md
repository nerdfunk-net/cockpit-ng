# Docker Configuration Directory

This directory is mounted into the Docker container at `/app/config/`.

## Configuration Files

Place your configuration files here before starting the Docker containers:

### Required for OIDC/SSO Authentication
- **`oidc_providers.yaml`** - Configure OpenID Connect providers for Single Sign-On
  - Copy from `oidc_providers.yaml.example` in this directory (includes Docker-specific notes)
  - Or copy from `../config/oidc_providers.yaml.example` in the project root
  - See `../OIDC_SETUP.md` for detailed setup instructions
  - Edit provider settings (client_id, client_secret, discovery_url, etc.)
  - Important: Use `host.docker.internal` instead of `localhost` for local OIDC providers
  - Enable/disable providers as needed

### Optional Configuration Files
- **`checkmk.yaml`** - Check_MK integration settings
- **`snmp_mapping.yaml`** - SNMP device mapping configuration

## Quick Start

1. **Copy example configuration**:
   ```bash
   # Option 1: Use Docker-specific example (recommended)
   cp oidc_providers.yaml.example oidc_providers.yaml
   
   # Option 2: Use project root example
   cp ../../config/oidc_providers.yaml.example ./oidc_providers.yaml
   ```

2. **Edit the configuration**:
   ```bash
   # Edit with your favorite editor
   nano oidc_providers.yaml
   # or
   vim oidc_providers.yaml
   ```

3. **Restart the containers**:
   ```bash
   cd ..
   docker compose restart
   ```

## Configuration Volume Mount

The `docker-compose.yml` mounts this directory as:
```yaml
volumes:
  - ./config:/app/config
```

This means:
- ✅ You can edit config files on the host machine
- ✅ Changes persist across container restarts
- ✅ No need to rebuild the Docker image
- ✅ Configuration is separated from the application

## OIDC Provider Configuration

Example provider configuration structure:
```yaml
providers:
  corporate:
    enabled: true
    name: "Corporate SSO"
    discovery_url: "https://keycloak.company.com/realms/main/.well-known/openid-configuration"
    client_id: "cockpit"
    client_secret: "your-client-secret"
    scopes:
      - openid
      - profile
      - email
```

For complete examples and documentation, see:
- `../config/oidc_providers.yaml.example`
- `../OIDC_SETUP.md`
- `../OIDC_IMPLEMENTATION_GUIDE.md`
