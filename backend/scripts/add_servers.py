#!/usr/bin/env python3
"""Add mock servers to the database for Server Clients UI testing.

Servers are stored in the ``servers`` table (see ``core.models.servers.Server``).
Hardware fields (RAM, CPUs, disks, OS family, distribution, …) are denormalized
columns plus a nested ``ansible_facts`` JSONB blob used by the detail panel
(mount points, etc.).

Usage (from ``backend/``)::

    # 10 random servers: server-001 … server-010
    python scripts/add_servers.py --count 10 --random

    # Fixed hardware profile
    python scripts/add_servers.py --count 5 \\
        --ram 16384 --cpus 8 --disks 2 \\
        --os-family Debian --distribution-release noble \\
        --distribution-version 24.04

    # Custom prefix, wipe previous mock servers with that prefix first
    python scripts/add_servers.py --count 20 --random --prefix mock- --clear-prefix

    # Reproducible random data
    python scripts/add_servers.py --count 50 --random --seed 42
"""

from __future__ import annotations

import argparse
import math
import random
import re
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence, Tuple

BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

from dotenv import load_dotenv  # noqa: E402

# ---------------------------------------------------------------------------
# Realistic pools for --random
# ---------------------------------------------------------------------------

# (os_family, distribution, distribution_release, distribution_version, architecture)
_OS_PROFILES: Sequence[Tuple[str, str, str, str, str]] = (
    ("Debian", "Ubuntu", "noble", "24.04", "x86_64"),
    ("Debian", "Ubuntu", "jammy", "22.04", "x86_64"),
    ("Debian", "Debian", "bookworm", "12", "x86_64"),
    ("Debian", "Ubuntu", "focal", "20.04", "x86_64"),
    ("RedHat", "Rocky", "9.4", "9.4", "x86_64"),
    ("RedHat", "Rocky", "8.9", "8.9", "x86_64"),
    ("RedHat", "CentOS", "9.3", "9.3", "aarch64"),
    ("Suse", "SLES", "15-SP5", "15.5", "x86_64"),
    ("Suse", "openSUSE", "15-SP4", "15.4", "x86_64"),
)

_RAM_MB_CHOICES: Sequence[int] = (1024, 2048, 4096, 8192, 16384, 32768, 65536)
_CPU_CHOICES: Sequence[int] = (1, 2, 4, 8, 16, 32)
_DISK_CHOICES: Sequence[int] = (1, 2, 3, 4)

# Default fixed profile when not using --random and no overrides are given
_DEFAULT_RAM_MB = 8192
_DEFAULT_CPUS = 4
_DEFAULT_DISKS = 2
_DEFAULT_OS_FAMILY = "Debian"
_DEFAULT_DISTRIBUTION = "Ubuntu"
_DEFAULT_DIST_RELEASE = "noble"
_DEFAULT_DIST_VERSION = "24.04"
_DEFAULT_ARCH = "x86_64"

_GB = 1024 * 1024 * 1024


def _load_env(env_file: Optional[Path]) -> str:
    if env_file is not None:
        if not env_file.is_file():
            print(f"ERROR: env file not found: {env_file}", file=sys.stderr)
            sys.exit(1)
        load_dotenv(env_file)
        return str(env_file)

    env_dev = BACKEND_DIR / ".env"
    env_test = BACKEND_DIR / ".env.test"
    # Prefer the app/dev database for UI testing (unlike seed_client_data).
    if env_dev.is_file():
        load_dotenv(env_dev)
        return str(env_dev)
    if env_test.is_file():
        load_dotenv(env_test)
        return str(env_test)
    print("WARNING: No .env or .env.test found; using process environment.")
    return "(process environment)"


def _pad_width(count: int, start: int) -> int:
    """Zero-pad width so the largest index fits (minimum 3 → server-001)."""
    max_index = start + count - 1
    return max(3, len(str(max_index)))


def _hostname(prefix: str, index: int, width: int) -> str:
    return f"{prefix}{index:0{width}d}"


