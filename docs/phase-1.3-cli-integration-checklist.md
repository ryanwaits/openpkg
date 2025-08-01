# Phase 1.3 CLI Integration Checklist

## Studio API: Enhanced POST /api/analyze with OpenPkg Spec

### Studio Ready ✅
- [x] SingleFileAnalyzer class implemented
- [x] Generates OpenPkg spec for single files
- [x] Handles various export types (functions, classes, interfaces, enums, types)
- [x] Graceful error handling for spec generation
- [x] Spec validation before returning
- [x] Tests passing (12 unit tests)
- [x] API returns full OpenPkg spec in response

### API Changes from Phase 1.2

The `/api/analyze` endpoint now returns a complete OpenPkg specification:

```typescript
// Enhanced Response (200)
{
  "content": "// TypeScript file content...",
  "imports": [...],  // From Phase 1.2
  "spec": {
    "openpkg": "1.0.0",
    "meta": {
      "name": "analyzed-file",
      "version": "1.0.0",
      "description": "Single file analysis",
      "ecosystem": "js/ts"
    },
    "exports": [
      {
        "id": "functionName",
        "name": "functionName",
        "kind": "function",
        "signatures": [{
          "parameters": [...],
          "returns": {...},
          "description": "JSDoc comment"
        }],
        "description": "JSDoc comment"
      }
    ],
    "types": [
      {
        "id": "TypeName",
        "name": "TypeName",
        "kind": "interface",
        "schema": {
          "type": "object",
          "properties": {...},
          "required": [...]
        }
      }
    ]
  },
  "parseErrors": [...],
  "metadata": {
    "filesAnalyzed": 1,
    "duration": 234,
    "cached": false
  }
}
```

### Testing the Enhanced API

```bash
# Test with a file containing various exports
curl -X POST http://localhost:3000/api/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "source": "https://github.com/tanstack/query/blob/main/packages/query-core/src/utils.ts"
  }' | jq '.spec'

# Test with a TypeScript types file
curl -X POST http://localhost:3000/api/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "source": "https://github.com/tanstack/query/blob/main/packages/query-core/src/types.ts"
  }' | jq '.spec.types'

# Test includePrivate option
curl -X POST http://localhost:3000/api/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "source": "https://github.com/microsoft/TypeScript/blob/main/src/compiler/types.ts",
    "options": {
      "includePrivate": true
    }
  }' | jq '.spec.exports'
```

### CLI Tasks (for openpkg repo)
- [ ] Update analyze command to save spec to file
- [ ] Add -o/--output flag for custom output path  
- [ ] Pretty print JSON output
- [ ] Show summary of exports found
- [ ] Handle spec generation failures gracefully

### Example CLI Output (to be implemented)

```bash
# Basic analysis
openpkg analyze https://github.com/tanstack/query/blob/main/packages/query-core/src/utils.ts

✓ Fetching utils.ts...
✓ Parsing TypeScript...
✓ Generating OpenPkg spec...
✓ Saved to openpkg.json

Summary:
- 15 exports found
  - 12 functions
  - 3 variables
- 0 types defined
- File analyzed in 234ms

# With custom output
openpkg analyze https://github.com/example/repo/blob/main/src/index.ts -o spec.json

✓ Fetching index.ts...
✓ Parsing TypeScript...
✓ Generating OpenPkg spec...
✓ Saved to spec.json

# With summary details
openpkg analyze https://github.com/example/repo/blob/main/src/types.ts --verbose

✓ Fetching types.ts...
✓ Parsing TypeScript...
✓ Generating OpenPkg spec...
✓ Saved to openpkg.json

Exports (5):
├── Functions
│   ├── createUser
│   └── updateUser
├── Classes
│   └── UserService
└── Variables
    ├── API_URL
    └── DEFAULT_CONFIG

Types (8):
├── Interfaces
│   ├── User
│   ├── Config
│   └── Options
├── Type Aliases
│   ├── ID
│   ├── Status
│   └── Callback
└── Enums
    ├── UserRole
    └── ErrorCode
```

### Testing Requirements
- [ ] Test with files containing all export types
- [ ] Test with files that have no exports
- [ ] Test with large TypeScript files
- [ ] Verify JSDoc comments are preserved
- [ ] Test spec validation works correctly
- [ ] Ensure backward compatibility

### Known Limitations (Phase 1.3)
- Type information is simplified (all types shown as 'string')
- No dependency resolution yet
- No type inference for complex types
- Limited JSDoc parsing
- No handling of ambient declarations

## Next Steps

1. Switch to openpkg repository
2. Implement the CLI enhancements
3. Test end-to-end integration
4. Move to Phase 1.4 (Relative import resolution)