# Refactoring plan: inventory

This document describes the current inventory architecture in Cockpit-NG, the main problems in the implementation, and a recommended refactor plan that preserves the inventory features while improving service boundaries, testability, and long-term maintainability.

This version reflects the current backend state after the inventory service split that introduced dedicated query, evaluator, metadata, export, and git-storage services. The remaining refactor work is now mostly about saved-inventory resolution and caller consolidation, not about the original large-service decomposition.

Inventory is a critical part of the application. It is used by the inventory UI, template rendering, job execution, backup flows, and device targeting. Because of that, this plan prioritizes correctness and migration safety over aggressive cleanup.

## 1. summary

The current inventory implementation is built from four active layers:

- `backend/inventory_manager.py` for saved inventory CRUD in PostgreSQL.
- `backend/routers/inventory/main.py` for saved inventory CRUD endpoints.
- `backend/services/inventory/` for the split dynamic inventory service layer.
- `backend/routers/inventory/inventory.py` plus shared helper callers for preview, metadata, saved-inventory resolution, and analysis.

That high-level split is valid. The problem is that the boundaries are no longer clean.

Today the low-level dynamic inventory logic is in better shape than before, but saved-inventory resolution is still scattered. The router, manager, facade service, template rendering service, settings template router, and task utilities all participate in that flow. Some code paths load inventories from PostgreSQL, some convert tree structures to runtime operations, some evaluate devices against Nautobot, and some fetch detailed device metadata. Those concerns are still spread across too many modules.

The result is a system that works, but is harder to reason about than it should be.

## 2. current architecture

### 2.1 Saved inventory storage

Saved inventories are stored in PostgreSQL.

The current stack is:

- `backend/repositories/inventory/inventory_repository.py`
- `backend/inventory_manager.py`
- `backend/routers/inventory/main.py`

This flow is straightforward:

1. The router receives CRUD requests.
2. `InventoryManager` validates input and applies simple access rules.
3. `InventoryRepository` persists data through the existing repository layer.

This part of the design makes sense.

### 2.2 Dynamic inventory evaluation

Dynamic inventory evaluation runs against Nautobot and returns device matches for logical conditions.

The current stack is:

- `backend/services/inventory/inventory.py`
- `backend/services/inventory/query_service.py`
- `backend/services/inventory/evaluator.py`
- `backend/services/inventory/metadata_service.py`
- `backend/services/inventory/export_service.py`
- `backend/services/inventory/git_storage_service.py`
- `backend/routers/inventory/inventory.py`
- `backend/models/inventory.py`
- `backend/utils/inventory_converter.py`
- `backend/dependencies.py`
- `backend/service_factory.py`

This flow also makes sense at a high level:

1. The router accepts logical operations or a saved inventory ID.
2. `InventoryService` acts as a thin facade over the split services.
3. `InventoryEvaluator` and `InventoryQueryService` evaluate the conditions.
4. `InventoryMetadataService` serves UI field metadata.
5. `InventoryExportService` renders final output and analyzes resolved devices.
6. The router still performs saved-inventory orchestration for resolve and detailed-resolve endpoints.

### 2.3 Shared inventory resolution outside the inventory module

Inventory is not isolated to the inventory routers.

It is also used by:

- `backend/services/agents/template_render_service.py`
- `backend/tasks/execution/deploy_agent_executor.py`
- `backend/utils/inventory_resolver.py`
- `backend/routers/settings/templates.py`
- `backend/tasks/utils/device_helpers.py`

That means inventory is already a shared domain service, not just a single route feature.

## 3. what is still used

`backend/inventory_manager.py` is still actively used.

It is called from:

- `backend/routers/inventory/main.py` for create, list, get, update, delete, search, export, and import.
- `backend/routers/inventory/inventory.py` for resolving saved inventory IDs into devices.
- `backend/services/agents/template_render_service.py` for rendering templates against saved inventories.
- `backend/tasks/execution/deploy_agent_executor.py` for resolving inventory names in job execution.
- `backend/utils/inventory_resolver.py` for shared inventory-to-device resolution.
- `backend/services/inventory/inventory.py` for analysis of saved inventories.

So `InventoryManager` is not legacy or unused. It remains part of the active runtime architecture.

The split inventory services are also actively used.

