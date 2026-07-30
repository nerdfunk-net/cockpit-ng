#!/usr/bin/env python3
"""
Convert OpenBSD pf log CSV fields to human-readable form.

Streams input line-by-line so large files (multi-GB) fit in memory.

Reads a CSV with:
  - src/dst as unsigned 32-bit integers → dotted-quad IPv4 (e.g. 192.168.0.1)
  - timestamp as Unix epoch seconds → YYYY-MM-DD hh:mm:ss (local time)
  - proto as IP protocol number → name for known values

With --deduplicate, rows that share the same src, dst, sport, and dport are
collapsed via an on-disk external sort (chunked), then counted while merging.

Use --source for a single file, or --source-dir for a directory / glob of
CSV files merged into one destination.
"""

from __future__ import annotations

import argparse
import csv
import glob
import heapq
import sys
import tempfile
from datetime import datetime
from pathlib import Path
from typing import Iterator


IP_COLUMNS = ("src", "dst")
REQUIRED_COLUMNS = ("src", "dst", "timestamp")
DEDUP_COLUMNS = ("src", "dst", "sport", "dport")
COUNT_COLUMN = "count"
TIMESTAMP_FORMAT = "%Y-%m-%d %H:%M:%S"
DEFAULT_CHUNK_ROWS = 200_000
PROGRESS_EVERY = 1_000_000
MAX_MERGE_OPEN = 64

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
        n = int(text)
    except ValueError:
        return value
    if n < 0 or n > 0xFFFFFFFF:
        return value
    return f"{(n >> 24) & 255}.{(n >> 16) & 255}.{(n >> 8) & 255}.{n & 255}"


def epoch_to_datetime(value: str) -> str:
    """Convert a Unix epoch seconds string to YYYY-MM-DD hh:mm:ss."""
    text = value.strip()
    if not text:
        return value
    try:
        return datetime.fromtimestamp(int(text)).strftime(TIMESTAMP_FORMAT)
    except (ValueError, OSError, OverflowError):
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


def resolve_source_dir(source_dir: str) -> list[Path]:
    """Resolve a directory or glob pattern to a sorted list of CSV files."""
    path = Path(source_dir)
    if path.is_dir():
        files = sorted(p for p in path.glob("*.csv") if p.is_file())
    else:
        files = sorted(
            Path(match) for match in glob.glob(source_dir) if Path(match).is_file()
        )

    if not files:
        raise ValueError(f"No CSV files found for --source-dir {source_dir}")
    return files


def validate_header(fieldnames: list[str], *, deduplicate: bool, source: Path) -> None:
    required = list(REQUIRED_COLUMNS)
    if deduplicate:
        required.extend(col for col in DEDUP_COLUMNS if col not in required)
    missing = [col for col in required if col not in fieldnames]
    if missing:
        raise ValueError(
            f"Missing required column(s) in {source}: {', '.join(missing)}"
        )


def column_indices(fieldnames: list[str]) -> dict[str, int]:
    return {name: idx for idx, name in enumerate(fieldnames)}


def convert_row_inplace(row: list[str], indices: dict[str, int]) -> None:
    for column in IP_COLUMNS:
        idx = indices.get(column)
        if idx is not None and idx < len(row):
            row[idx] = int_to_dotted_quad(row[idx])

    idx = indices.get("timestamp")
    if idx is not None and idx < len(row):
        row[idx] = epoch_to_datetime(row[idx])

    idx = indices.get("proto")
    if idx is not None and idx < len(row):
        row[idx] = proto_to_name(row[idx])


def dedup_key(row: list[str], indices: dict[str, int]) -> tuple[str, str, str, str]:
    return (
        row[indices["src"]] if indices["src"] < len(row) else "",
        row[indices["dst"]] if indices["dst"] < len(row) else "",
        row[indices["sport"]] if indices["sport"] < len(row) else "",
        row[indices["dport"]] if indices["dport"] < len(row) else "",
    )


def iter_source_rows(
    sources: list[Path],
    *,
    deduplicate: bool,
) -> tuple[list[str], dict[str, int], Iterator[list[str]]]:
    """
    Stream converted rows from one or more CSV sources.

    Opens files lazily inside the iterator so only one input file is read at a time.
    """
    first = sources[0]
    with first.open(newline="") as probe:
        reader = csv.reader(probe)
        try:
            fieldnames = next(reader)
        except StopIteration as exc:
            raise ValueError(f"No CSV header found in {first}") from exc

    validate_header(fieldnames, deduplicate=deduplicate, source=first)
    indices = column_indices(fieldnames)

    def rows() -> Iterator[list[str]]:
        seen = 0
        for source in sources:
            with source.open(newline="") as infile:
                reader = csv.reader(infile)
                try:
                    header = next(reader)
                except StopIteration as exc:
                    raise ValueError(f"No CSV header found in {source}") from exc

                if header != fieldnames:
                    raise ValueError(
                        f"CSV header mismatch in {source}: "
                        f"expected {fieldnames}, got {header}"
                    )

                for row in reader:
                    if not row:
                        continue
                    convert_row_inplace(row, indices)
                    seen += 1
                    if seen % PROGRESS_EVERY == 0:
                        print(f"Processed {seen:,} rows...", file=sys.stderr)
                    yield row

    return fieldnames, indices, rows()


