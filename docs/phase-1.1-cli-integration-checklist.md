# Phase 1.1 CLI Integration Checklist

## Studio API: POST /api/analyze

### Studio Ready ✅
- [x] Endpoint implemented at `/api/analyze`
- [x] Tests passing (7 unit tests)
- [x] API accepts URL in request body
- [x] Error codes defined:
  - `VALIDATION_ERROR` - Invalid request format
  - `INVALID_URL` - Invalid GitHub URL format
  - `FILE_NOT_FOUND` - 404 from GitHub
  - `TIMEOUT` - Request timeout after 5 seconds
  - `NETWORK_ERROR` - Network issues
  - `NOT_IMPLEMENTED` - Code analysis (Phase 1.6)
  - `INTERNAL_ERROR` - Unexpected errors

### API Contract

```typescript
// Request
POST http://localhost:3000/api/analyze
Content-Type: application/json

{
  "source": "https://github.com/owner/repo/blob/main/file.ts",
  "type": "url", // optional, auto-detected
  "options": {
    "maxDepth": 5,       // optional, for future phases
    "includePrivate": false, // optional, for future phases
    "noCache": false     // optional, for future phases
  }
}

// Success Response (200)
{
  "content": "// TypeScript file content here...",
  "metadata": {
    "filesAnalyzed": 1,
    "duration": 234,
    "cached": false
  }
}

// Error Response (4xx/5xx)
{
  "error": {
    "code": "FILE_NOT_FOUND",
    "message": "File not found",
    "details": {} // optional
  },
  "requestId": "uuid-here"
}
```

### Testing the API

```bash
# Test with valid GitHub URL
curl -X POST http://localhost:3000/api/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "source": "https://github.com/microsoft/TypeScript/blob/main/.editorconfig"
  }'

# Test with invalid URL
curl -X POST http://localhost:3000/api/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "source": "not-a-url"
  }'

# Test with non-existent file
curl -X POST http://localhost:3000/api/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "source": "https://github.com/owner/repo/blob/main/does-not-exist.ts"
  }'
```

### CLI Tasks (for openpkg repo)
- [ ] Add `analyze` command to CLI
- [ ] Implement Studio API client
- [ ] Add authentication check (warn if not logged in)
- [ ] Display fetched content or error messages
- [ ] Add --debug flag for troubleshooting

### Testing Requirements
- [ ] Manual test with real GitHub URLs
- [ ] Test all error scenarios
- [ ] Test with/without auth (should warn but work)
- [ ] Performance under 5 seconds for typical files

### Example CLI Usage (to be implemented)

```bash
# Analyze a GitHub file
openpkg analyze https://github.com/tanstack/query/blob/main/packages/query-core/src/query.ts

# With debug output
openpkg analyze https://github.com/tanstack/query/blob/main/packages/query-core/src/query.ts --debug

# Not authenticated warning
# ⚠️  You are not authenticated with OpenPkg Studio. Some features may be limited.
# ✓ Fetching query.ts...
# [raw TypeScript content displayed]
```

## Next Steps

1. Switch to openpkg repository
2. Implement the CLI tasks above
3. Test end-to-end integration
4. Move to Phase 1.2 (TypeScript parsing)