- `InventoryQueryService`, `InventoryEvaluator`, and `InventoryMetadataService` are constructed by `InventoryService`.
- `InventoryExportService` now owns template rendering and device-set analysis.
- `InventoryGitStorage` now owns git-backed inventory file persistence.
- `dependencies.py` and `service_factory.py` already provide explicit construction for `InventoryService` and `DeviceQueryService` in router code.

## 4. problems in the current design

### 4.1 The domain split is valid, but the implementation is entangled

There are two legitimate inventory concerns:

- Saved inventory CRUD.
- Dynamic device resolution against Nautobot.

The problem is not that both exist. The problem is that the orchestration between them is duplicated and scattered.

### 4.2 The dynamic inventory router does too much

`backend/routers/inventory/inventory.py` does more than route handling.

It currently performs these steps directly:

- Load inventory records from PostgreSQL.
- Enforce access control.
- Convert saved condition trees into runtime operations.
- Call the evaluation service.
- Fetch device details through `device_query_service`.

That logic is orchestration logic. It should not live in the router.

### 4.3 `InventoryService` still crosses back into the storage layer

`backend/services/inventory/inventory.py` is now a much thinner facade, but it still loads saved inventories from `inventory_manager` in `analyze_inventory()`.

That means the dynamic evaluation service depends directly on the saved-inventory storage layer.

This creates an awkward dependency direction:

- Storage should feed orchestration.
- Orchestration should call evaluation.
- Evaluation should not reach back into storage on its own.

### 4.4 The split is real, but the orchestration boundary is still incomplete

The large-service decomposition is already partially complete.

The following responsibilities have been extracted into focused modules:

- Querying Nautobot devices by various fields in `query_service.py`.
- Evaluating nested logical operations in `evaluator.py`.
- Fetching UI metadata in `metadata_service.py`.
- Generating final inventory output and analyzing resolved devices in `export_service.py`.
- Saving, listing, and loading inventory files from Git in `git_storage_service.py`.

What is still missing is the saved-inventory resolver layer. Until that exists, the remaining orchestration responsibilities are split across the facade service, router, template rendering service, and utility wrappers.

### 4.5 There are two different inventory persistence models

The application currently has two persistence models for inventory:

- PostgreSQL saved inventories through `InventoryManager`.
- Git-backed inventory JSON files through `InventoryGitStorage`.

These are not the same feature.

The PostgreSQL path is clearly active.
The Git-backed implementation is now isolated in its own service, but current code search shows no callers outside the `InventoryService` facade delegation itself.

That means the architecture is clearer than before, but the product status is still ambiguous. The codebase still exposes both persistence models even though only the PostgreSQL path is part of the active runtime flow.

### 4.6 Naming and routing are confusing

The router package exports:

- `general_inventory_router` from `routers/inventory/inventory.py`.
- `inventory_router` from `routers/inventory/main.py`.

That naming is hard to follow because the more dynamic route is called `general_inventory_router` while the CRUD router gets the plain `inventory_router` name.

The runtime behavior is correct, but the naming increases cognitive load.

### 4.7 Inventory resolution is duplicated across modules

There is one common flow that appears repeatedly:

1. Load saved inventory.
2. Check access.
3. Convert tree data.
4. Evaluate devices.
5. Optionally enrich with detailed device data.

That flow exists in different forms in:

- `routers/inventory/inventory.py`
- `services/inventory/inventory.py`
- `services/agents/template_render_service.py`
- `routers/settings/templates.py`
- `utils/inventory_resolver.py`

This duplication is a real maintenance risk.

### 4.8 Sync wrappers still use ad hoc event loops

`backend/utils/inventory_resolver.py` uses `asyncio.run()` in its sync wrapper.

That is consistent with other task code in the backend, so this is no longer an inventory-specific anomaly. It is still worth consolidating once the saved-inventory resolver is introduced, but it is a lower-priority cleanup item than the duplicated orchestration logic.

## 5. recommended target architecture

The recommended solution is not to delete `InventoryManager`.

The correct move is to keep the valid split and add one missing layer: a dedicated orchestration service for saved inventory resolution.

### 5.1 Keep these components

Keep `InventoryManager` for PostgreSQL CRUD.

Its responsibilities remain:

- Create inventory records.
- Retrieve inventory records.
- List inventory records.
- Update inventory records.
- Delete inventory records.
- Search inventory records.
- Convert SQLAlchemy models to simple dictionaries.

Keep the repository layer behind it.

