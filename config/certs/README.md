# CA Certificates Directory

This directory stores custom CA (Certificate Authority) certificates for OIDC providers that use self-signed certificates or private CAs.

## Purpose

When your OIDC provider (Keycloak, Azure AD, etc.) uses HTTPS with a self-signed certificate or a certificate issued by a private/corporate CA, you need to provide the CA certificate here so the application can verify the SSL/TLS connection.

## Certificate Format

**IMPORTANT:** Certificates MUST be in **PEM format**.

### PEM Format Characteristics
- Text-based format
- Starts with `-----BEGIN CERTIFICATE-----`
- Ends with `-----END CERTIFICATE-----`
- Contains base64-encoded certificate data
- Can be opened in a text editor

### Example PEM Certificate
```
-----BEGIN CERTIFICATE-----
MIIDXTCCAkWgAwIBAgIJAKJ7L9bXZ0dMMA0GCSqGSIb3DQEBCwUAMEUxCzAJBgNV
BAYTAkFVMRMwEQYDVQQIDApTb21lLVN0YXRlMSEwHwYDVQQKDBhJbnRlcm5ldCBX
...more base64 data...
-----END CERTIFICATE-----
```

## Converting Certificate Formats

If you have certificates in other formats (DER, CRT, CER, P7B, PFX, P12), use the provided conversion script:

```bash
# Basic usage (auto-detects format)
./convert-cert.sh your-certificate.crt

# Specify output file name
./convert-cert.sh your-certificate.crt ca-certificate.pem

# Convert from absolute path
./convert-cert.sh /path/to/certificate.der

# Get help
./convert-cert.sh --help
```

### Supported Input Formats

| Format | Extensions | Description |
|--------|------------|-------------|
| **DER** | `.der`, `.crt`, `.cer` | Binary or text X.509 certificates |
| **PKCS#7** | `.p7b`, `.p7c` | Certificate chain files |
| **PKCS#12** | `.pfx`, `.p12` | Password-protected certificate bundles |
| **PEM** | `.pem` | Already in correct format |

## Manual Conversion (Using OpenSSL)

If you prefer to convert manually:

### DER/CRT/CER to PEM
```bash
openssl x509 -inform DER -in certificate.crt -out certificate.pem
```

### PKCS#7 to PEM
```bash
openssl pkcs7 -print_certs -in certificate.p7b -out certificate.pem
```

### PKCS#12 to PEM (Extract CA Certificate)
```bash
openssl pkcs12 -in certificate.pfx -cacerts -nokeys -out ca-certificate.pem
```

## Checking Certificate Format

To verify if a certificate is in PEM format:

```bash
# Try to read as PEM
openssl x509 -in certificate.crt -text -noout

# If above fails, try as DER
openssl x509 -inform DER -in certificate.crt -text -noout
```

## Exporting CA Certificate from Server

### From a Running HTTPS Server
```bash
# Export certificate chain from server
openssl s_client -connect keycloak.example.com:443 -showcerts

# Extract the CA certificate (the root certificate in the chain)
# Copy everything from -----BEGIN CERTIFICATE----- to -----END CERTIFICATE-----
# Save to a file like ca-certificate.pem
```

### From Keycloak
1. Navigate to Keycloak admin console
2. Go to Realm Settings → Keys → Certificate
3. Click "Certificate" button to download
4. Save as PEM format

### From Browser (Chrome/Firefox)
1. Click padlock icon in address bar
2. Click "Certificate" or "Connection is secure"
3. Go to "Details" or "Certificate" tab
4. Select the root CA certificate
5. Export as PEM or Base64-encoded

## Using Certificates in OIDC Configuration

Once you have the PEM certificate in this directory, reference it in `config/oidc_providers.yaml`:

```yaml
providers:
  corporate:
    name: "Corporate SSO"
    discovery_url: "https://keycloak.company.com/realms/prod/.well-known/openid-configuration"
    client_id: "cockpit"
    client_secret: "secret"

    # Reference the CA certificate (path relative to project root)
    ca_cert_path: "config/certs/corporate-ca.pem"
```

### Multiple Providers with Different CAs

Each provider can use a different CA certificate:

```yaml
providers:
  corporate:
    ca_cert_path: "config/certs/corporate-ca.pem"

  development:
    ca_cert_path: "config/certs/dev-ca.pem"

  partners:
    ca_cert_path: "config/certs/partner-ca.pem"
```

## Security Recommendations

### File Permissions
```bash
# Make certificates read-only
chmod 444 *.pem

# Protect the directory
chmod 755 .
```

### Best Practices
- ✅ Keep CA certificates separate from client certificates
- ✅ Use descriptive file names (e.g., `corporate-root-ca.pem`)
- ✅ Document the source and expiration date of each certificate
- ✅ Regularly review and update certificates before expiration
- ✅ Never commit private keys to version control
- ❌ Don't store password-protected certificates (extract first)
- ❌ Don't mix CA certificates with client certificates

## Troubleshooting

### Error: "SSL: CERTIFICATE_VERIFY_FAILED"
**Cause:** CA certificate not configured or incorrect format

**Solution:**
1. Verify certificate is in PEM format: `openssl x509 -in cert.pem -text -noout`
2. Check file exists at the path specified in config
3. Ensure file is readable: `ls -l config/certs/`
4. Check backend logs for certificate loading messages

### Error: "CA certificate not found"
**Cause:** Path in configuration doesn't match file location

**Solution:**
1. Verify path in `oidc_providers.yaml` matches actual file location
2. Use relative path from project root: `config/certs/filename.pem`
3. Check for typos in filename

### Error: "Failed to load CA certificate"
**Cause:** Certificate file is corrupted or in wrong format

**Solution:**
1. Re-export certificate from source
2. Verify PEM format: should start with `-----BEGIN CERTIFICATE-----`
3. Use conversion script: `./convert-cert.sh certificate.crt`
4. Check file isn't empty: `cat certificate.pem`

### Certificate Works in Browser but Not in Application
**Cause:** Browser may have intermediate certificates cached

**Solution:**
1. Export the full certificate chain (root + intermediate CAs)
2. Combine all CA certificates in one PEM file:
   ```bash
   cat intermediate-ca.pem root-ca.pem > ca-bundle.pem
   ```
3. Use the bundle: `ca_cert_path: "config/certs/ca-bundle.pem"`

## Example: Complete Setup

```bash
# 1. Navigate to certs directory
cd config/certs

# 2. Export certificate from server
openssl s_client -connect keycloak.company.com:443 -showcerts > cert-chain.txt

# 3. Extract CA certificate from output (copy the last certificate)
# Save to corporate-ca.pem

# 4. Verify it's valid PEM
openssl x509 -in corporate-ca.pem -text -noout

# 5. Set permissions
chmod 444 corporate-ca.pem

# 6. Configure in oidc_providers.yaml
# ca_cert_path: "config/certs/corporate-ca.pem"

# 7. Restart backend
cd ../../backend
python start.py
```

## Files in This Directory

- `convert-cert.sh` - Certificate format conversion utility
- `README.md` - This file
- `*.pem` - Your CA certificates (you add these)
- `.gitignore` - Prevents accidental commit of sensitive certificates

## Support

For questions or issues:
1. Check this README
2. Review OIDC_SETUP.md in project root
3. Check backend logs for certificate loading messages
4. Test certificate with openssl commands above
