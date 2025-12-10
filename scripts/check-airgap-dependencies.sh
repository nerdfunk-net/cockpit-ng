#!/bin/bash

# Air-gapped Dependency Checker
# Validates that the application has no external dependencies

set -e

echo "🔍 Checking for external dependencies in Cockpit-NG..."
echo "=================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Track issues
ISSUES_FOUND=0

# Function to report issues
report_issue() {
    echo -e "${RED}❌ ISSUE: $1${NC}"
    ISSUES_FOUND=$((ISSUES_FOUND + 1))
}

# Function to report success
report_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

# Function to report warning
report_warning() {
    echo -e "${YELLOW}⚠️  WARNING: $1${NC}"
}

# Check 1: Frontend source code for external URLs
echo "1. Checking frontend source for external URLs..."
EXTERNAL_URLS=$(find frontend/src -type f \( -name "*.tsx" -o -name "*.ts" -o -name "*.js" -o -name "*.css" \) -exec grep -l "https://" {} \; 2>/dev/null || true)

if [ -n "$EXTERNAL_URLS" ]; then
    report_warning "External URLs found in source code:"
    echo "$EXTERNAL_URLS"
    
    # Check specific problematic URLs
    if grep -r "googleapis\|fonts\.google" frontend/src/ 2>/dev/null; then
        report_issue "Google Fonts URLs found in source code"
    fi
    
    if grep -r "dicebear\|api\.dicebear" frontend/src/ 2>/dev/null; then
        report_issue "Dicebear API URLs found in source code"
    fi
    
    if grep -r "cdn\." frontend/src/ 2>/dev/null; then
        report_issue "CDN URLs found in source code"
    fi
else
    report_success "No external URLs found in source code"
fi

# Check 2: Built frontend for external dependencies
echo -e "\n2. Checking built frontend..."
if [ -d "frontend/.next" ]; then
    # Check for external URLs in built files
    BUILT_EXTERNALS=$(find frontend/.next -type f \( -name "*.js" -o -name "*.css" -o -name "*.html" \) -exec grep -l "googleapis\|fonts\.google\|dicebear\|cdn\." {} \; 2>/dev/null || true)
    
    if [ -n "$BUILT_EXTERNALS" ]; then
        report_issue "External dependencies found in built files:"
        echo "$BUILT_EXTERNALS"
    else
        report_success "No external dependencies in built files"
    fi
else
    report_warning "Frontend not built (.next directory not found)"
fi

# Check 3: Font files availability
echo -e "\n3. Checking local font files..."
if [ -f "frontend/public/fonts/geist.css" ]; then
    report_success "Local Geist font CSS found"
else
    report_issue "Local Geist font CSS missing"
fi

if [ -f "frontend/public/fonts/geist-mono.css" ]; then
    report_success "Local Geist Mono font CSS found"
else
    report_issue "Local Geist Mono font CSS missing"
fi

# Check 4: Local avatar component
echo -e "\n4. Checking local avatar system..."
if [ -f "frontend/src/components/ui/local-avatar.tsx" ]; then
    report_success "Local avatar component found"
else
    report_issue "Local avatar component missing"
fi

# Check 5: Air-gapped configuration
echo -e "\n5. Checking air-gapped configuration..."
if [ -f "frontend/.env.airgap" ]; then
    report_success "Air-gapped environment template found"
else
    report_issue "Air-gapped environment template missing"
fi

if [ -f "frontend/src/lib/air-gap-config.ts" ]; then
    report_success "Air-gapped configuration module found"
else
    report_issue "Air-gapped configuration module missing"
fi

# Check 6: Docker configuration
echo -e "\n6. Checking Docker air-gapped configuration..."
if grep -q "NEXT_PUBLIC_AIR_GAPPED=true" docker/Dockerfile.all-in-one 2>/dev/null; then
    report_success "Docker configured for air-gapped deployment"
else
    report_warning "Docker may not be configured for air-gapped deployment"
fi

# Check 7: Package.json for problematic dependencies
echo -e "\n7. Checking package dependencies..."
if [ -f "frontend/package.json" ]; then
    # Check for dependencies that might require external access
    PROBLEMATIC_DEPS=$(grep -E "(google-fonts|external-cdn|analytics)" frontend/package.json || true)
    if [ -n "$PROBLEMATIC_DEPS" ]; then
        report_warning "Potentially problematic dependencies found"
        echo "$PROBLEMATIC_DEPS"
    else
        report_success "No obviously problematic dependencies found"
    fi
fi

# Summary
echo -e "\n=================================================="
echo "🔍 Air-gapped Dependency Check Summary"
echo "=================================================="

if [ $ISSUES_FOUND -eq 0 ]; then
    echo -e "${GREEN}✅ SUCCESS: No blocking issues found!${NC}"
    echo -e "${GREEN}   The application should work in air-gapped environments.${NC}"
    
    echo -e "\n📋 Deployment checklist:"
    echo "   • Use NEXT_PUBLIC_AIR_GAPPED=true environment variable"
    echo "   • Build with air-gapped configuration"
    echo "   • Deploy using all-in-one Docker image for best results"
    
    exit 0
else
    echo -e "${RED}❌ ISSUES FOUND: $ISSUES_FOUND problem(s) detected${NC}"
    echo -e "${RED}   Fix these issues before deploying to air-gapped environments.${NC}"
    
    echo -e "\n🔧 Common fixes:"
    echo "   • Run: cd frontend && cp .env.airgap .env.local"
    echo "   • Ensure local font files are present"
    echo "   • Verify local avatar component is working"
    echo "   • Build with air-gapped environment variables"
    
    exit 1
fi
