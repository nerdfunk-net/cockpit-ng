#!/usr/bin/env python3
"""
Credential management utility to handle SECRET_KEY mismatches
"""

import sys
import os
sys.path.append(os.path.dirname(__file__))

from credentials_manager import list_credentials, delete_credential
from config import settings

def main():
    print("=== Credential Management Utility ===")
    print(f"Current SECRET_KEY: {settings.secret_key[:20]}..." if settings.secret_key else "No SECRET_KEY")
    print()
    
    # Check if there are credentials with decryption issues
    creds = list_credentials(include_expired=True)
    broken_creds = []
    
    for cred in creds:
        if cred.get('has_password', False):
            try:
                from credentials_manager import get_decrypted_password
                get_decrypted_password(cred['id'])
            except ValueError:
                broken_creds.append(cred)
    
    if not broken_creds:
        print("✅ All credentials are working correctly!")
        return
    
    print(f"⚠️  Found {len(broken_creds)} credentials with decryption issues:")
    for cred in broken_creds:
        print(f"  - {cred['name']} (type: {cred['type']}, id: {cred['id']})")
    
    print("\n" + "="*60)
    print("ISSUE: SECRET_KEY mismatch detected!")
    print("This happens when the SECRET_KEY changes after credentials are created.")
    print()
    print("SOLUTIONS:")
    print("1. Delete broken credentials and recreate them (RECOMMENDED)")
    print("2. Update your SECRET_KEY to the original value if you know it")
    print("3. Keep broken credentials for reference only")
    print("="*60)
    
    choice = input("\nWhat would you like to do?\n1) Delete broken credentials\n2) Keep them\n3) Exit\nChoice (1-3): ").strip()
    
    if choice == "1":
        print(f"\nDeleting {len(broken_creds)} broken credentials...")
        for cred in broken_creds:
            try:
                delete_credential(cred['id'])
                print(f"✅ Deleted: {cred['name']}")
            except Exception as e:
                print(f"❌ Failed to delete {cred['name']}: {e}")
        print("\n🎉 Cleanup complete! You can now create new credentials in the UI.")
        
    elif choice == "2":
        print("\n✅ Keeping broken credentials. You'll need to fix the SECRET_KEY issue manually.")
        
    else:
        print("\n👋 Exiting without changes.")

if __name__ == "__main__":
    main()
