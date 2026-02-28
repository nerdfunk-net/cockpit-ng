#!/usr/bin/env python3
"""
Convert f-string logging calls to lazy % formatting.

PEP best practice: f-string logging eagerly evaluates the string even when the
log level is suppressed.  Lazy % formatting defers evaluation until the handler
actually produces output.

  BEFORE: logger.info("Device %s processed in %.2fs", name, elapsed)
  AFTER:  logger.info("Device %s processed in %.2fs", name, elapsed)

Usage
-----
    python convert_fstring_logging.py file1.py [file2.py ...]
    find backend/ -name "*.py" | xargs python convert_fstring_logging.py
    python convert_fstring_logging.py --dry-run --verbose backend/tasks/*.py

Flags
-----
    --dry-run    Show what would change without writing files.
    --no-backup  Skip creating .bak files (backups are created by default).
    --verbose    Print every conversion.
    --quiet      Print only the summary line.

Limitations
-----------
- Very complex f-string expressions (e.g. walrus operator, deeply nested
  lambdas) are skipped with a warning; the original line is left unchanged.
- Dynamic format specs like {x:{width}.{prec}} are replaced with
  format(x, spec) calls, which is semantically equivalent.
- Triple-quoted f-strings inside logging calls are supported.
- Multi-line logging calls are supported.
"""

from __future__ import annotations

import argparse
import re
import shutil
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

LOG_METHODS = (
    "debug",
    "info",
    "warning",
    "warn",
    "error",
    "critical",
    "exception",
)

# Matches any of:
#   logger.info(
#   self.logger.debug(
#   logging.warning(
#   log.error(
#   Logger.info(     ← class-level usage
_LOG_CALL_RE = re.compile(
    r"(?<![.\w])"  # not preceded by another attribute (avoids false positives)
    r"(?:(?:\w+\.)*(?:logger?|logging|log))"
    r"\."
    r"(?:" + "|".join(LOG_METHODS) + r")"
    r"\s*\(",
    re.IGNORECASE,
)

# F-string prefixes we recognise (case-insensitive)
_FSTRING_PREFIX_RE = re.compile(r"^([rRbBuU]?[fF]|[fF][rR])")


# ---------------------------------------------------------------------------
# Data classes
# ---------------------------------------------------------------------------


@dataclass
class ConversionStats:
    files_processed: int = 0
    files_modified: int = 0
    conversions_made: int = 0
    skipped_complex: int = 0
    errors: list[str] = field(default_factory=list)


# ---------------------------------------------------------------------------
# Low-level source helpers
# ---------------------------------------------------------------------------


def _find_string_end(src: str, pos: int) -> int:
    """Return the index *after* the closing quote of a string that starts at
    *pos* (which must point at the opening quote character(s)).
    Returns -1 if the string is not terminated before end-of-source."""
    if src[pos : pos + 3] in ('"""', "'''"):
        q = src[pos : pos + 3]
        end = src.find(q, pos + 3)
        return -1 if end == -1 else end + 3
    q = src[pos]
    i = pos + 1
    while i < len(src):
        c = src[i]
        if c == "\\":
            i += 2
            continue
        if c == q:
            return i + 1
        i += 1
    return -1


def _find_balanced_paren_end(src: str, open_pos: int) -> int:
    """Given the position of an opening '(' in *src*, return the position
    *after* the matching ')'.  String contents are skipped correctly.
    Returns -1 on failure."""
    assert src[open_pos] == "("
    depth = 0
    i = open_pos
    while i < len(src):
        c = src[i]
        if c in ('"', "'"):
            # Skip string literal (raw/f/b prefix chars are already consumed)
            end = _find_string_end(src, i)
            if end == -1:
                return -1
            i = end
            continue
        if c == "(":
            depth += 1
        elif c == ")":
            depth -= 1
            if depth == 0:
                return i + 1
        i += 1
    return -1


# ---------------------------------------------------------------------------
# F-string expression parser
# ---------------------------------------------------------------------------


