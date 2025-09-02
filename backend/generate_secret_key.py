#!/usr/bin/env python3
"""
Generate a secure SECRET_KEY for production use
"""

import secrets
import string


def generate_secret_key(length=64):
    """Generate a cryptographically secure secret key."""
    alphabet = string.ascii_letters + string.digits + "!@#$%^&*"
    return "".join(secrets.choice(alphabet) for _ in range(length))


if __name__ == "__main__":
    key = generate_secret_key()
    print("Generated SECRET_KEY:")
    print(key)
    print()
    print("Add this to your .env file:")
    print(f"SECRET_KEY={key}")
