# Air-gapped Deployment Guide

This document explains how to deploy Cockpit-NG in environments without internet access.

## Issues Addressed

### External Dependencies Removed

1. **Google Fonts** - Replaced with local fonts and system font fallbacks
2. **Dicebear Avatar API** - Replaced with local SVG avatar generation
3. **External CDNs** - All assets bundled locally

### Font Handling

- **Primary Font**: Geist → System fonts (Inter, System UI, Segoe UI, etc.)
- **Monospace Font**: Geist Mono → System monospace (SF Mono, Monaco, Consolas, etc.)
- **Fallback CSS**: Located in `frontend/public/fonts/`

### Avatar Generation

- **External API**: `api.dicebear.com` → Local SVG generation
- **Fallback**: Initials with consistent color scheme
- **Location**: `src/components/ui/local-avatar.tsx`

## Deployment Methods

### Method 1: All-in-One Docker Image (Recommended)

The all-in-one Docker image contains everything needed for air-gapped deployment:

```bash
# Build the air-gapped image
cd docker
./prepare-all-in-one.sh

# Transfer the compressed image to air-gapped environment
# Copy cockpit-ng-all-in-one.tar.gz to target system

# Deploy in air-gapped environment
./deploy-all-in-one.sh

# Validate deployment
./validate-all-in-one.sh
```

### Method 2: Manual Air-gapped Setup

If you need to set up manually:

1. **Prepare Environment Variables**:
   ```bash
   cd frontend
   cp .env.airgap .env.local
   ```

2. **Build with Air-gapped Configuration**:
   ```bash
   export NEXT_PUBLIC_AIR_GAPPED=true
   export NEXT_PUBLIC_ANALYTICS_DISABLED=true
   export NEXT_PUBLIC_CDN_DISABLED=true
   npm run build
   ```

3. **Verify No External Dependencies**:
   ```bash
   # Check built files for external URLs
   grep -r "googleapis\|fonts\.google\|cdn\." .next/
   # Should return no results
   ```

## Configuration Files

### Environment Variables for Air-gapped Mode

```env
# .env.local
NEXT_PUBLIC_AIR_GAPPED=true
NEXT_PUBLIC_ANALYTICS_DISABLED=true
NEXT_PUBLIC_CDN_DISABLED=true
BACKEND_URL=http://localhost:8000
```

### Next.js Configuration

The `next.config.ts` includes air-gapped optimizations:
- Disabled external image optimization
- Enhanced caching headers
- SVG support for local avatars
- Bundle optimization for offline usage

## Font Management

### Local Font Files

```
frontend/public/fonts/
├── geist.css          # Local Geist font with fallbacks
├── geist-mono.css     # Local Geist Mono with fallbacks
└── README.md          # Font documentation
```

### Font Loading Strategy

1. **Primary**: Load local font CSS files
2. **Fallback**: Use system fonts if local fonts fail
3. **CSS Variables**: Consistent font stack definitions

## Avatar System

### Local Avatar Generation

```typescript
// Generate local SVG avatar
const avatarUrl = generateAvatarDataUrl(username, 48);

// Features:
// - Consistent color generation from username
// - SVG-based for crisp display
// - Base64 encoded data URLs
// - No external dependencies
```

### Color Scheme

Avatars use a predefined color palette for consistency:
- Blue (#3B82F6), Green (#10B981), Amber (#F59E0B)
- Red (#EF4444), Purple (#8B5CF6), Cyan (#06B6D4)
- Orange (#F97316), Lime (#84CC16), Pink (#EC4899), Indigo (#6366F1)

## Validation

### Check for External Dependencies

```bash
# 1. Check HTML output for external URLs
grep -r "https://" .next/static/

# 2. Verify font loading
curl -I http://localhost:3000/fonts/geist.css

# 3. Test avatar generation
# Open browser dev tools and check Network tab
# Should show no external requests for fonts or avatars
```

### Performance in Air-gapped Mode

- **Fonts**: System fonts load instantly
- **Avatars**: SVG generation is fast and cached
- **Styles**: All CSS bundled and optimized
- **Images**: No external image dependencies

## Troubleshooting

### Common Issues

1. **Fonts appear different**: This is expected with system font fallbacks
2. **Avatar colors change**: Colors are consistent per username
3. **Slow first load**: Initial generation of local assets

### Debug Mode

Enable debug logging for air-gapped issues:

```bash
export DEBUG=cockpit:airgap
npm start
```

### Browser Developer Tools

Check the Network tab for any external requests:
- Should see no requests to googleapis.com
- Should see no requests to dicebear.com
- All font/avatar requests should be local

## Security Considerations

### Content Security Policy

The air-gapped configuration includes strict CSP:
- No external script sources
- SVG sandboxing for avatars
- Data URLs allowed for local assets

### Asset Integrity

All local assets are validated:
- Font files served with immutable cache headers
- SVG avatars generated server-side
- No dynamic external content loading

## Migration Notes

### From External to Local Fonts

- Visual appearance may slightly change due to font differences
- System fonts provide good fallback experience
- Performance actually improves in air-gapped mode

### From External to Local Avatars

- Avatar appearance will change from external API style to local style
- Colors remain consistent per user
- Better privacy as no external API calls made

## Deployment Checklist

- [ ] Build with `NEXT_PUBLIC_AIR_GAPPED=true`
- [ ] Verify no external font requests
- [ ] Verify no external avatar requests  
- [ ] Test offline functionality
- [ ] Validate all styling appears correctly
- [ ] Check all user avatars generate properly
- [ ] Verify font fallbacks work across different browsers
