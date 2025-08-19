#!/usr/bin/env python3
import sys
import traceback
from pathlib import Path

# Add the backend directory to Python path
backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))

try:
    print("Attempting to import main module...")
    import main
    print("Import successful!")

    print(f"\nRegistered routes ({len(main.app.routes)}):")
    for i, route in enumerate(main.app.routes):
        if hasattr(route, 'path'):
            methods = getattr(route, 'methods', 'N/A')
            print(f"  {i+1:2d}. {route.path} - {methods}")

    print(f"\nTotal routes: {len(main.app.routes)}")

except Exception as e:
    print(f"Import failed with error: {e}")
    print(f"Error type: {type(e).__name__}")
    print("\nFull traceback:")
    traceback.print_exc()