def _ipv4_for_index(base_octets: Tuple[int, int, int], index: int) -> str:
    """Build  a.b.c.d from a /24 base and 1-based index (wraps past .254)."""
    a, b, c = base_octets
    # Skip .0 and .255; map index → 1..254 cycling
    host = ((index - 1) % 254) + 1
    # Bump third octet when wrapping
    c = (c + (index - 1) // 254) % 256
    return f"{a}.{b}.{c}.{host}"


def _parse_ip_base(value: str) -> Tuple[int, int, int]:
    parts = value.strip().split(".")
    if len(parts) not in (3, 4):
        raise argparse.ArgumentTypeError(
            f"--ip-base must look like 10.50.0 or 10.50.0.0, got {value!r}"
        )
    try:
        octets = [int(p) for p in parts[:3]]
    except ValueError as exc:
        raise argparse.ArgumentTypeError(f"invalid --ip-base: {value!r}") from exc
    if any(o < 0 or o > 255 for o in octets):
        raise argparse.ArgumentTypeError(f"invalid --ip-base octets: {value!r}")
    return octets[0], octets[1], octets[2]


def _build_mounts(disk_count: int, rng: random.Random) -> List[Dict[str, Any]]:
    """Synthetic /dev mounts so the UI mount-points table has data."""
    mounts: List[Dict[str, Any]] = []
    if disk_count < 1:
        return mounts

    root_total = rng.choice([20, 40, 50, 80, 100]) * _GB
    root_avail = int(root_total * rng.uniform(0.15, 0.55))
    mounts.append(
        {
            "mount": "/",
            "device": "/dev/sda1",
            "fstype": "ext4",
            "size_total": root_total,
            "size_available": root_avail,
        }
    )

    for i in range(1, disk_count):
        letter = chr(ord("b") + (i - 1) % 24)
        size_gb = rng.choice([50, 100, 200, 500, 1000])
        total = size_gb * _GB
        mounts.append(
            {
                "mount": f"/data{i}" if i > 1 else "/var",
                "device": f"/dev/sd{letter}1",
                "fstype": rng.choice(["ext4", "xfs"]),
                "size_total": total,
                "size_available": int(total * rng.uniform(0.2, 0.7)),
            }
        )
    return mounts


def _build_ansible_facts(
    *,
    hostname: str,
    os_family: str,
    distribution: str,
    processor_count: int,
    memtotal_mb: int,
    architecture: str,
    distribution_release: str,
    distribution_version: str,
    primary_ipv4: str,
    primary_interface: str,
    disk_count: int,
    is_virtual: bool,
    rng: random.Random,
) -> Dict[str, Any]:
    """Shape matches what parse_ansible_facts / the UI expect."""
    mounts = _build_mounts(disk_count, rng)
    return {
        "ansible_virtualization_role": "guest" if is_virtual else "host",
        "ansible_virtualization_type": "kvm" if is_virtual else "NA",
        "ansible_facts": {
            "hostname": hostname,
            "fqdn": hostname,
            "os_family": os_family,
            "distribution": distribution,
            "processor_count": processor_count,
            "memtotal_mb": memtotal_mb,
            "architecture": architecture,
            "distribution_release": distribution_release,
            "distribution_version": distribution_version,
            "default_ipv4": {
                "address": primary_ipv4,
                "interface": primary_interface,
            },
            "mounts": mounts,
        },
    }


def _next_free_start(prefix: str, service: Any) -> int:
    """Return the next 1-based index after the highest existing ``prefixNNN``."""
    pattern = re.compile(rf"^{re.escape(prefix)}(\d+)$")
    max_n = 0
    for server in service.get_all():
        match = pattern.match(server.hostname or "")
        if match:
            max_n = max(max_n, int(match.group(1)))
    return max_n + 1


def _delete_by_prefix(prefix: str, service: Any) -> int:
    deleted = 0
    for server in list(service.get_all()):
        if (server.hostname or "").startswith(prefix):
            if service.delete(server.id):
                deleted += 1
                print(f"  deleted {server.hostname} (id={server.id})")
    return deleted


def _resolve_profile(
    args: argparse.Namespace, rng: random.Random
) -> Tuple[str, str, str, str, str, int, int, int, bool]:
    """Return (os_family, distribution, release, version, arch, ram, cpus, disks, is_virtual)."""
    if args.random:
        os_family, distribution, release, version, arch = rng.choice(_OS_PROFILES)
        ram = args.ram if args.ram is not None else rng.choice(_RAM_MB_CHOICES)
        cpus = args.cpus if args.cpus is not None else rng.choice(_CPU_CHOICES)
        disks = args.disks if args.disks is not None else rng.choice(_DISK_CHOICES)
        if args.is_virtual is not None:
            is_virtual = args.is_virtual
        else:
            is_virtual = rng.choice([True, True, False])  # bias toward VMs
        # Allow explicit OS overrides even in random mode
        if args.os_family is not None:
            os_family = args.os_family
        if args.distribution is not None:
            distribution = args.distribution
        if args.distribution_release is not None:
            release = args.distribution_release
        if args.distribution_version is not None:
            version = args.distribution_version
        if args.architecture is not None:
            arch = args.architecture
        return (
            os_family,
            distribution,
            release,
            version,
            arch,
            ram,
            cpus,
            disks,
            is_virtual,
        )

    return (
        args.os_family or _DEFAULT_OS_FAMILY,
        args.distribution or _DEFAULT_DISTRIBUTION,
        args.distribution_release or _DEFAULT_DIST_RELEASE,
        args.distribution_version or _DEFAULT_DIST_VERSION,
        args.architecture or _DEFAULT_ARCH,
        args.ram if args.ram is not None else _DEFAULT_RAM_MB,
        args.cpus if args.cpus is not None else _DEFAULT_CPUS,
        args.disks if args.disks is not None else _DEFAULT_DISKS,
        bool(args.is_virtual) if args.is_virtual is not None else False,
    )


def _print_db_info(env_loaded: str) -> None:
    from sqlalchemy import text
    from sqlalchemy.engine import URL as EngineURL

    from core.database import engine

    url = engine.url
    safe = (
        url.render_as_string(hide_password=True)
        if isinstance(url, EngineURL)
        else str(url)
    )
    print(f"Env file : {env_loaded}")
    print(f"Database : {safe}")
    with engine.connect() as conn:
        db_name = conn.execute(text("SELECT current_database()")).scalar()
        count = conn.execute(text("SELECT COUNT(*) FROM servers")).scalar()
        print(f"DB name  : {db_name}")
        print(f"  servers: {count} rows")


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description=(
            "Insert mock servers into the servers table for Server Clients UI testing."
        ),
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument(
        "--count",
        "-n",
        type=int,
        default=10,
        metavar="N",
        help="Number of servers to create (default: 10).",
    )
    parser.add_argument(
        "--prefix",
        default="server-",
        help="Hostname prefix; names become PREFIX001, PREFIX002, … (default: server-).",
    )
    parser.add_argument(
        "--start",
        type=int,
        default=None,
        metavar="N",
        help=(
            "Starting index (default: 1, or next free index after existing "
            "prefixNNN hostnames when omitted)."
        ),
    )
    parser.add_argument(
        "--random",
        action="store_true",
        help="Pick OS/hardware values randomly (CLI overrides still apply).",
    )
    parser.add_argument(
        "--seed",
        type=int,
        default=None,
        help="RNG seed for reproducible --random runs.",
    )
    parser.add_argument(
        "--ram",
        type=int,
        default=None,
        metavar="MB",
        help=f"RAM in MB (default: {_DEFAULT_RAM_MB}, or random with --random).",
    )
    parser.add_argument(
        "--cpus",
        type=int,
        default=None,
        metavar="N",
        help=f"CPU / processor count (default: {_DEFAULT_CPUS}, or random).",
    )
    parser.add_argument(
        "--disks",
        type=int,
        default=None,
        metavar="N",
        help=f"Disk / real-mount count (default: {_DEFAULT_DISKS}, or random).",
    )
    parser.add_argument(
        "--os-family",
        default=None,
        help=f"OS family, e.g. Debian, RedHat (default: {_DEFAULT_OS_FAMILY}).",
    )
    parser.add_argument(
        "--distribution",
        default=None,
        help=f"Distribution name, e.g. Ubuntu, Debian (default: {_DEFAULT_DISTRIBUTION}).",
    )
    parser.add_argument(
        "--distribution-release",
        default=None,
        help=f"Distribution release codename/id (default: {_DEFAULT_DIST_RELEASE}).",
    )
    parser.add_argument(
        "--distribution-version",
        default=None,
        help=f"Distribution version string (default: {_DEFAULT_DIST_VERSION}).",
    )
    parser.add_argument(
        "--architecture",
        default=None,
        help=f"CPU architecture (default: {_DEFAULT_ARCH}).",
    )
    parser.add_argument(
        "--virtual",
        dest="is_virtual",
        action="store_true",
        default=None,
        help="Mark servers as virtual (VMs).",
    )
    parser.add_argument(
        "--physical",
        dest="is_virtual",
        action="store_false",
        help="Mark servers as physical (not VMs).",
    )
    parser.add_argument(
        "--ip-base",
        type=_parse_ip_base,
        default=_parse_ip_base("10.50.0"),
        metavar="A.B.C",
        help="IPv4 /24 base for sequential primary_ipv4 (default: 10.50.0).",
    )
    parser.add_argument(
        "--interface",
        default="eth0",
        help="Primary interface name (default: eth0).",
    )
    parser.add_argument(
        "--clear-prefix",
        action="store_true",
        help="Delete existing servers whose hostname starts with --prefix first.",
    )
    parser.add_argument(
        "--env-file",
        type=Path,
        default=None,
        help="Path to dotenv file (default: backend/.env, then .env.test).",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print what would be created without writing to the database.",
    )
    return parser


def main() -> None:
    parser = _build_parser()
    args = parser.parse_args()

    if args.count < 1:
        parser.error("--count must be >= 1")
    if args.ram is not None and args.ram < 1:
        parser.error("--ram must be >= 1")
    if args.cpus is not None and args.cpus < 1:
        parser.error("--cpus must be >= 1")
    if args.disks is not None and args.disks < 0:
        parser.error("--disks must be >= 0")
    if args.start is not None and args.start < 1:
        parser.error("--start must be >= 1")
    if not args.prefix:
        parser.error("--prefix must not be empty")

    env_loaded = _load_env(args.env_file)
    rng = random.Random(args.seed)

    from models.servers import CreateServerRequest
    from service_factory import build_servers_service

    service = build_servers_service()

    print("=== Before ===")
    _print_db_info(env_loaded)
    print()

    if args.clear_prefix:
        if args.dry_run:
            matching = [
                s.hostname
                for s in service.get_all()
                if (s.hostname or "").startswith(args.prefix)
            ]
            print(
                f"[dry-run] would delete {len(matching)} server(s) "
                f"with prefix {args.prefix!r}"
            )
            for name in matching:
                print(f"  would delete {name}")
        else:
            print(f"Clearing servers with prefix {args.prefix!r}...")
            n = _delete_by_prefix(args.prefix, service)
            print(f"Deleted {n} server(s).\n")

    start = (
        args.start if args.start is not None else _next_free_start(args.prefix, service)
    )
    width = _pad_width(args.count, start)

    print(
        f"{'[dry-run] ' if args.dry_run else ''}"
        f"Creating {args.count} server(s): "
        f"{_hostname(args.prefix, start, width)} … "
        f"{_hostname(args.prefix, start + args.count - 1, width)}"
        f" ({'random' if args.random else 'fixed'} profile)"
    )

    created = 0
    skipped = 0
    for offset in range(args.count):
        index = start + offset
        hostname = _hostname(args.prefix, index, width)
        (
            os_family,
            distribution,
            dist_release,
            dist_version,
            arch,
            ram,
            cpus,
            disks,
            is_virtual,
        ) = _resolve_profile(args, rng)

        primary_ipv4 = _ipv4_for_index(args.ip_base, index)
        facts = _build_ansible_facts(
            hostname=hostname,
            os_family=os_family,
            distribution=distribution,
            processor_count=cpus,
            memtotal_mb=ram,
            architecture=arch,
            distribution_release=dist_release,
            distribution_version=dist_version,
            primary_ipv4=primary_ipv4,
            primary_interface=args.interface,
            disk_count=disks,
            is_virtual=is_virtual,
            rng=rng,
        )
        mounts = facts["ansible_facts"]["mounts"]
        disk_total_gb = (
            math.ceil(sum(int(m.get("size_total") or 0) for m in mounts) / _GB)
            if mounts
            else None
        )
        if disk_total_gb == 0:
            disk_total_gb = None

        total_bytes = sum(int(m.get("size_total") or 0) for m in mounts)
        avail_bytes = sum(int(m.get("size_available") or 0) for m in mounts)
        disk_usage_pct: Optional[int] = None
        if total_bytes > 0:
            used = max(0, total_bytes - min(avail_bytes, total_bytes))
            disk_usage_pct = min(100, math.ceil(used * 100 / total_bytes))

        summary = (
            f"{hostname}  ip={primary_ipv4}  "
            f"os={os_family}/{distribution}/{dist_release}/{dist_version}  "
            f"cpu={cpus}  ram={ram}MB  disks={disks}  "
            f"disk_gb={disk_total_gb}  usage={disk_usage_pct}%  "
            f"arch={arch}  virtual={is_virtual}"
        )

        if args.dry_run:
            print(f"  [dry-run] {summary}")
            created += 1
            continue

        if service.get_by_hostname(hostname) is not None:
            print(f"  skip (exists): {hostname}")
            skipped += 1
            continue

        req = CreateServerRequest(
            hostname=hostname,
            primary_ipv4=primary_ipv4,
            primary_interface=args.interface,
            os_family=os_family,
            processor_count=cpus,
            memtotal_mb=ram,
            disk_count=disks,
            disk_total_gb=disk_total_gb,
            disk_usage_pct=disk_usage_pct,
            architecture=arch,
            distribution=distribution,
            distribution_release=dist_release,
            distribution_version=dist_version,
            is_virtual=is_virtual,
            ansible_facts=facts,
        )
        server = service.create(req)
        print(f"  + id={server.id}  {summary}")
        created += 1

    print()
    print(
        f"Done. {'Would create' if args.dry_run else 'Created'} {created}"
        f"{'' if args.dry_run else f', skipped {skipped} existing'}."
    )
    if not args.dry_run:
        print()
        print("=== After ===")
        _print_db_info(env_loaded)


if __name__ == "__main__":
    main()