Keep a dynamic inventory evaluation service for Nautobot-backed matching.

### 5.2 Add a new orchestration service

Create a dedicated service for resolving saved inventories into runtime device data.

Suggested name:

- `SavedInventoryResolverService`

Suggested responsibilities:

- Load a saved inventory by ID or name.
- Enforce access control rules.
- Convert stored tree data to `LogicalOperation` objects.
- Call the dynamic evaluation service.
- Return device IDs, device summaries, or detailed device objects depending on the caller.
- Provide `analyze_inventory()` by combining resolved devices with `device_query_service`.

This is the missing architectural piece today.

### 5.3 Keep the split `InventoryService`, and finish the missing resolver layer

Most of the original service split is already complete.

Recommended structure:

- `backend/services/inventory/query_service.py`
  - All Nautobot query methods.
  - Device parsing into `DeviceInfo`.
- `backend/services/inventory/evaluator.py`
  - `LogicalOperation` evaluation.
  - Set combination rules.
- `backend/services/inventory/metadata_service.py`
  - Custom fields.
  - Field values.
  - Custom field types.
- `backend/services/inventory/export_service.py`
  - Final inventory generation for template output.
  - Device-set analysis.
- `backend/services/inventory/git_storage_service.py`
  - Git-backed inventory persistence.
- `backend/services/inventory/saved_inventory_resolver.py`
  - Saved inventory lookup.
  - Access validation.
  - Tree conversion.
  - Resolution to devices.
  - Detailed device enrichment.
  - Inventory analysis.
- `backend/services/inventory/inventory.py`
  - Thin facade only.

### 5.4 Decide the future of Git-backed inventory persistence

The Git-backed path now lives in `InventoryGitStorage`, so the architectural extraction is already done. What remains is a product and cleanup decision.

There are only two reasonable outcomes:

1. If Git-backed inventory files are still required:
  - Keep them in `InventoryGitStorage`.
  - Keep them out of saved-inventory resolution.
   - Document how they relate to PostgreSQL saved inventories.
2. If they are no longer required:
  - Remove the facade delegation and service after confirming there are no hidden callers.

Do not re-couple them to the dynamic evaluation path.

## 6. proposed service boundaries

### 6.1 `InventoryManager`

Purpose:

- CRUD facade for saved inventory records in PostgreSQL.

Dependencies:

- `InventoryRepository`.

Should not do:

- Nautobot querying.
- Device detail enrichment.
- Template rendering.
- Git file storage.

### 6.2 `InventoryQueryService`

Purpose:

- Fetch candidate devices from Nautobot for one filter or condition.

Dependencies:

- `NautobotService`.

Should not do:

- Access control.
- Loading saved inventories.
- Fetching detailed device records for analysis.

### 6.3 `InventoryEvaluator`

Purpose:

- Execute logical operations and combine result sets.

Dependencies:

- `InventoryQueryService`.

Should not do:

- Load database records.
- Fetch UI field metadata.

### 6.4 `InventoryMetadataService`

Purpose:

- Serve custom fields and field values used by the UI.

Dependencies:

- `NautobotService`.

Should not do:

- Evaluate logical operations.
- Load inventories from PostgreSQL.

### 6.5 `SavedInventoryResolverService`

Purpose:

- Bridge PostgreSQL saved inventories to runtime device resolution.

Dependencies:

- `InventoryManager` or a dedicated saved-inventory read service.
- `InventoryEvaluator`.
- `device_query_service` or its replacement.
- `inventory_converter`.

Should own:

- Access checks for saved inventories.
- Conversion from stored tree structures to runtime operations.
- Resolution to device IDs.
- Resolution to detailed device payloads.
- Inventory analysis.

### 6.6 `InventoryExportService`

Purpose:

- Convert resolved `DeviceInfo` results into final template-ready output.
- Analyze resolved device sets by fetching detailed Nautobot device data.

Dependencies:

- `template_manager`.
- `device_query_service`.

Should not do:

- Saved inventory lookup.
- Access control.

### 6.7 `InventoryGitStorage`

Purpose:

- Persist inventory JSON files in Git repositories when that feature is needed.

Dependencies:

- Git settings and Git operations services.

Should not do:

- Resolve saved inventories to devices.
- Participate in PostgreSQL-backed inventory CRUD.

## 7. router changes

### 7.1 CRUD router

`backend/routers/inventory/main.py` should remain the saved-inventory CRUD router.

