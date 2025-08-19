#!/usr/bin/env python3
import sys
from pathlib import Path

# Add the backend directory to Python path
backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))

print("Testing uvicorn module loading...")

# Simulate what uvicorn does
try:
    import importlib
    module = importlib.import_module("main")
    app = getattr(module, "app")

    print(f"App object found: {app}")
    print(f"Number of routes: {len(app.routes)}")

    print("\nRoutes in app:")
    for i, route in enumerate(app.routes):
        if hasattr(route, 'path'):
            methods = getattr(route, 'methods', 'N/A')
            print(f"  {i+1:2d}. {route.path} - {methods}")

    # Check if there's an openapi schema
    try:
        schema = app.openapi()
        paths = schema.get('paths', {})
        print(f"\nOpenAPI paths: {len(paths)}")
        for path in sorted(paths.keys()):
            print(f"  {path}")
    except Exception as e:
        print(f"OpenAPI error: {e}")

except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()
