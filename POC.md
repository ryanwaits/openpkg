TSDoc vs OpenPkg for Documentation Standards

  TSDoc is indeed already an established standard for TypeScript documentation, but it focuses on comment syntax (like JavaDoc). It standardizes how to write comments like @param, @returns, etc.

  OpenPkg as you envision it would be more like OpenAPI for TypeScript libraries - a schema standard for describing the complete API surface of a TypeScript package in a machine-readable format.

  The value proposition is clear:
  - OpenAPI: Describes REST APIs → enables code generation, documentation, testing
  - OpenPkg: Describes TS/JS packages → enables the same benefits for libraries

  This is definitely valuable! Current alternatives:
  - TypeDoc JSON output: Not standardized, verbose, tool-specific
  - API Extractor: Microsoft's tool, but complex and enterprise-focused
  - JSR's package format: Deno's approach, but Deno-specific

  Simplifying the Architecture

  You're absolutely right - the current implementation is overcomplicated. For a standard like OpenAPI, it should be:

  Simple 3-file architecture:

  openpkg/
  ├── src/
  │   ├── cli.ts          # Simple CLI that runs extract → generate
  │   ├── extractor.ts    # Extract types/exports using TS Compiler API
  │   └── types/
  │       └── openpkg.ts  # The schema definition (already exists)

  Core principles:

  1. Use $ref everywhere (like OpenAPI)
  2. Don't resolve types deeply - just reference them
  3. Keep it simple - let consumers handle resolution if needed
