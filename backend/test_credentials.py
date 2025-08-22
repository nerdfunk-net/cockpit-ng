#!/usr/bin/env python3
"""
Test script to diagnose credential decryption issues
"""

import sys
import os
sys.path.append(os.path.dirname(__file__))

from credentials_manager import list_credentials, get_decrypted_password
from config import settings

def test_credentials():
    print("=== Credential Decryption Test ===")
    print(f"SECRET_KEY: {settings.secret_key[:20]}..." if settings.secret_key else "No SECRET_KEY")
    print()
    
    try:
        # List all credentials
        creds = list_credentials(include_expired=True)
        print(f"Found {len(creds)} credentials:")
        
        for cred in creds:
            print(f"\nCredential: {cred['name']}")
            print(f"  Type: {cred['type']}")
            print(f"  Username: {cred['username']}")
            print(f"  Has Password: {cred.get('has_password', False)}")
            print(f"  Status: {cred.get('status', 'unknown')}")
            print(f"  ID: {cred.get('id', 'unknown')}")
            
            # Test decryption
            if cred.get('has_password', False):
                try:
                    decrypted = get_decrypted_password(cred['id'])
                    print(f"  Decryption: SUCCESS (length: {len(decrypted)})")
                except ValueError as ve:
                    print(f"  Decryption: FAILED - {ve}")
                    print(f"    This likely means the SECRET_KEY has changed since credential creation")
                except Exception as e:
                    print(f"  Decryption: ERROR - {e}")
            else:
                print(f"  Decryption: SKIPPED (no password data)")
                
    except Exception as e:
        print(f"Error listing credentials: {e}")

if __name__ == "__main__":
    test_credentials()
