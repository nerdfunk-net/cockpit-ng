#!/usr/bin/env python3
"""
Run the Get Data pipeline locally without Redis.

Uses the same executor as the agent (config.yaml → SSH/SFTP steps → result file).
Useful for testing SSH connectivity and debugging the pipeline before deploying.

Examples:
  ./run_local.py --flow data-1
  ./run_local.py --flow data-2 --config /path/to/config.yaml
  ./run_local.py --flow data-1 -v
  ./run_local.py --flow data-1 --content-only
"""

from __future__ import annotations

import argparse
import asyncio
import json
import logging
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Run the Get Data agent pipeline locally (no Redis)."
    )
    parser.add_argument(
        "--config",
        type=Path,
        default=SCRIPT_DIR / "config.yaml",
        help="Path to config.yaml (default: ./config.yaml in this directory)",
    )
    parser.add_argument(
        "--flow",
        required=True,
        help="Flow identifier from config.yaml commands section (e.g. data-1)",
    )
    parser.add_argument(
        "-v",
        "--verbose",
        action="store_true",
        help="Enable debug logging",
    )
    parser.add_argument(
        "--content-only",
        action="store_true",
        help="Print only the result file content on success",
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Print the full result as JSON",
    )
    return parser.parse_args()


def _print_result(result: dict, *, content_only: bool, as_json: bool) -> int:
    status = result.get("status")
    if status != "success":
        if as_json:
            print(json.dumps(result, indent=2, ensure_ascii=False), file=sys.stderr)
        else:
            print(f"Pipeline failed: {result.get('error')}", file=sys.stderr)
            steps = (result.get("output") or {}).get("steps") or []
            for index, step in enumerate(steps, start=1):
                if step.get("status") != "success":
                    print(
                        f"  Step {index} ({step.get('type')}): {step.get('error')}",
                        file=sys.stderr,
                    )
        return 1

    output = result.get("output") or {}
    result_data = output.get("result") or {}

    if content_only:
        if not result_data:
            print("Success but no result data in output", file=sys.stderr)
            return 1
        if len(result_data) == 1:
            content = next(iter(result_data.values()))
            print(content, end="" if content.endswith("\n") else "\n")
        else:
            print(json.dumps(result_data, indent=2, ensure_ascii=False))
        return 0

    if as_json:
        print(json.dumps(result, indent=2, ensure_ascii=False))
        return 0

    # Human-readable summary
    steps = output.get("steps") or []
    flow_id = output.get("flow_id", "?")
    print(f"Status: {status}")
    print(f"Flow: {flow_id}")
    print(f"Execution time: {result.get('execution_time_ms', 0)} ms")
    print(f"Steps: {len(steps)}")
    for index, step in enumerate(steps, start=1):
        step_type = step.get("type", "?")
        step_status = step.get("status", "?")
        print(f"  [{index}] {step_type}: {step_status}")
        if step_status != "success":
            print(f"       error: {step.get('error')}")

    if result_data:
        print()
        print("Result data:")
        for key, content in result_data.items():
            size_bytes = len(content.encode("utf-8"))
            print(f"  {key}: {size_bytes} bytes")
            print("-" * 40)
            print(content, end="" if not content or content.endswith("\n") else "\n")
            print("-" * 40)

    return 0


async def _run_pipeline(config_path: Path, flow_id: str) -> dict:
    from executor import CommandExecutor

    executor = CommandExecutor(config_path=config_path)
    return await executor.execute(flow_id, {})


def main() -> None:
    args = _parse_args()
    config_path = args.config.resolve()

    if not config_path.is_file():
        print(f"Config file not found: {config_path}", file=sys.stderr)
        sys.exit(1)

    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
        stream=sys.stdout,
    )

    from command_config import load_command_pipeline

    try:
        pipeline = load_command_pipeline(config_path)
        if args.flow not in pipeline.flows:
            available = ", ".join(pipeline.flows.keys()) or "(none)"
            print(
                f"Unknown flow {args.flow!r}. Available flows: {available}",
                file=sys.stderr,
            )
            sys.exit(1)
        flow = pipeline.flows[args.flow]
        logging.info(
            "Loaded flow %s with %d action step(s), result file: %s",
            args.flow,
            len(flow.steps),
            flow.result_file,
        )
    except Exception as exc:
        print(f"Invalid config: {exc}", file=sys.stderr)
        sys.exit(1)

    try:
        result = asyncio.run(_run_pipeline(config_path, args.flow))
    except KeyboardInterrupt:
        print("Interrupted", file=sys.stderr)
        sys.exit(130)
    except Exception as exc:
        logging.exception("Pipeline failed")
        print(f"Fatal error: {exc}", file=sys.stderr)
        sys.exit(1)

    exit_code = _print_result(
        result,
        content_only=args.content_only,
        as_json=args.json,
    )
    sys.exit(exit_code)


if __name__ == "__main__":
    main()
