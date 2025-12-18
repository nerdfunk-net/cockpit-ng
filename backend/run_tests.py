"""
Test runner script for Cockpit-NG backend tests.

Usage:
    python run_tests.py              # Run all tests
    python run_tests.py unit         # Run only unit tests
    python run_tests.py integration  # Run only integration tests
    python run_tests.py --coverage   # Run with coverage report
"""

import sys
import subprocess
from pathlib import Path


def run_tests(test_type: str = "all", coverage: bool = True):
    """
    Run pytest tests with specified options.

    Args:
        test_type: Type of tests to run ('all', 'unit', 'integration')
        coverage: Whether to generate coverage report
    """
    cmd = ["pytest"]

    if test_type == "unit":
        cmd.extend(["-m", "unit"])
        print("Running unit tests only...")
    elif test_type == "integration":
        cmd.extend(["-m", "integration"])
        print("Running integration tests only...")
    else:
        print("Running all tests...")

    if not coverage:
        cmd.extend(["--no-cov"])

    # Run pytest
    result = subprocess.run(cmd, cwd=Path(__file__).parent)

    if result.returncode == 0:
        print("\n✅ All tests passed!")
        if coverage:
            print(
                f"\n📊 Coverage report: {Path(__file__).parent / 'htmlcov' / 'index.html'}"
            )
    else:
        print("\n❌ Some tests failed!")
        sys.exit(1)


if __name__ == "__main__":
    test_type = "all"
    coverage = True

    if len(sys.argv) > 1:
        if sys.argv[1] in ["unit", "integration"]:
            test_type = sys.argv[1]
        elif sys.argv[1] == "--no-coverage":
            coverage = False

    run_tests(test_type, coverage)