Recommended changes:

- Keep using `InventoryManager` or an equivalent saved-inventory CRUD service.
- Move export and import helpers into a dedicated import-export helper if they continue to grow.
- Rename the router export so the name clearly reflects CRUD, for example `saved_inventory_router`.

This router still uses the active PostgreSQL inventory path and should remain separate from the dynamic evaluation endpoints.

### 7.2 Dynamic inventory router

`backend/routers/inventory/inventory.py` should stop orchestrating saved inventory resolution directly.

Recommended changes:

- Keep `preview`, `field-options`, `custom-fields`, and `field-values` as dynamic inventory endpoints.
- Move `resolve-devices`, `resolve-devices/detailed`, and `analyze` to the new `SavedInventoryResolverService`.
- Remove direct imports of `inventory_manager` and `device_query_service` from the router.
- Rename the router export to something clearer, for example `inventory_resolution_router` or `dynamic_inventory_router`.

The router already uses dependency providers for `InventoryService` and `DeviceQueryService`, so the remaining work here is specifically about orchestration removal, not about introducing dependency injection from scratch.

## 8. migration plan

### Phase 0: inventory usage audit

Status: completed.

#### Goal

Build a complete migration map for inventory.

#### Tasks

1. Confirm every caller of `inventory_manager`.
2. Confirm every caller of `inventory_service`.
3. Confirm whether the Git-backed inventory methods are used anywhere outside the service definition.
4. Confirm every caller of `utils.inventory_resolver`.
5. Confirm all places that manually reconstruct saved-inventory resolution.

#### Exit criteria

- There is a complete call graph for inventory-related flows.

Audit result:

- `InventoryManager` remains active in CRUD routes, the dynamic inventory router, template rendering, settings templates, deploy execution, and the shared inventory resolver utility.
- The split service modules exist and are wired through `InventoryService`.
- `InventoryGitStorage` currently has no external callers outside facade delegation.
- Saved-inventory resolution is still reconstructed in the dynamic router, template rendering, settings templates, and `utils.inventory_resolver.py`.

---

### Phase 1: introduce `SavedInventoryResolverService`

Status: not started.

#### Goal

Centralize the saved-inventory-to-device-resolution flow.

#### Tasks

1. Create a new service module for saved inventory resolution.
2. Move the shared resolution flow into it:
   - Load by ID or name.
   - Access check.
   - Tree conversion.
   - Preview evaluation.
3. Add methods such as:
   - `resolve_to_device_ids(inventory_id, username)`
   - `resolve_to_device_details(inventory_id, username)`
   - `analyze_inventory(inventory_id, username)`
4. Update `routers/inventory/inventory.py` to call the new service.
5. Update `template_render_service.py` to call the new service instead of reconstructing the flow.
6. Update `utils/inventory_resolver.py` to delegate to the new service.

#### Exit criteria

- Saved inventory resolution exists in one service instead of multiple modules.

---

### Phase 2: split the dynamic inventory service

Status: mostly completed.

#### Goal

Reduce `InventoryService` to focused components.

#### Tasks

1. Extract Nautobot query methods into `InventoryQueryService`.
2. Extract logical set execution into `InventoryEvaluator`.
3. Extract UI metadata methods into `InventoryMetadataService`.
4. Extract template generation and device analysis into `InventoryExportService`.
5. Keep `InventoryService` as a thin facade.

#### Exit criteria

- No single inventory service class mixes query, evaluation, metadata, rendering, git persistence, and analysis implementation concerns.

Current result:

- Completed for query, evaluation, metadata, export, and git persistence.
- Still pending for saved-inventory resolution, which remains outside a dedicated service.

---

### Phase 3: decide the Git-backed inventory path

Status: partially completed.

#### Goal

Either isolate or remove Git-backed inventory persistence.

#### Tasks

1. Confirm real runtime usage.
2. If it is active, keep `InventoryGitStorage` as the dedicated implementation.
3. If it is inactive, delete the methods after verification and tests.
4. Update documentation to clarify which persistence model is authoritative.

#### Exit criteria

- There is no ambiguity about how saved inventories are stored.

Current result:

- The extraction is already complete as `InventoryGitStorage`.
- The remaining question is whether to keep or remove it.

---

### Phase 4: dependency injection and factories

Status: partially completed.

#### Goal

Stop relying on inventory-related singletons in routers and helper services.