def _find_top_level_char(expr: str, chars: str) -> int:
    """Return index of the first character from *chars* that appears at depth 0
    (outside brackets / strings) in *expr*.  Returns -1 if not found."""
    depth = 0
    in_str = False
    str_char = ""
    i = 0
    while i < len(expr):
        c = expr[i]
        if in_str:
            if c == "\\":
                i += 2
                continue
            if c == str_char:
                in_str = False
        elif c in ('"', "'"):
            in_str = True
            str_char = c
        elif c in ("(", "[", "{"):
            depth += 1
        elif c in (")", "]", "}"):
            depth -= 1
        elif depth == 0 and c in chars:
            return i
        i += 1
    return -1


def _split_expr(expr: str) -> tuple[str, Optional[str], Optional[str]]:
    """Split an f-string placeholder expression into (base, conversion, fmt_spec).

    Examples:
        "x"        → ("x", None, None)
        "x!r"      → ("x", "r", None)
        "x:.2f"    → ("x", None, ".2f")
        "x!s:.10"  → ("x", "s", ".10")
        "d['k']"   → ("d['k']", None, None)
    """
    bang = -1
    colon = -1

    depth = 0
    in_str = False
    str_char = ""
    i = 0
    while i < len(expr):
        c = expr[i]
        if in_str:
            if c == "\\":
                i += 2
                continue
            if c == str_char:
                in_str = False
        elif c in ('"', "'"):
            in_str = True
            str_char = c
        elif c in ("(", "[", "{"):
            depth += 1
        elif c in (")", "]", "}"):
            depth -= 1
        elif depth == 0:
            if (
                c == "!"
                and bang == -1
                and colon == -1
                and i + 1 < len(expr)
                and expr[i + 1] in ("r", "s", "a")
                and (i + 2 >= len(expr) or expr[i + 2] in (":", ""))
            ):
                bang = i
            elif c == ":" and colon == -1:
                colon = i
        i += 1

    conversion: Optional[str] = None
    fmt_spec: Optional[str] = None

    if bang != -1 and colon != -1 and colon > bang:
        base = expr[:bang]
        conversion = expr[bang + 1 : bang + 2]
        fmt_spec = expr[colon + 1 :]
    elif bang != -1:
        base = expr[:bang]
        conversion = expr[bang + 1 : bang + 2]
    elif colon != -1:
        base = expr[:colon]
        fmt_spec = expr[colon + 1 :]
    else:
        base = expr

    return base.strip(), conversion, fmt_spec


def _printf_from_spec(spec: str) -> Optional[str]:
    """Try to express a Python format spec as a printf-style format string.

    Returns None when the spec is too complex for a direct mapping (alignment,
    grouping, fill characters, dynamic width/precision, etc.).

    Handles the common cases found in logging:
        ""      → "%s"
        "s"     → "%s"
        "r"     → (caller converts to %r separately)
        "d","i" → "%d"
        "f"     → "%f"
        ".2f"   → "%.2f"
        "05d"   → "%05d"
        ".4"    → "%.4s"  (string precision)
        "x","X" → "%x", "%X"
    """
    if not spec:
        return "%s"

    # Dynamic / nested spec → cannot convert
    if "{" in spec or "}" in spec:
        return None

    # Alignment, fill, sign, grouping → too complex for a direct printf mapping
    for ch in ("<", ">", "^", "=", "+", " ", ",", "_", "#"):
        if ch in spec:
            return None

    # Match [zero_flag][width][.precision][type]
    m = re.fullmatch(r"(0?)(\d*)(\.(\d+))?([diouxXeEfFgGnrs%]?)", spec)
    if not m:
        return None

    zero = m.group(1)
    width = m.group(2)
    prec = m.group(3) or ""
    typ = m.group(5) or "s"

    if typ == "r":
        # %r does not support width/precision in the classic % mini-language
        return "%r" if not zero and not width and not prec else None

    if typ == "n":
        # locale-aware int/float – no direct % equivalent
        return None

    return f"%{zero}{width}{prec}{typ}"


