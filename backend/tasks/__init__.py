"""
Celery tasks module.
Import all task modules here to register them with Celery.
"""

# Import task modules here
# from . import device_tasks
# from . import config_tasks
# from . import sync_tasks
# from . import compliance_tasks
from . import periodic_tasks
from . import test_tasks

__all__ = ['periodic_tasks', 'test_tasks']
