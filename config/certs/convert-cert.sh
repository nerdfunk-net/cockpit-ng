#!/bin/bash

# Certificate Format Converter for OIDC CA Certificates
# Converts various certificate formats to PEM format required by the OIDC service

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_usage() {
    echo -e "${BLUE}Certificate Format Converter${NC}"
    echo ""
    echo "Usage: $0 <input-file> [output-file]"
    echo ""
    echo "Converts certificate files to PEM format for OIDC authentication."
    echo ""
    echo "Arguments:"
    echo "  input-file   : Path to certificate file (supports: .crt, .cer, .der, .p7b, .pfx, .p12)"
    echo "  output-file  : Optional output path (default: same name with .pem extension)"
    echo ""
    echo "Supported Input Formats:"
    echo "  - DER/CRT/CER : Binary or PEM-encoded X.509 certificates"
    echo "  - P7B/PKCS#7  : Certificate chain files"
    echo "  - PFX/P12     : PKCS#12 certificate bundles (will extract CA cert)"
    echo ""
    echo "Examples:"
    echo "  $0 corporate-ca.crt"
    echo "  $0 corporate-ca.crt corporate-ca.pem"
    echo "  $0 /path/to/cert.der ca-certificate.pem"
    echo ""
}

print_error() {
    echo -e "${RED}ERROR: $1${NC}" >&2
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_info() {
    echo -e "${YELLOW}ℹ $1${NC}"
}

# Check for help flag
if [ "$1" = "-h" ] || [ "$1" = "--help" ] || [ -z "$1" ]; then
    print_usage
    exit 0
fi

# Check if openssl is installed
if ! command -v openssl &> /dev/null; then
    print_error "openssl is not installed. Please install it first."
    exit 1
fi

INPUT_FILE="$1"
OUTPUT_FILE="${2:-}"

# Validate input file exists
if [ ! -f "$INPUT_FILE" ]; then
    print_error "Input file not found: $INPUT_FILE"
    exit 1
fi

# Determine output file name
if [ -z "$OUTPUT_FILE" ]; then
    BASENAME=$(basename "$INPUT_FILE")
    FILENAME="${BASENAME%.*}"
    OUTPUT_FILE="${FILENAME}.pem"
fi

# Get file extension
EXT="${INPUT_FILE##*.}"
EXT_LOWER=$(echo "$EXT" | tr '[:upper:]' '[:lower:]')

echo -e "${BLUE}Certificate Format Converter${NC}"
echo "Input:  $INPUT_FILE"
echo "Output: $OUTPUT_FILE"
echo ""

# Check if already PEM format
if openssl x509 -in "$INPUT_FILE" -text -noout &> /dev/null; then
    print_info "Certificate is already in PEM format."
    if [ "$INPUT_FILE" != "$OUTPUT_FILE" ]; then
        cp "$INPUT_FILE" "$OUTPUT_FILE"
        print_success "Copied to: $OUTPUT_FILE"
    else
        print_info "No conversion needed - file is already PEM format."
    fi
    exit 0
fi

# Try conversion based on file extension and auto-detection
case "$EXT_LOWER" in
    crt|cer|der)
        print_info "Detected DER/CRT/CER format. Converting to PEM..."
        if openssl x509 -inform DER -in "$INPUT_FILE" -out "$OUTPUT_FILE" 2>/dev/null; then
            print_success "Successfully converted DER to PEM: $OUTPUT_FILE"
        else
            print_error "Failed to convert. File may be in an unsupported format."
            print_info "Try checking the file with: openssl x509 -inform DER -in $INPUT_FILE -text -noout"
            exit 1
        fi
        ;;

    p7b|p7c)
        print_info "Detected PKCS#7 format. Extracting certificates to PEM..."
        if openssl pkcs7 -print_certs -in "$INPUT_FILE" -out "$OUTPUT_FILE" 2>/dev/null; then
            print_success "Successfully extracted certificates to PEM: $OUTPUT_FILE"
            print_info "Note: PKCS#7 files may contain multiple certificates. All were extracted."
        else
            print_error "Failed to extract certificates from PKCS#7 file."
            exit 1
        fi
        ;;

    pfx|p12)
        print_info "Detected PKCS#12 format. Extracting CA certificate to PEM..."
        echo ""
        print_info "This file may be password-protected. Enter password when prompted (or press Enter if none):"
        if openssl pkcs12 -in "$INPUT_FILE" -cacerts -nokeys -out "$OUTPUT_FILE" 2>/dev/null; then
            print_success "Successfully extracted CA certificate to PEM: $OUTPUT_FILE"
        else
            print_error "Failed to extract CA certificate from PKCS#12 file."
            print_info "Make sure you entered the correct password (if any)."
            exit 1
        fi
        ;;

    pem)
        print_info "File has .pem extension but doesn't appear to be valid PEM format."
        print_error "Please verify the file contents."
        exit 1
        ;;

    *)
        print_error "Unknown file extension: .$EXT"
        print_info "Attempting auto-detection..."

        # Try DER format
        if openssl x509 -inform DER -in "$INPUT_FILE" -out "$OUTPUT_FILE" 2>/dev/null; then
            print_success "Auto-detected and converted DER format to PEM: $OUTPUT_FILE"
            exit 0
        fi

        # Try PKCS#7
        if openssl pkcs7 -print_certs -in "$INPUT_FILE" -out "$OUTPUT_FILE" 2>/dev/null; then
            print_success "Auto-detected and converted PKCS#7 format to PEM: $OUTPUT_FILE"
            exit 0
        fi

        print_error "Could not auto-detect format. Supported formats: DER, CRT, CER, P7B, PFX, P12"
        exit 1
        ;;
esac

# Verify the output file is valid PEM
echo ""
print_info "Verifying converted certificate..."
if openssl x509 -in "$OUTPUT_FILE" -text -noout &> /dev/null; then
    print_success "Certificate is valid PEM format!"
    echo ""
    echo -e "${GREEN}Conversion successful!${NC}"
    echo ""
    echo "You can now use this certificate in your OIDC configuration:"
    echo "  ca_cert_path: \"config/certs/$OUTPUT_FILE\""
    echo ""
    echo "To view certificate details:"
    echo "  openssl x509 -in $OUTPUT_FILE -text -noout"
else
    print_error "Output file is not valid PEM format. Conversion may have failed."
    exit 1
fi