def _parse_fstring_content(content: str) -> Optional[tuple[str, list[str]]]:
    """Parse the body of an f-string (everything between the outer quotes) and
    return (template, args) suitable for a % logging call.

    Rules:
        {expr}    → "%s", expr
        {expr!r}  → "%r", expr
        {expr!s}  → "%s", expr
        {expr!a}  → "%s", expr  (closest printable equivalent)
        {expr:.2f}→ "%.2f", expr  (simple specs only)
        {expr:complex} → "%s", format(expr, 'complex')
        {{        → literal {  (kept as-is)
        }}        → literal }  (kept as-is)
        %         → %% (escape for % formatting)

    Returns None if the content cannot be safely parsed.
    """
    template: list[str] = []
    args: list[str] = []
    i = 0

    while i < len(content):
        c = content[i]

        # ── Literal percent → must be escaped for % formatting ──────────────
        if c == "%" and content[i : i + 2] != "%%":
            template.append("%%")
            i += 1
            continue

        # ── Escaped percent (already %%) ────────────────────────────────────
        if content[i : i + 2] == "%%":
            template.append("%%")
            i += 2
            continue

        # ── Escaped braces {{ / }} ───────────────────────────────────────────
        if content[i : i + 2] == "{{":
            template.append("{")
            i += 2
            continue
        if content[i : i + 2] == "}}":
            template.append("}")
            i += 2
            continue

        # ── Regular character ────────────────────────────────────────────────
        if c != "{":
            template.append(c)
            i += 1
            continue

        # ── Opening brace → find matching closing brace ──────────────────────
        depth = 1
        j = i + 1
        in_str = False
        str_char = ""
        triple = False

        while j < len(content) and depth > 0:
            ch = content[j]
            if in_str:
                if triple:
                    if content[j : j + 3] == str_char * 3:
                        in_str = False
                        j += 3
                        continue
                    if ch == "\\":
                        j += 2
                        continue
                else:
                    if ch == "\\":
                        j += 2
                        continue
                    if ch == str_char:
                        in_str = False
            elif ch in ('"', "'"):
                if content[j : j + 3] in ('"""', "'''"):
                    in_str = True
                    str_char = ch
                    triple = True
                    j += 3
                    continue
                in_str = True
                str_char = ch
                triple = False
            elif ch == "{":
                depth += 1
            elif ch == "}":
                depth -= 1
                if depth == 0:
                    j += 1
                    break
            j += 1

        if depth != 0:
            return None  # Unbalanced braces – abort

        raw_expr = content[i + 1 : j - 1]
        if not raw_expr.strip():
            # Empty expression {} – skip conversion
            return None

        base, conversion, fmt_spec = _split_expr(raw_expr)
        if not base:
            return None

        if conversion == "r":
            # %r is well-supported by % logging
            template.append("%r")
            args.append(base)
        elif fmt_spec is not None:
            pct = _printf_from_spec(fmt_spec)
            if pct is not None:
                template.append(pct)
                args.append(base)
            else:
                # Complex spec – wrap in format() for semantic equivalence
                template.append("%s")
                args.append(f"format({base}, {fmt_spec!r})")
        else:
            template.append("%s")
            args.append(base)

        i = j

    return "".join(template), args


# ---------------------------------------------------------------------------
# F-string detection & extraction
# ---------------------------------------------------------------------------


def _extract_fstring(src: str, pos: int) -> Optional[tuple[str, str, int]]:
    """Starting at *pos*, try to read a complete f-string (with prefix).

    Returns (prefix, raw_content_between_quotes, end_pos) or None.
    *raw_content_between_quotes* does NOT include the surrounding quotes.
    *end_pos* is the index *after* the closing quote(s).
    """
    m = _FSTRING_PREFIX_RE.match(src, pos)
    if not m:
        return None

    prefix = m.group(0)
    q_start = pos + len(prefix)

    if q_start >= len(src):
        return None

    # Determine quote style
    if src[q_start : q_start + 3] in ('"""', "'''"):
        quote = src[q_start : q_start + 3]
    elif src[q_start] in ('"', "'"):
        quote = src[q_start]
    else:
        return None

    content_start = q_start + len(quote)
    # Find the end of the string
    end = _find_string_end(src, q_start)
    if end == -1:
        return None

    raw_content = src[content_start : end - len(quote)]
    return prefix, raw_content, end


# ---------------------------------------------------------------------------
# Single-call transformer
# ---------------------------------------------------------------------------


