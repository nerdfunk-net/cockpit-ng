#!/bin/bash
# Script to fix remaining test issues

cd /Users/mp/programming/cockpit-ng/backend/tests

echo "=== Fixing Ansible Inventory Tests ==="

# Fix 1: Add operator="equals" to all LogicalCondition calls
sed -i '' 's/LogicalCondition(field="\([^"]*\)", value=/LogicalCondition(field="\1", operator="equals", value=/g' unit/services/test_ansible_inventory_service.py

# Fix 2: Change operation -> operation_type
sed -i '' 's/operation="AND"/operation_type="AND"/g' unit/services/test_ansible_inventory_service.py
sed -i '' 's/operation="OR"/operation_type="OR"/g' unit/services/test_ansible_inventory_service.py

echo "✅ Ansible Inventory tests fixed"

echo ""
echo "=== Fixing Device Creation Tests ==="

# Fix 3: Change patch path from services.nautobot.nautobot_service to services.device_creation_service.nautobot_service
sed -i '' "s/'services\.nautobot\.nautobot_service'/'services.device_creation_service.nautobot_service'/g" unit/services/test_device_creation_service.py

echo "✅ Device Creation tests fixed"

echo ""
echo "=== Running Tests ==="
cd /Users/mp/programming/cockpit-ng/backend

echo ""
echo "Testing Ansible Inventory..."
pytest tests/unit/services/test_ansible_inventory_service.py -v --tb=short | tail -20

echo ""
echo "Testing Device Creation (first test only)..."
pytest tests/unit/services/test_device_creation_service.py::TestDeviceCreationSuccess::test_create_device_minimal_fields -v --tb=short

echo ""
echo "Done! Check results above."
