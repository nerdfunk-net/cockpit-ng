"""
Certificate installation utility for Docker environments.

Installs .crt files from config/certs/ into the system CA store when
the INSTALL_CERTIFICATE_FILES environment variable is set to 'true'.
"""

from __future__ import annotations

import os
import shutil
import subprocess
from pathlib import Path


def install_certificates(backend_dir: str) -> None:
    """Install certificates from config/certs/ to the system CA store.

    Copies all .crt files from config/certs/ to /usr/local/share/ca-certificates/
    and runs update-ca-certificates to update the system trust store.

    Only runs when INSTALL_CERTIFICATE_FILES environment variable is set to 'true'.

    Args:
        backend_dir: Absolute path to the backend directory.
    """
    if os.environ.get("INSTALL_CERTIFICATE_FILES", "false").lower() != "true":
        return

    print("Installing certificates from config/certs/...")

    config_certs_dir = Path(backend_dir) / ".." / "config" / "certs"
    system_ca_dir = Path("/usr/local/share/ca-certificates")

    if not config_certs_dir.exists():
        print(f"  Certificate directory not found: {config_certs_dir}")
        return

    cert_files = list(config_certs_dir.glob("*.crt"))
    if not cert_files:
        print("  No .crt files found in config/certs/")
        return

    try:
        system_ca_dir.mkdir(parents=True, exist_ok=True)
    except PermissionError:
        print(f"  ERROR: Permission denied creating {system_ca_dir}")
        return

    copied_count = 0
    for cert_file in cert_files:
        try:
            shutil.copy2(cert_file, system_ca_dir / cert_file.name)
            print(f"  Copied: {cert_file.name}")
            copied_count += 1
        except PermissionError:
            print(f"  ERROR: Permission denied copying {cert_file.name}")
        except Exception as e:
            print(f"  ERROR: Failed to copy {cert_file.name}: {e}")

    if copied_count == 0:
        print("  No certificates were copied")
        return

    print("  Running update-ca-certificates...")
    try:
        result = subprocess.run(
            ["update-ca-certificates"],
            capture_output=True,
            text=True,
            timeout=60,
        )
        if result.returncode == 0:
            print(f"  Successfully installed {copied_count} certificate(s)")
            for line in result.stdout.strip().split("\n"):
                if line.strip():
                    print(f"    {line}")
        else:
            print(f"  WARNING: update-ca-certificates returned {result.returncode}")
            if result.stderr:
                print(f"    {result.stderr}")
    except FileNotFoundError:
        print("  WARNING: update-ca-certificates not found (not running in Docker?)")
    except subprocess.TimeoutExpired:
        print("  WARNING: update-ca-certificates timed out")
    except Exception as e:
        print(f"  WARNING: Failed to run update-ca-certificates: {e}")
