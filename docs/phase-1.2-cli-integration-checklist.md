# Phase 1.2 CLI Integration Checklist

## Studio API: Enhanced POST /api/analyze

### Studio Ready ✅
- [x] ImportParser class implemented
- [x] Extract import declarations with metadata
- [x] Differentiate import types (relative/package/absolute)
- [x] Handle syntax errors gracefully
- [x] Tests passing (19 unit tests)
- [x] API returns parsed imports in response

### API Changes from Phase 1.1

The `/api/analyze` endpoint now returns additional fields:

```typescript
// Enhanced Response (200)
{
  "content": "// TypeScript file content...",
  "imports": [
    {
      "type": "relative" | "package" | "absolute",
      "path": "./types",
      "isTypeOnly": true,
      "importedNames": ["Type1", "Type2"],
      "defaultImport": "MyDefault",
      "namespaceImport": "MyNamespace"
    }
  ],
  "parseErrors": [  // Only present if syntax errors exist
    {
      "message": "'}' expected",
      "line": 5,
      "column": 20
    }
  ],
  "metadata": {
    "filesAnalyzed": 1,
    "duration": 234,
    "cached": false
  }
}
```

### Testing the Enhanced API

```bash
# Test import parsing
curl -X POST http://localhost:3000/api/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "source": "https://github.com/tanstack/query/blob/main/packages/query-core/src/utils.ts"
  }' | jq '.imports'

# Test with syntax errors
curl -X POST http://localhost:3000/api/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "source": "https://github.com/microsoft/TypeScript/blob/main/.editorconfig"
  }' | jq '.parseErrors'
```

### CLI Tasks (for openpkg repo)
- [ ] Update analyze command to show imports when --imports flag used
- [ ] Format import list nicely for terminal output
- [ ] Handle new error types from parsing failures
- [ ] Group imports by type (relative vs package)
- [ ] Show import statistics summary

### Example CLI Output (to be implemented)

```bash
# Analyze with imports flag
openpkg analyze https://github.com/tanstack/query/blob/main/packages/query-core/src/utils.ts --imports

✓ Fetching utils.ts...
✓ Parsing TypeScript...
✓ Found 3 imports

Imports:
├── Relative (3)
│   ├── ./types (type-only) [10 imports]
│   ├── ./mutation (type-only) [1 import]
│   └── ./query (type-only) [2 imports]
└── Package (0)

# With parse errors
openpkg analyze https://github.com/broken/file.ts --imports

✓ Fetching file.ts...
⚠️  Parse errors detected:

  Line 5, Column 20: '}' expected
  Line 10: Expression expected

Imports found before errors:
├── Package (1)
│   └── react [default import]
```

### Testing Requirements
- [ ] Test with files containing various import patterns
- [ ] Test with files containing syntax errors
- [ ] Verify import grouping and formatting
- [ ] Test performance with large files
- [ ] Ensure backward compatibility (works without --imports flag)

## Next Steps

1. Switch to openpkg repository
2. Implement the CLI enhancements
3. Test end-to-end integration
4. Move to Phase 1.3 (Single-file analysis)