# CLI Flag Refactoring Guide

## Overview

In Phase 1.4, we refactored the OpenPkg CLI's analyze command to use a more scalable flag system with `--show` and `--follow` patterns instead of individual flags.

## Changes

### Before (Old Flags)
```bash
openpkg analyze <url> --imports              # Show imports only
openpkg analyze <url> --verbose              # Show detailed summary
openpkg analyze <url> --debug                # Show debug info
openpkg analyze <url> --follow-imports       # Follow relative imports
```

### After (New Flags)
```bash
openpkg analyze <url> --show=imports         # Show imports only
openpkg analyze <url> --show=summary         # Show detailed summary (verbose)
openpkg analyze <url> --show=debug           # Show debug info
openpkg analyze <url> --follow=imports       # Follow relative imports
```

## Benefits

1. **Composable**: Multiple display options can be combined
   ```bash
   openpkg analyze <url> --show=spec,imports,summary,debug
   ```

2. **Extensible**: Easy to add new options without flag proliferation
   - Future: `--follow=packages,types`
   - Future: `--show=errors,warnings`

3. **Cleaner**: Fewer top-level flags, better organization

## Usage Examples

### Basic Usage
```bash
# Default behavior (show spec only)
openpkg analyze https://github.com/org/repo/file.ts

# Show only imports
openpkg analyze https://github.com/org/repo/file.ts --show=imports

# Follow imports and show everything
openpkg analyze https://github.com/org/repo/file.ts --follow=imports --show=spec,imports,summary
```

### Combined Options
```bash
# Follow imports with depth limit and show summary
openpkg analyze <url> --follow=imports --max-depth=3 --show=spec,summary

# Debug mode with import following
openpkg analyze <url> --follow=imports --show=debug
```

## Valid Options

### --show
- `spec` - Generate and save OpenPkg specification (default)
- `imports` - Display import analysis
- `summary` - Show detailed summary with exports/types breakdown
- `debug` - Display debug information including timing and cache status

### --follow
- `imports` - Follow and analyze relative imports recursively

## Migration Guide

### For Scripts
Replace old flags with new ones:

```bash
# Old
openpkg analyze $URL --follow-imports --verbose --debug

# New
openpkg analyze $URL --follow=imports --show=spec,summary,debug
```

### For Documentation
Update any documentation referencing the old flags to use the new syntax.

## Technical Implementation

The CLI validates comma-separated values and provides clear error messages:

```bash
$ openpkg analyze <url> --show=invalid
Error: Invalid --show values: invalid
Valid options: spec, imports, summary, debug
```

## Future Extensions

The new pattern allows for easy additions:

```bash
# Potential future options
--follow=packages,types,exports
--show=errors,warnings,metrics,graph
--filter=exports,types,private
```

## Studio API Compatibility

**Important**: This refactoring is CLI-only. The Studio API still expects:
```json
{
  "source": "url",
  "options": {
    "followImports": true,  // Boolean, not changed
    "maxDepth": 5
  }
}
```

The CLI translates `--follow=imports` to `followImports: true` internally.