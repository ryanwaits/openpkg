# OpenPkg Design Decisions

This document captures key design decisions made during the development of OpenPkg.

## Cross-Package Type References

### Decision: Use `$ref` for all named types, including external packages

When analyzing a TypeScript package that imports types from other packages, OpenPkg will create `$ref` references to those types even though they won't be included in the current package's spec.

#### Example
When analyzing `@stacks/transactions`:
```json
{
  "name": "network",
  "type": {
    "anyOf": [
      "undefined",
      "mainnet",
      "testnet",
      "devnet", 
      "mocknet",
      {
        "$ref": "#/types/StacksNetwork"
      }
    ]
  }
}
```

Here, `StacksNetwork` is defined in `@stacks/network`, not in the current package. The reference will not resolve within this spec alone.

#### Rationale

1. **Accuracy**: This accurately represents the actual type structure in the code
2. **Completeness**: Consumers can understand that there are external type dependencies
3. **Composability**: Specs from multiple packages can potentially be merged
4. **Consistency**: All named types are treated the same way

#### Implications for Consumers

Consumers of OpenPkg specs should be aware that:
- Some `$ref` references may not resolve within a single package spec
- To get complete type information, they may need to:
  - Generate specs for all dependent packages
  - Use a plugin/tool that can fetch and merge specs from multiple packages
  - Handle unresolved references gracefully in their tooling

#### Future Enhancements

This design enables future premium features such as:
- Plugins that automatically fetch and merge dependent package specs
- A registry service that hosts specs for popular packages
- Tools that can generate a complete, self-contained spec by resolving all external references

### Alternative Approaches Considered

1. **Only reference types within the package**: Would prevent broken references but lose information
2. **Include imported types in the spec**: Would create duplication and complexity
3. **Use string types for external references**: Would lose the semantic meaning that these are type references

We chose the current approach as it provides the best foundation for both simple use cases and future advanced features.