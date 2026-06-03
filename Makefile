.PHONY: verify-baseline

# Verify committed pytest baseline YAML matches golden metadata and unique IPs
verify-baseline:
	cd backend && python scripts/verify_baseline_parity.py --mode full

# Regenerate manifest JSON from YAML + filter cases (after changing baseline or filters)
baseline-manifest:
	cd backend && python scripts/expect_inventory_counts.py --write-manifest
