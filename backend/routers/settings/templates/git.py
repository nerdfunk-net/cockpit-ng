"""Git connection test and sync endpoints."""

from __future__ import annotations

import logging
from typing import Any, Dict

from fastapi import APIRouter, Depends, HTTPException, status

from core.auth import require_permission
from core.safe_http_errors import raise_internal_server_error
from dependencies import get_git_connection_service, get_git_operations_service
from models.git_repositories import (
    GitAuthType,
    GitCategory,
    GitConnectionTestRequest,
)
from models.templates import (
    TemplateGitTestRequest,
    TemplateSyncRequest,
    TemplateSyncResponse,
)

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/git/test")
async def test_git_connection(
    git_test: TemplateGitTestRequest,
    current_user: dict = Depends(require_permission("network.templates", "write")),
    git_connection_service=Depends(get_git_connection_service),
) -> Dict[str, Any]:
    """Test Git repository connectivity using the same shallow-clone path as Git settings."""
    has_inline_creds = bool(
        (git_test.username and git_test.username.strip()) or (git_test.token and str(git_test.token).strip())
    )
    auth_type = GitAuthType.TOKEN if has_inline_creds else GitAuthType.NONE
    conn_req = GitConnectionTestRequest(
        url=git_test.repo_url,
        branch=git_test.branch,
        auth_type=auth_type,
        username=git_test.username or None,
        token=git_test.token or None,
        credential_name=None,
        verify_ssl=git_test.verify_ssl,
    )
    try:
        result = git_connection_service.test_connection(conn_req)
        payload: Dict[str, Any] = result.model_dump()
        payload["repository_accessible"] = result.success
        # Shallow clone test does not enumerate tree here; callers use success/message.
        payload["files_found"] = []
        return payload
    except Exception as exc:
        logger.error("Error testing Git connection: %s", exc, exc_info=True)
        raise_internal_server_error(logger, "Git connection test failed", exc)


@router.post("/sync", response_model=TemplateSyncResponse)
async def sync_templates(
    sync_request: TemplateSyncRequest,
    current_user: dict = Depends(require_permission("network.templates", "write")),
    git_operations_service=Depends(get_git_operations_service),
) -> TemplateSyncResponse:
    """Pull/clone all Git repositories in the ``templates`` category and refresh template sync metadata."""
    try:
        import service_factory

        template_manager = service_factory.build_template_service()
        git_repo_svc = service_factory.build_git_repository_service()
        username = current_user.get("username")

        repos = git_repo_svc.get_repositories_by_category(GitCategory.TEMPLATES.value)
        repo_errors: Dict[str, str] = {}
        for repo in repos:
            sync_result = git_operations_service.sync_repository(repo)
            if not sync_result.success:
                repo_errors[str(repo.get("id", "unknown"))] = sync_result.message

        all_git_ids = [t["id"] for t in template_manager.list_templates(source="git", username=username)]

        if sync_request.template_id is not None:
            tid = sync_request.template_id
            template = template_manager.get_template(tid)
            if not template:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Template with ID {tid} not found",
                )
            if template.get("source") != "git":
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Template sync applies only to git-sourced templates",
                )
            if username and template.get("scope") == "private":
                if template.get("created_by") != username:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="Not allowed to sync this private template",
                    )

            if not repos:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=(
                        "No git repositories registered with category 'templates'. "
                        "Add one under Settings → Git, then sync again."
                    ),
                )

            if repo_errors:
                template_manager.mark_git_templates_sync_metadata([tid], sync_status="error", username=username)
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail="; ".join(repo_errors.values()),
                )

            template_manager.mark_git_templates_sync_metadata([tid], sync_status="synced", username=username)
            return TemplateSyncResponse(
                synced_templates=[tid],
                failed_templates=[],
                errors={},
                message=f"Template git mirrors synced; metadata updated for template {tid}.",
            )

        # Sync all git templates (metadata): mirror all template-category repos first
        if not repos:
            if all_git_ids:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail={
                        "message": (
                            "No git repositories registered with category 'templates'. "
                            "Add one under Settings → Git, then sync again."
                        ),
                        "affected_template_ids": all_git_ids,
                    },
                )
            return TemplateSyncResponse(
                synced_templates=[],
                failed_templates=[],
                errors={},
                message="No git templates and no template-category git repositories.",
            )

        if repo_errors:
            if all_git_ids:
                template_manager.mark_git_templates_sync_metadata(all_git_ids, sync_status="error", username=username)
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail={
                    "repository_errors": repo_errors,
                    "failed_template_ids": all_git_ids,
                },
            )

        if all_git_ids:
            template_manager.mark_git_templates_sync_metadata(all_git_ids, sync_status="synced", username=username)
        return TemplateSyncResponse(
            synced_templates=all_git_ids,
            failed_templates=[],
            errors={},
            message=f"Synced {len(repos)} template git mirror(s); "
            f"updated metadata for {len(all_git_ids)} git template(s).",
        )

    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Error syncing templates: %s", exc, exc_info=True)
        raise_internal_server_error(logger, "Failed to sync templates", exc)
