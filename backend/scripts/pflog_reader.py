#!/usr/bin/env python3
"""
Convert OpenBSD pf log CSV fields to human-readable form.

Reads a CSV with:
  - src/dst as unsigned 32-bit integers → dotted-quad IPv4 (e.g. 192.168.0.1)
  - timestamp as Unix epoch seconds → YYYY-MM-DD hh:mm:ss (local time)
  - proto as IP protocol number → name for known values (ip/tcp/udp)

With --deduplicate, rows that share the same src, dst, sport, and dport are
collapsed to a single line with a count column appended.

Use --source for a single file, or --source-dir for a directory / glob of
CSV files merged into one destination.
"""

from __future__ import annotations

import argparse
import csv
import glob
import ipaddress
import sys
from datetime import datetime
from pathlib import Path


IP_COLUMNS = ("src", "dst")
REQUIRED_COLUMNS = ("src", "dst", "timestamp")
DEDUP_COLUMNS = ("src", "dst", "sport", "dport")
COUNT_COLUMN = "count"
TIMESTAMP_FORMAT = "%Y-%m-%d %H:%M:%S"

# OpenBSD / IANA IP protocol numbers commonly seen in pf logs.
# See: /etc/protocols, https://www.iana.org/assignments/protocol-numbers
PROTO_NAMES = {
    0: "ip",
    1: "icmp",
    2: "igmp",
    4: "ipencap",
    6: "tcp",
    8: "egp",
    12: "pup",
    17: "udp",
    22: "idp",
    29: "tp",
    33: "dccp",
    41: "ipv6",
    43: "ipv6-route",
    44: "ipv6-frag",
    46: "rsvp",
    47: "gre",
    50: "esp",
    51: "ah",
    58: "ipv6-icmp",
    59: "ipv6-nonxt",
    60: "ipv6-opts",
    89: "ospf",
    103: "pim",
    108: "ipcomp",
    112: "vrrp",
    115: "l2tp",
    132: "sctp",
    136: "udplite",
    137: "mpls-in-ip",
}


def int_to_dotted_quad(value: str) -> str:
    """Convert a pf log integer IP string to dotted-quad IPv4."""
    text = value.strip()
    if not text:
        return value
    try:
        return str(ipaddress.IPv4Address(int(text)))
    except (ValueError, ipaddress.AddressValueError):
        # Already dotted-quad, or not a convertible integer — leave as-is.
        return value


def epoch_to_datetime(value: str) -> str:
    """Convert a Unix epoch seconds string to YYYY-MM-DD hh:mm:ss."""
    text = value.strip()
    if not text:
        return value
    try:
        return datetime.fromtimestamp(int(text)).strftime(TIMESTAMP_FORMAT)
    except (ValueError, OSError, OverflowError):
        # Already formatted, or not a convertible integer — leave as-is.
        return value


def proto_to_name(value: str) -> str:
    """Convert a known IP protocol number to its name; leave others unchanged."""
    text = value.strip()
    if not text:
        return value
    try:
        return PROTO_NAMES.get(int(text), value)
    except ValueError:
        return value


def convert_row(row: dict[str, str]) -> dict[str, str]:
    converted = dict(row)
    for column in IP_COLUMNS:
        if column in converted and converted[column] is not None:
            converted[column] = int_to_dotted_quad(converted[column])
    if "timestamp" in converted and converted["timestamp"] is not None:
        converted["timestamp"] = epoch_to_datetime(converted["timestamp"])
    if "proto" in converted and converted["proto"] is not None:
        converted["proto"] = proto_to_name(converted["proto"])
    return converted


def deduplicate_rows(rows: list[dict[str, str]]) -> list[dict[str, str]]:
    """Collapse rows with equal src/dst/sport/dport; keep first row + count."""
    groups: dict[tuple[str, str, str, str], dict[str, str]] = {}
    counts: dict[tuple[str, str, str, str], int] = {}

    for row in rows:
        key = tuple(row.get(column, "") for column in DEDUP_COLUMNS)
        if key not in groups:
            groups[key] = dict(row)
            counts[key] = 1
        else:
            counts[key] += 1

    result: list[dict[str, str]] = []
    for key, row in groups.items():
        row[COUNT_COLUMN] = str(counts[key])
        result.append(row)
    return result


