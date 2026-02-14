"""
Migration 010: Add deploy_agent fields to job_templates table.

Adds columns needed for the deploy_agent job template type:
- deploy_template_id: ID of the agent template to deploy
- deploy_agent_id: Agent identifier string (e.g., 'app-prod-01') for deployment
- deploy_path: File path for the deployment
- deploy_custom_variables: JSON string of user variable overrides
- activate_after_deploy: Whether to activate (pull and restart) agent after deployment

Note: Agent configuration stored in agents_settings.agents JSON includes:
- id: Unique UUID for the agent record (for internal reference)
- agent_id: Unique string identifier used by cockpit agent and for deployment (e.g., 'grafana-01')
- name: Display name for the agent
- description: Agent description
- git_repository_id: Reference to git repository for agent configuration
"""

from migrations.base import BaseMigration
from migrations.auto_schema import AutoSchemaMigration


class Migration(BaseMigration):
    @property
    def name(self) -> str:
        return "010_add_deploy_agent_fields"

    @property
    def description(self) -> str:
        return "Add deploy_agent fields (deploy_template_id, deploy_agent_id, deploy_path, deploy_custom_variables, activate_after_deploy) to job_templates table"

    def upgrade(self) -> dict:
        auto = AutoSchemaMigration(self.engine, self.base)
        return auto.run()
