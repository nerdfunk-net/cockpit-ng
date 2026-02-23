"""
Shared Slowapi rate-limiter instance.

Import `limiter` wherever you need to apply rate-limiting decorators.
Register it on the FastAPI app in main.py:

    from core.limiter import limiter
    from slowapi import _rate_limit_exceeded_handler
    from slowapi.errors import RateLimitExceeded

    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
"""

from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