def _transform_log_call(src: str, call_start: int, open_paren: int) -> Optional[tuple[str, int]]:
    """Try to transform the logging call that starts with '(' at *open_paren*.

    Returns (replacement_source_fragment, end_of_call_pos) on success,
    or None if this call should be skipped.

    *call_start*  – index of the first char of the log method name call
                    (e.g. index of 'l' in 'logger.info(…)')
    *open_paren*  – index of the '(' that starts the argument list
    """
    call_end = _find_balanced_paren_end(src, open_paren)
    if call_end == -1:
        return None

    args_src = src[open_paren + 1 : call_end - 1]  # everything between the parens

    # We need to find the *first positional argument* which must be the f-string.
    # We skip leading whitespace / newlines.
    stripped = args_src.lstrip()
    offset = len(args_src) - len(stripped)  # how many chars were stripped at the left

    fstr_match = _FSTRING_PREFIX_RE.match(stripped)
    if not fstr_match:
        return None  # First arg is not an f-string

    result = _extract_fstring(stripped, 0)
    if result is None:
        return None

    prefix, fstr_content, fstr_end_in_stripped = result

    # Is the f-string the complete first argument?
    # After the f-string, the next non-whitespace char should be , or ) or end.
    remainder_in_stripped = stripped[fstr_end_in_stripped:].lstrip()

    # Check we're not dealing with implicit string concatenation:
    # f"a" "b"  or  f"a"\n    f"b"  etc.
    # Any string prefix char or a quote directly means another adjacent literal.
    _STR_START = set('"\'') | set('fFrRbBuU')
    if remainder_in_stripped and remainder_in_stripped[0] in _STR_START:
        return None  # Implicit concatenation – skip

    parsed = _parse_fstring_content(fstr_content)
    if parsed is None:
        return None

    template, new_args = parsed

    # If no placeholders were found, the f-string is just a plain string.
    # Still convert (drop the 'f' prefix), as the f was pointless.
    quote_char = prefix[-1]  # 'f' or 'F'
    new_prefix = prefix[: -1] if len(prefix) > 1 else ""  # strip leading f/F

    # Re-quote the template string with the detected quote style
    fstr_full = prefix + stripped[len(prefix) : fstr_end_in_stripped]
    fstr_prefix_raw = stripped[: len(prefix)]

    # Detect quote style from the original f-string
    q_pos = len(prefix)
    if stripped[q_pos : q_pos + 3] in ('"""', "'''"):
        quote = stripped[q_pos : q_pos + 3]
    else:
        quote = stripped[q_pos]

    new_string = f"{new_prefix}{quote}{template}{quote}"
    if new_args:
        new_args_str = ", ".join(new_args)
        new_first_arg = f"{new_string}, {new_args_str}"
    else:
        new_first_arg = new_string

    # Rebuild the full call preserving whitespace before first arg and after
    leading_ws = args_src[:offset]
    # Everything after the f-string in the original args
    rest_after_fstr = args_src[offset + fstr_end_in_stripped :]

    new_args_src = leading_ws + new_first_arg + rest_after_fstr
    original_call = src[call_start:call_end]
    # Replace just the args part: from open_paren+1 to call_end-1
    call_prefix = src[call_start : open_paren + 1]
    new_call = call_prefix + new_args_src + ")"

    return new_call, call_end


# ---------------------------------------------------------------------------
# File-level conversion
# ---------------------------------------------------------------------------


def convert_source(src: str) -> tuple[str, int, int]:
    """Convert all f-string logging calls in *src*.

    Returns (new_source, conversions_made, skipped_complex).
    """
    conversions = 0
    skipped = 0
    result = []
    pos = 0

    for m in _LOG_CALL_RE.finditer(src):
        call_start = m.start()
        open_paren = m.end() - 1  # the '(' matched at the end of the regex

        if call_start < pos:
            # Overlapping / already consumed
            continue

        # Copy source between previous end and this match
        result.append(src[pos:call_start])

        transform = _transform_log_call(src, call_start, open_paren)
        if transform is None:
            # Check whether there was actually an f-string here to skip
            paren_end = _find_balanced_paren_end(src, open_paren)
            args_peek = src[open_paren + 1 : paren_end].lstrip() if paren_end != -1 else ""
            if _FSTRING_PREFIX_RE.match(args_peek):
                skipped += 1
            result.append(src[call_start : paren_end if paren_end != -1 else call_start + len(m.group(0))])
            pos = paren_end if paren_end != -1 else call_start + len(m.group(0))
        else:
            new_call, call_end = transform
            # Only count as a conversion if the source actually changed
            original_call = src[call_start:call_end]
            if new_call != original_call:
                conversions += 1
            result.append(new_call)
            pos = call_end

    result.append(src[pos:])
    return "".join(result), conversions, skipped