def write_streaming(
    sources: list[Path],
    destination: Path,
    *,
    deduplicate: bool,
) -> int:
    fieldnames, _indices, rows = iter_source_rows(sources, deduplicate=deduplicate)

    destination.parent.mkdir(parents=True, exist_ok=True)
    written = 0
    with destination.open("w", newline="") as outfile:
        writer = csv.writer(outfile)
        writer.writerow(fieldnames)
        for row in rows:
            writer.writerow(row)
            written += 1
    return written


def write_sorted_chunk(
    chunk: list[list[str]],
    indices: dict[str, int],
    path: Path,
) -> None:
    chunk.sort(key=lambda row: dedup_key(row, indices))
    with path.open("w", newline="") as outfile:
        writer = csv.writer(outfile)
        writer.writerows(chunk)


def iter_csv_rows(path: Path) -> Iterator[list[str]]:
    with path.open(newline="") as infile:
        reader = csv.reader(infile)
        yield from reader


def merge_sorted_chunks(
    chunk_paths: list[Path],
    indices: dict[str, int],
    tmp: Path,
) -> Iterator[list[str]]:
    """K-way merge of sorted chunks, batching to avoid open-file limits."""
    paths = list(chunk_paths)
    stage = 0
    while len(paths) > MAX_MERGE_OPEN:
        next_paths: list[Path] = []
        for start in range(0, len(paths), MAX_MERGE_OPEN):
            batch = paths[start : start + MAX_MERGE_OPEN]
            out_path = tmp / f"merge_{stage}_{start:05d}.csv"
            with out_path.open("w", newline="") as outfile:
                writer = csv.writer(outfile)
                merged = heapq.merge(
                    *(iter_csv_rows(path) for path in batch),
                    key=lambda row: dedup_key(row, indices),
                )
                writer.writerows(merged)
            next_paths.append(out_path)
        paths = next_paths
        stage += 1

    return heapq.merge(
        *(iter_csv_rows(path) for path in paths),
        key=lambda row: dedup_key(row, indices),
    )


def write_deduplicated(
    sources: list[Path],
    destination: Path,
    *,
    chunk_rows: int,
) -> int:
    """
    Deduplicate using chunked external sort so memory stays near one chunk.

    1. Stream-convert input into sorted temp chunks.
    2. Merge chunks with heapq.merge (batched if needed).
    3. Collapse consecutive equal keys and write count.
    """
    fieldnames, indices, rows = iter_source_rows(sources, deduplicate=True)
    out_fieldnames = [*fieldnames, COUNT_COLUMN]

    destination.parent.mkdir(parents=True, exist_ok=True)

    with tempfile.TemporaryDirectory(prefix="pflog_reader_") as tmpdir:
        tmp = Path(tmpdir)
        chunk_paths: list[Path] = []
        chunk: list[list[str]] = []

        for row in rows:
            chunk.append(row)
            if len(chunk) >= chunk_rows:
                path = tmp / f"chunk_{len(chunk_paths):05d}.csv"
                write_sorted_chunk(chunk, indices, path)
                chunk_paths.append(path)
                chunk = []

        if chunk:
            path = tmp / f"chunk_{len(chunk_paths):05d}.csv"
            write_sorted_chunk(chunk, indices, path)
            chunk_paths.append(path)

        if not chunk_paths:
            with destination.open("w", newline="") as outfile:
                writer = csv.writer(outfile)
                writer.writerow(out_fieldnames)
            return 0

        merged = merge_sorted_chunks(chunk_paths, indices, tmp)

        written = 0
        with destination.open("w", newline="") as outfile:
            writer = csv.writer(outfile)
            writer.writerow(out_fieldnames)

            current_row: list[str] | None = None
            current_key: tuple[str, str, str, str] | None = None
            current_count = 0

            for row in merged:
                key = dedup_key(row, indices)
                if current_key is None:
                    current_row = row
                    current_key = key
                    current_count = 1
                elif key == current_key:
                    current_count += 1
                else:
                    assert current_row is not None
                    writer.writerow([*current_row, str(current_count)])
                    written += 1
                    current_row = row
                    current_key = key
                    current_count = 1

            if current_row is not None:
                writer.writerow([*current_row, str(current_count)])
                written += 1

        return written


def convert_files(
    sources: list[Path],
    destination: Path,
    *,
    deduplicate: bool = False,
    chunk_rows: int = DEFAULT_CHUNK_ROWS,
) -> int:
    if deduplicate:
        return write_deduplicated(sources, destination, chunk_rows=chunk_rows)
    return write_streaming(sources, destination, deduplicate=False)


def main() -> int:
    parser = argparse.ArgumentParser(
        description=(
            "Convert OpenBSD pf log CSV integer IPs and epoch timestamps "
            "to human-readable form (streams line-by-line for large files)"
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
            "and append a count column (uses on-disk external sort)"
        ),
    )
    parser.add_argument(
        "--chunk-rows",
        type=int,
        default=DEFAULT_CHUNK_ROWS,
        help=(
            f"Rows per sort chunk when using --deduplicate "
            f"(default: {DEFAULT_CHUNK_ROWS}; lower this if RAM is tight)"
        ),
    )
    args = parser.parse_args()

    if args.chunk_rows < 1:
        print("error: --chunk-rows must be >= 1", file=sys.stderr)
        return 1

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
            chunk_rows=args.chunk_rows,
        )
    except (OSError, ValueError, csv.Error) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1

    print(
        f"Merged {len(sources)} file(s), wrote {count} row(s) to {args.destination}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
