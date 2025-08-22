# Enhanced Cache API Documentation

The backend now provides comprehensive cache management and inspection endpoints with detailed statistics and performance tracking.

## Available Endpoints

### 1. GET `/api/cache/stats`
**Purpose:** Get comprehensive cache statistics including performance metrics

**Authentication:** Bearer token required

**Response:**
```json
{
  "success": true,
  "data": {
    "overview": {
      "total_items": 15,
      "valid_items": 12,
      "expired_items": 3,
      "total_size_bytes": 1048576,
      "total_size_mb": 1.0,
      "uptime_seconds": 3600.5
    },
    "performance": {
      "cache_hits": 245,
      "cache_misses": 12,
      "hit_rate_percent": 95.33,
      "expired_entries": 8,
      "entries_created": 20,
      "entries_cleared": 0
    },
    "namespaces": {
      "commits": {
        "count": 5,
        "size_bytes": 524288
      },
      "locations": {
        "count": 3,
        "size_bytes": 131072
      }
    },
    "keys": ["commits:repo:1:main", "locations:all", "..."]
  }
}
```

### 2. GET `/api/cache/entries?include_expired=false`
**Purpose:** Get detailed information about all cache entries

**Authentication:** Bearer token required

**Query Parameters:**
- `include_expired` (boolean, optional): Include expired entries in response (default: false)

**Response:**
```json
{
  "success": true,
  "count": 12,
  "data": [
    {
      "key": "commits:repo:1:main",
      "namespace": "commits",
      "created_at": 1692737400.0,
      "expires_at": 1692738000.0,
      "last_accessed": 1692737800.0,
      "access_count": 15,
      "size_bytes": 65536,
      "age_seconds": 400.0,
      "ttl_seconds": 200.0,
      "last_accessed_ago": 5.2,
      "is_expired": false
    }
  ]
}
```

### 3. GET `/api/cache/namespace/{namespace}`
**Purpose:** Get detailed information about a specific cache namespace

**Authentication:** Bearer token required

**Path Parameters:**
- `namespace` (string): The namespace to inspect (e.g., "commits", "locations", "default")

**Response:**
```json
{
  "success": true,
  "data": {
    "namespace": "commits",
    "total_entries": 5,
    "valid_entries": 4,
    "expired_entries": 1,
    "total_size_bytes": 524288,
    "total_size_mb": 0.5,
    "entries": [
      {
        "key": "commits:repo:1:main",
        "created_at": 1692737400.0,
        "expires_at": 1692738000.0,
        "last_accessed": 1692737800.0,
        "access_count": 15,
        "size_bytes": 65536,
        "ttl_seconds": 200.0,
        "is_expired": false
      }
    ]
  }
}
```

### 4. GET `/api/cache/performance`
**Purpose:** Get detailed cache performance metrics

**Authentication:** Bearer token required

**Response:**
```json
{
  "success": true,
  "data": {
    "uptime_seconds": 3600.5,
    "total_requests": 257,
    "requests_per_second": 0.07,
    "cache_hits": 245,
    "cache_misses": 12,
    "hit_rate_percent": 95.33,
    "expired_entries": 8,
    "entries_created": 20,
    "entries_cleared": 0,
    "current_entries": 12
  }
}
```

### 5. POST `/api/cache/clear`
**Purpose:** Clear cache entries (all or by namespace)

**Authentication:** Bearer token required

**Request Body (optional):**
```json
{
  "namespace": "commits"  // Optional - if omitted, clears all cache
}
```

**Response:**
```json
{
  "success": true,
  "message": "Cleared cache namespace 'commits' (5 items)",
  "cleared_count": 5
}
```

### 6. POST `/api/cache/cleanup`
**Purpose:** Remove expired cache entries

**Authentication:** Bearer token required

**Response:**
```json
{
  "success": true,
  "message": "Removed 3 expired entries",
  "removed_count": 3
}
```

## Cache Namespaces

The cache uses namespaces to organize different types of data:

- **`commits`**: Git commit history data
- **`locations`**: Nautobot location data  
- **`files`**: File content cache
- **`default`**: Entries without specific namespace

## Performance Tracking

The enhanced cache service now tracks:

- **Cache Hits/Misses**: Request success rate
- **Hit Rate Percentage**: Cache efficiency metric
- **Access Patterns**: How often entries are accessed
- **Memory Usage**: Size estimation for cached data
- **Entry Lifecycle**: Creation, expiration, and cleanup stats

## Usage Examples

### Frontend Integration
```typescript
// Get comprehensive cache stats
const stats = await apiCall('cache/stats')

// Get all valid entries
const entries = await apiCall('cache/entries')

// Get commits namespace info
const commitsInfo = await apiCall('cache/namespace/commits')

// Clear expired entries
await apiCall('cache/cleanup', { method: 'POST' })

// Clear specific namespace
await apiCall('cache/clear', { 
  method: 'POST', 
  body: { namespace: 'commits' } 
})
```

### Performance Monitoring
The `/api/cache/performance` endpoint is ideal for:
- Dashboard widgets showing cache efficiency
- Monitoring cache hit rates over time
- Identifying memory usage patterns
- Optimizing TTL settings based on access patterns

## Size Estimation

The cache service estimates memory usage using `sys.getsizeof()`. This provides approximate sizes for:
- JSON data structures
- String content
- Lists and dictionaries
- Complex nested objects

Note: Size estimates are approximate and may not reflect exact memory overhead.