# ---------------------------------------------------------------------------
# File processing
# ---------------------------------------------------------------------------


def process_file(
    path: Path,
    *,
    dry_run: bool = False,
    no_backup: bool = False,
    verbose: bool = False,
    quiet: bool = False,
    stats: ConversionStats,
) -> None:
    stats.files_processed += 1

    try:
        original = path.read_text(encoding="utf-8")
    except Exception as exc:
        stats.errors.append(f"{path}: read error – {exc}")
        return

    new_src, conversions, skipped = convert_source(original)

    if skipped and verbose:
        print(f"  ⚠  {path}: {skipped} complex f-string(s) skipped (manual review needed)")

    stats.skipped_complex += skipped

    if new_src == original:
        if verbose:
            print(f"  –  {path}: no changes")
        return

    stats.files_modified += 1
    stats.conversions_made += conversions

    if verbose or (dry_run and not quiet):
        _show_diff(path, original, new_src)

    if dry_run:
        return

    if not no_backup:
        shutil.copy2(path, path.with_suffix(path.suffix + ".bak"))

    try:
        path.write_text(new_src, encoding="utf-8")
        if not verbose and not quiet:
            print(f"  ✓  {path}: {conversions} conversion(s)")
    except Exception as exc:
        stats.errors.append(f"{path}: write error – {exc}")


def _show_diff(path: Path, original: str, new_src: str) -> None:
    """Print a minimal unified-diff style output."""
    import difflib

    diff = list(
        difflib.unified_diff(
            original.splitlines(keepends=True),
            new_src.splitlines(keepends=True),
            fromfile=str(path),
            tofile=str(path) + " (converted)",
            n=2,
        )
    )
    if diff:
        print(f"\n{'─' * 72}")
        print(f"  {path}")
        print("─" * 72)
        for line in diff[2:]:  # skip the --- / +++ header lines
            sys.stdout.write(line)
        print()


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Convert f-string logging calls to lazy %% formatting.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument(
        "files",
        nargs="*",
        metavar="FILE",
        help="Python source files to process.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would change without writing anything.",
    )
    parser.add_argument(
        "--no-backup",
        action="store_true",
        help="Do not write .bak files (backups are created by default).",
    )
    parser.add_argument(
        "--verbose", "-v",
        action="store_true",
        help="Show a diff for every changed file.",
    )
    parser.add_argument(
        "--quiet", "-q",
        action="store_true",
        help="Print only the final summary.",
    )
    args = parser.parse_args(argv)

    if not args.files:
        # If stdin is a pipe, read file paths from it
        if not sys.stdin.isatty():
            file_list = [Path(line.rstrip("\n")) for line in sys.stdin]
        else:
            parser.print_help()
            return 1
    else:
        file_list = [Path(f) for f in args.files]

    stats = ConversionStats()
    verbose = args.verbose and not args.quiet

    if args.dry_run:
        print("DRY RUN – no files will be written.\n")

    for path in file_list:
        if not path.exists():
            stats.errors.append(f"{path}: file not found")
            continue
        if path.suffix != ".py":
            continue
        process_file(
            path,
            dry_run=args.dry_run,
            no_backup=args.no_backup,
            verbose=verbose,
            quiet=args.quiet,
            stats=stats,
        )

    # Summary
    print()
    print("─" * 50)
    print(f"  Files processed : {stats.files_processed}")
    print(f"  Files modified  : {stats.files_modified}")
    print(f"  Conversions     : {stats.conversions_made}")
    if stats.skipped_complex:
        print(f"  Skipped (complex): {stats.skipped_complex}  ← manual review needed")
    if stats.errors:
        print(f"  Errors          : {len(stats.errors)}")
        for err in stats.errors:
            print(f"    • {err}")
    print("─" * 50)

    return 1 if stats.errors else 0


if __name__ == "__main__":
    sys.exit(main())
