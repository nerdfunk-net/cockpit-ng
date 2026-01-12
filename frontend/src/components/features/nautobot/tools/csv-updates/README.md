# CSV Updates Feature

## Overview
The CSV Updates feature allows users to upload and update Nautobot objects (devices, IP prefixes, IP addresses, and locations) via CSV files.

## Architecture

This feature follows the refactoring guidelines and uses:
- **TanStack Query** for server state management
- **Custom hooks** for form state and CSV upload logic
- **Centralized query keys** for cache management
- **Mutation hooks** for data updates
- **Utility functions** for CSV parsing and validation

## Structure

```
csv-updates/
├── csv-updates-page.tsx         # Main page component (refactored)
├── csv-updates-page.old.tsx     # Original component (for reference)
├── types/
│   └── index.ts                 # TypeScript type definitions
├── hooks/
│   └── use-csv-upload.ts        # Custom hook for CSV upload state
├── utils/
│   └── csv-parser.ts            # CSV parsing and validation utilities
├── constants.ts                 # Shared constants and default values
└── README.md                    # This file
```

## Refactoring Benefits

### Before (Original)
- 250+ lines in single component
- Mixed concerns (parsing, validation, state management)
- No query caching or mutation handling
- Manual state management with useState

### After (Refactored)
- **Main component:** ~300 lines (clean and focused)
- **Custom hook:** `useCsvUpload` - 130 lines (form state management)
- **Mutation hook:** `useCsvUpdatesMutations` - 71 lines (TanStack Query)
- **Utils:** Separate validation and parsing functions
- **Types:** Centralized type definitions
- **Query keys:** Integrated with app-wide cache system

## Features

### CSV Configuration
- **CSV Delimiter**: Configurable delimiter (default: `,`)
- **CSV Quote Character**: Configurable quote character (default: `"`)

### Properties Panel (IP Prefixes)
After parsing an IP prefix CSV, a Properties panel appears with:

#### UUID Handling
- **Ignore UUID** (default): Use prefix + namespace to find entries
  - Recommended for CSV files from other Nautobot instances
  - More reliable as UUIDs won't match
- **Use UUID**: Directly update by ID
  - Only if UUIDs match your Nautobot instance

#### Column Selection
- Select which columns to include in updates
- Uncheck columns you want to ignore during update
- **Auto-ignored columns**:
  - **Lookup fields**: `prefix`, `namespace__name`, `namespace`
  - **Read-only fields**: `display`, `id`, `object_type`, `natural_slug`, `ip_version`, `date_allocated`, `parent__namespace__name`, `parent__network`, `parent__prefix_length`, `created`, `last_updated`, `url`, `network`, `broadcast`, `prefix_length`

### Object Types
- **Devices**: Network devices with properties like name, device type, location
- **IP Prefixes**: IP network prefixes with namespace information
- **IP Addresses**: Individual IP addresses with parent namespace
- **Locations**: Physical locations with hierarchy

### Validation
The feature performs comprehensive validation on uploaded CSV files:

1. **Header Validation**: Checks for required headers based on object type
2. **UUID Validation**: Validates ID columns have proper UUID format
3. **IP Format Validation**: Validates IP addresses and prefixes
4. **Empty Row Detection**: Identifies empty rows in the CSV

### Required Headers by Object Type

#### Devices
- `name`: Device name
- `id`: UUID
- `device_type__model`: Device model
- `location__name`: Location name

#### IP Prefixes
- `prefix`: IP prefix (e.g., 192.168.1.0/24)
- `id`: UUID
- `namespace__name`: Namespace name

#### IP Addresses
- `address`: IP address (e.g., 192.168.1.1/24)
- `id`: UUID
- `parent__namespace__name`: Parent namespace name

#### Locations
- `name`: Location name
- `id`: UUID
- `location_type__name`: Location type

## Usage

1. Navigate to **Nautobot → Tools → CSV Updates** in the sidebar
2. Select the object type from the dropdown
3. Configure CSV parsing options (delimiter, quote character)
4. Upload a CSV file
5. Click "Parse CSV" to validate the file
6. Review validation results and data preview
7. Process updates (backend implementation pending)

## Backend Integration

The backend implementation will be added to:
- `/backend/routers/csv_updates.py` - API endpoints
- `/backend/services/csv_updates_service.py` - Business logic
- `/backend/repositories/csv_updates_repository.py` - Data access

Expected endpoint structure:
```
POST /api/csv-updates/process
Body: {
  objectType: string
  csvData: { headers: string[], rows: string[][] }
  dryRun: boolean
}
```

## Component Architecture

### csv-updates-page.tsx
Main component that handles:
- State management for CSV config, parsed data, validation results
- File upload and parsing
- Validation result display
- Data preview table

### utils/csv-parser.ts
Utility functions for:
- `parseCSVLine()`: Parse a single CSV line with quote handling
- `parseCSVContent()`: Parse entire CSV file into headers and rows
- `validateCSVData()`: Run all validation checks
- `validateHeaders()`: Check for required headers
- `validateIds()`: Validate UUID format
- `validateIpAddresses()`: Validate IP format

### types/index.ts
TypeScript type definitions for type safety and IDE support

### constants.ts
Shared constants for default values and configuration

## Future Enhancements
- Batch update processing with progress tracking
- Dry-run mode for previewing changes
- Detailed change logs
- Export validation results
- Support for additional object types
- Column mapping configuration
- CSV template download
