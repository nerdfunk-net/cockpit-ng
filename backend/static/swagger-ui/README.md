# Swagger UI Static Files

This directory contains locally served Swagger UI and ReDoc static files to support air-gapped deployments.

## Files

- `swagger-ui-bundle.js` - Main Swagger UI JavaScript bundle
- `swagger-ui.css` - Swagger UI stylesheet
- `swagger-ui-standalone-preset.js` - Standalone preset for Swagger UI
- `favicon-32x32.png` - Swagger UI favicon (32x32)
- `favicon-16x16.png` - Swagger UI favicon (16x16)
- `redoc.standalone.js` - ReDoc standalone JavaScript bundle

## Purpose

These files are served locally instead of from CDN (https://cdn.jsdelivr.net) to ensure:
1. Swagger UI works in air-gapped environments without internet access
2. No external dependencies are required for API documentation
3. Compliance with strict network security policies

## Updating

To update to a newer version of Swagger UI:

```bash
cd backend/static/swagger-ui

# Download Swagger UI files (replace version as needed)
curl -L -o swagger-ui-bundle.js https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js
curl -L -o swagger-ui.css https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.css
curl -L -o swagger-ui-standalone-preset.js https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-standalone-preset.js
curl -L -o favicon-32x32.png https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/favicon-32x32.png
curl -L -o favicon-16x16.png https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/favicon-16x16.png

# Download ReDoc (replace version as needed)
curl -L -o redoc.standalone.js https://cdn.jsdelivr.net/npm/redoc@latest/bundles/redoc.standalone.js
```

## Configuration

The static files are mounted in `main.py`:
- Backend path: `/api/static/swagger-ui/`
- Accessed through Next.js proxy: `http://localhost:3000/api/static/swagger-ui/`

The custom Swagger UI and ReDoc endpoints reference these local files.