#### Tasks

1. Provide `InventoryManager`, `SavedInventoryResolverService`, and dynamic inventory services through the shared backend composition root.
2. Replace router imports of `inventory_service` and `device_query_service` with explicit dependencies.
3. Replace helper-service inline imports where practical.

#### Exit criteria

- Inventory services are constructed explicitly.
- Router modules no longer own orchestration behavior.

Current result:

- `InventoryService` and `DeviceQueryService` are already provided through `dependencies.py` and `service_factory.py`.
- `InventoryManager` and the future resolver service are not yet part of that composition path.
- The main remaining gap is orchestration inside routers and helper services.

---

### Phase 5: async-boundary cleanup for inventory helpers

Status: not started.

#### Goal

Remove inventory-specific ad hoc event-loop usage.

#### Tasks

1. Replace the sync wrapper in `utils.inventory_resolver.py` with the standard async-boundary pattern used elsewhere in the backend if the utility still exists after resolver consolidation.
2. Ensure task callers use the approved sync or async bridging approach.

#### Exit criteria

- Inventory resolution no longer introduces its own special async execution pattern.

## 9. recommended near-term actions

These are the highest-value steps.

1. Keep `InventoryManager`.
2. Introduce `SavedInventoryResolverService`.
3. Move `resolve-devices`, `resolve-devices/detailed`, and `analyze` behind that service.
4. Update `template_render_service.py`, `routers/settings/templates.py`, and `utils/inventory_resolver.py` to use the resolver instead of rebuilding the flow.
5. Remove `InventoryService.analyze_inventory()` after callers migrate.
6. Decide whether to keep or delete `InventoryGitStorage` and its facade delegation.

This sequence gives you the biggest clarity gain without destabilizing saved inventory CRUD.

## 10. risks and mitigations

### Risk: inventory resolution breaks downstream features

Inventory is used by templates, jobs, and task execution.

Mitigation:

- Migrate all saved-inventory resolution callers to the new resolver service before removing duplicated code.

### Risk: access-control behavior changes accidentally

Private inventory access is enforced in multiple places today.

Mitigation:

- Centralize access checks in `SavedInventoryResolverService`.
- Add explicit tests for global and private inventory visibility.

### Risk: tree conversion behavior diverges from the frontend

The frontend and backend both rely on the version 2 tree structure.

Mitigation:

- Keep `utils.inventory_converter.py` as the canonical conversion utility.
- Add regression tests around representative trees.

### Risk: hidden Git-backed inventory usage is missed

Mitigation:

- Complete the Phase 0 inventory usage audit before deleting any Git-backed methods.
- Run a final caller search before removing the facade delegation.

## 11. testing plan

### Unit tests

- `InventoryManager` CRUD and ownership rules.
- Tree conversion in `inventory_converter.py`.
- `InventoryEvaluator` set logic.
- `InventoryExportService` device analysis behavior.
- `SavedInventoryResolverService` access checks and resolution behavior.
- `InventoryMetadataService` field and custom-field responses.

### Integration tests

- Create inventory and resolve it to devices.
- Resolve detailed devices from a saved inventory.
- Analyze a saved inventory and return distinct values.
- Render an agent template that uses a saved inventory.

### Regression checks

- Private inventory access remains restricted to the owner.
- Global inventory access remains available to authorized users.
- Empty inventory conditions remain handled safely.
- Inventory preview still returns the same device counts for baseline test cases.

## 12. final recommendation

Do not remove `backend/inventory_manager.py`.

It is still used and it serves a valid purpose. The real issue is not that the manager exists. The real issue is that the saved-inventory resolution flow is spread across routers, services, utilities, and template rendering.

The recommended solution is:

1. Keep saved inventory CRUD in `InventoryManager` and the repository layer.
2. Keep the existing split service layer for dynamic Nautobot evaluation, metadata, export, and git storage.
3. Add `SavedInventoryResolverService` as the missing orchestration layer.
4. Remove duplicated saved-inventory resolution logic from routers, template rendering, settings templates, and utility wrappers.
5. Decide whether the isolated git-backed inventory storage feature should remain in the product.

That gives you a design that matches the real domain model:

- saved inventory storage
- saved inventory resolution
- dynamic inventory evaluation
- inventory metadata for the UI
- optional inventory rendering

That model is easier to understand, easier to test, and safer to evolve.