def resolve_source_dir(source_dir: str) -> list[Path]:
    """Resolve a directory or glob pattern to a sorted list of CSV files."""
    path = Path(source_dir)
    if path.is_dir():
        files = sorted(p for p in path.glob("*.csv") if p.is_file())
    else:
        files = sorted(Path(match) for match in glob.glob(source_dir) if Path(match).is_file())

    if not files:
        raise ValueError(f"No CSV files found for --source-dir {source_dir}")
    return files


def read_converted_rows(
    source: Path,
    *,
    deduplicate: bool,
) -> tuple[list[str], list[dict[str, str]]]:
    """Read one CSV file and return (fieldnames, converted rows)."""
    with source.open(newline="") as infile:
        reader = csv.DictReader(infile)
        if reader.fieldnames is None:
            raise ValueError(f"No CSV header found in {source}")

        required = list(REQUIRED_COLUMNS)
        if deduplicate:
            required.extend(col for col in DEDUP_COLUMNS if col not in required)

        missing = [col for col in required if col not in reader.fieldnames]
        if missing:
            raise ValueError(
                f"Missing required column(s) in {source}: {', '.join(missing)}"
            )

        fieldnames = list(reader.fieldnames)
        rows = [convert_row(row) for row in reader]

    return fieldnames, rows


def convert_files(
    sources: list[Path],
    destination: Path,
    *,
    deduplicate: bool = False,
) -> int:
    all_rows: list[dict[str, str]] = []
    fieldnames: list[str] | None = None

    for source in sources:
        source_fields, rows = read_converted_rows(source, deduplicate=deduplicate)
        if fieldnames is None:
            fieldnames = source_fields
        elif source_fields != fieldnames:
            raise ValueError(
                f"CSV header mismatch in {source}: "
                f"expected {fieldnames}, got {source_fields}"
            )
        all_rows.extend(rows)

    if fieldnames is None:
        raise ValueError("No source files to convert")

    if deduplicate:
        all_rows = deduplicate_rows(all_rows)
        if COUNT_COLUMN not in fieldnames:
            fieldnames = [*fieldnames, COUNT_COLUMN]

    destination.parent.mkdir(parents=True, exist_ok=True)
    with destination.open("w", newline="") as outfile:
        writer = csv.DictWriter(outfile, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(all_rows)

    return len(all_rows)


def main() -> int:
    parser = argparse.ArgumentParser(
        description=(
            "Convert OpenBSD pf log CSV integer IPs and epoch timestamps "
            "to human-readable form"
        )
    )
    source_group = parser.add_mutually_exclusive_group(required=True)
    source_group.add_argument(
        "--source",
        type=Path,
        help="Input CSV file path",
    )
    source_group.add_argument(
        "--source-dir",
        help=(
            "Directory of CSV files, or a glob pattern (quote globs, e.g. "
            "'/tmp/*.csv'); all matching files are merged into --destination"
        ),
    )
    parser.add_argument(
        "--destination",
        type=Path,
        required=True,
        help="Output CSV file path",
    )
    parser.add_argument(
        "--deduplicate",
        action="store_true",
        help=(
            "Collapse rows with equal src, dst, sport, and dport into one line "
            "and append a count column"
        ),
    )
    args = parser.parse_args()

    try:
        if args.source is not None:
            if not args.source.is_file():
                print(f"error: source file not found: {args.source}", file=sys.stderr)
                return 1
            sources = [args.source]
        else:
            sources = resolve_source_dir(args.source_dir)

        count = convert_files(
            sources,
            args.destination,
            deduplicate=args.deduplicate,
        )
    except (OSError, ValueError, csv.Error) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1

    print(f"Merged {len(sources)} file(s), wrote {count} row(s) to {args.destination}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
