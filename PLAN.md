  Core OpenPkg (Free/Open Source)
  - Simple standard/schema definition
  - Basic extractor that generates specs with $ref types
  - ~250 lines, 2 files
  - Like OpenAPI - just defines the format

  Premium Features (Paid Add-ons)
  - Type Resolution Service: Resolves $ref fields to show full type definitions
  - Documentation Generators: Beautiful docs like Stripe/Vercel
  - AI-Powered Features:
    - Auto-generate examples from types
    - Explain complex type relationships
    - Generate SDKs in other languages
  - IDE Plugins: Real-time spec updates, inline docs
  - API Playground: Interactive testing environment
  - Change Detection: Track breaking changes between versions

  The business model mirrors OpenAPI's ecosystem:
  - OpenAPI spec = free standard everyone adopts
  - Swagger UI, Postman, ReadMe.io = paid tools that consume it

  For OpenPkg:
  - OpenPkg spec = free standard for TypeScript packages
  - Premium tools = paid services that make the spec incredibly useful

  This approach is much cleaner because:
  1. Standard stays simple and adoptable
  2. Complex type resolution happens in paid tools (where stack overflow issues can be handled properly)
  3. Clear value proposition for paying customers
