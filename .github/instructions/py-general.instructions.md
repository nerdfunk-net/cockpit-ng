---
applyTo: "**/*.py"
---

# Code Style & Formatting

- **Follow PEP 8** style guidelines strictly
  - snake_case for functions and variables
  - PascalCase for classes
  - UPPER_CASE for constants
- Use **4 spaces** for indentation (no tabs)
- Maximum line length of **88 characters** (Black formatter standard)
- Use **double quotes** for strings unless single quotes avoid escaping
- Import organization: standard library → third-party → local imports
- Use absolute imports over relative imports
- Do not use wildcard imports (e.g., `from module import *`)
- Avoid unnecessary complexity in code structure
- Do not use spaces in empty lines. Empty lines should be completely blank.

# Python general guidelines

- Write concise, technical responses with accurate Python examples.
- Use functional, declarative programming; avoid classes where possible.
- Prefer iteration and modularization over code duplication.
- Use descriptive variable names with auxiliary verbs (e.g., is_active, has_permission).
- Use lowercase with underscores for directories and files (e.g., routers/user_routes.py).
- Favor named exports for routes and utility functions.
- Use the Receive an Object, Return an Object (RORO) pattern.

# Type Hints & Documentation

- **Always use type hints** for function parameters and return values
- **Use pep 484** for type hints
- Use `from __future__ import annotations` for forward references
- Import types from `typing` module
- Use `Optional[Type]` instead of `Type | None`
- Use `TypeVar` for generic types
- Define custom types in `types.py`
- Use `Protocol` for duck typing
- Include **docstrings** for all public functions, classes, and modules using Google style format:

```python
def calculate_area(radius: float) -> float:
    """Calculate the area of a circle.

    Args:
        radius: The radius of the circle in meters.

    Returns:
        The area of the circle in square meters.

    Raises:
        ValueError: If radius is negative.
    """
    if radius < 0:
        raise ValueError("Radius must be non-negative")
    return math.pi * radius ** 2
```
