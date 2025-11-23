"""
Celery Beat periodic task schedule configuration.
Replaces APScheduler for scheduled tasks.
"""
from celery.schedules import crontab

# Define periodic task schedule
CELERY_BEAT_SCHEDULE = {
    # Example: Worker health check - every 5 minutes
    'worker-health-check': {
        'task': 'tasks.worker_health_check',
        'schedule': crontab(minute='*/5'),  # Every 5 minutes
        'options': {
            'expires': 240,  # Task expires after 4 minutes if not picked up
        }
    },

    # Add more periodic tasks here as needed
    # See doc/CELERY_ARCHITECTURE.md for examples
}

# Schedule examples using different patterns:
#
# Every X minutes:
#   crontab(minute='*/15')
#
# Specific time daily:
#   crontab(hour=2, minute=30)
#
# Multiple times per day:
#   crontab(hour='0,6,12,18', minute=0)
#
# Specific day of week (0=Sunday, 6=Saturday):
#   crontab(hour=0, minute=0, day_of_week=0)
#
# First day of month:
#   crontab(hour=0, minute=0, day_of_month=1)
#
# Using timedelta for simple intervals:
#   from datetime import timedelta
#   schedule = timedelta(minutes=30)
