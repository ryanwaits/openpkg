# OpenPkg TypeScript Compiler API Refactoring PRD

## Executive Summary

This document outlines a comprehensive plan to refactor OpenPkg from using ts-morph to the TypeScript Compiler API directly. This change will enable full type resolution capabilities, eliminating the need for AI-based type resolution for complex types.

## Problem Statement

### Current Limitations
1. **Limited Type Resolution**: ts-morph's `getType().getText()` returns types as written, not resolved
2. **AI Dependency**: Complex types require AI agent for resolution
3. **No Generic Expansion**: Cannot expand `Partial<User>` to show all properties
4. **Cross-file Limitations**: Limited ability to follow imports and resolve types from other files
5. **No Type Inference**: Cannot handle inferred types that aren't explicitly written

### Benefits of TypeScript Compiler API
1. **Full Type Resolution**: `typeChecker.getTypeAtLocation()` provides actual resolved types
2. **Generic Instantiation**: Can resolve `Array<string>`, `Partial<T>`, etc.
3. **Cross-file Analysis**: Full program context allows following imports
4. **Recursive Type Walking**: Can walk complex nested type structures
5. **No AI Required**: Deterministic type resolution

## Phases and Implementation Plan

### Phase 1: Foundation and Architecture (Week 1)
**Goal**: Set up TypeScript Compiler API infrastructure and maintain backward compatibility

#### Tasks:
1. **Create Compiler API Service** (Priority: High)
   - [ ] Create `src/services/compiler-api.ts`
   - [ ] Implement `createProgram()` wrapper with proper configuration
   - [ ] Add error handling for missing files/invalid configurations
   - [ ] Create unit tests for program creation

2. **Design Type Resolution Interface** (Priority: High)
   - [ ] Define `ITypeResolver` interface that both ts-morph and Compiler API can implement
   - [ ] Create `TypeResolverFactory` to switch between implementations
   - [ ] Ensure backward compatibility with existing base-parser

3. **Set Up Type Walker Infrastructure** (Priority: High)
   - [ ] Create `src/services/type-walker.ts`
   - [ ] Implement base recursive type walking logic
   - [ ] Add cycle detection for recursive types
   - [ ] Create type node visitor pattern

4. **Configuration Management** (Priority: Medium)
   - [ ] Update CLI to accept `--use-compiler-api` flag
   - [ ] Add tsconfig.json resolution logic
   - [ ] Support custom compiler options

### Phase 2: Core Type Resolution (Week 2)
**Goal**: Implement core type resolution using TypeScript Compiler API

#### Tasks:
1. **Basic Type Resolution** (Priority: High)
   - [ ] Implement `getResolvedType()` using `typeChecker.getTypeAtLocation()`
   - [ ] Add support for primitive types
   - [ ] Handle union and intersection types
   - [ ] Create comprehensive test suite

2. **Complex Type Expansion** (Priority: High)
   - [ ] Implement generic type expansion (e.g., `Array<T>`, `Promise<T>`)
   - [ ] Handle utility types (`Partial<T>`, `Required<T>`, `Pick<T, K>`)
   - [ ] Resolve mapped types
   - [ ] Add conditional type support

3. **Cross-file Type Resolution** (Priority: High)
   - [ ] Implement import resolution
   - [ ] Handle re-exported types
   - [ ] Support namespace and module types
   - [ ] Add path mapping support

4. **Type Property Walking** (Priority: High)
   - [ ] Implement recursive property extraction
   - [ ] Handle inherited properties from base classes/interfaces
   - [ ] Support index signatures
   - [ ] Extract method signatures with full parameter types

### Phase 3: Advanced Features (Week 3)
**Goal**: Implement advanced type features and optimizations

#### Tasks:
1. **Symbol Resolution** (Priority: High)
   - [ ] Implement `getSymbolAtLocation()` integration
   - [ ] Extract JSDoc comments from symbols
   - [ ] Handle symbol aliases
   - [ ] Support declaration merging

2. **Type Inference** (Priority: High)
   - [ ] Handle inferred return types
   - [ ] Support inferred generic parameters
   - [ ] Resolve contextual types
   - [ ] Handle type predicates

3. **Performance Optimization** (Priority: Medium)
   - [ ] Implement type resolution caching
   - [ ] Add incremental compilation support
   - [ ] Optimize large codebase handling
   - [ ] Add progress reporting for long operations

4. **Error Handling** (Priority: Medium)
   - [ ] Graceful handling of type errors
   - [ ] Provide meaningful error messages
   - [ ] Add fallback to ts-morph for edge cases
   - [ ] Implement retry logic for transient failures

### Phase 4: Integration and Migration (Week 4)
**Goal**: Integrate new implementation and provide migration path

#### Tasks:
1. **Parser Integration** (Priority: High)
   - [ ] Update `base-parser.ts` to use new type resolver
   - [ ] Ensure output format compatibility
   - [ ] Add feature flags for gradual rollout
   - [ ] Create migration guide

2. **Remove AI Dependency** (Priority: High)
   - [ ] Replace AI agent with Compiler API resolution
   - [ ] Maintain AI as optional enhancement (not requirement)
   - [ ] Update documentation
   - [ ] Add comparison tests

3. **Enhanced Output Format** (Priority: Medium)
   - [ ] Add resolved type information to output
   - [ ] Include type hierarchy information
   - [ ] Add source location for all resolved types
   - [ ] Support multiple output formats

4. **Testing and Validation** (Priority: High)
   - [ ] Create comprehensive test suite
   - [ ] Add regression tests for complex types
   - [ ] Performance benchmarking
   - [ ] Real-world project testing

### Phase 5: Polish and Documentation (Week 5)
**Goal**: Final polish, documentation, and release preparation

#### Tasks:
1. **Documentation** (Priority: High)
   - [ ] Update README with new capabilities
   - [ ] Create API documentation
   - [ ] Add usage examples
   - [ ] Document limitations and workarounds

2. **CLI Enhancements** (Priority: Medium)
   - [ ] Add verbose mode for debugging
   - [ ] Improve error messages
   - [ ] Add type resolution depth control
   - [ ] Support watch mode

3. **Edge Case Handling** (Priority: Medium)
   - [ ] Handle circular type references
   - [ ] Support complex generic constraints
   - [ ] Handle declaration files (.d.ts)
   - [ ] Support triple-slash directives

4. **Release Preparation** (Priority: High)
   - [ ] Update version and changelog
   - [ ] Create migration guide from ts-morph
   - [ ] Performance comparison documentation
   - [ ] Update CI/CD pipelines

## Technical Architecture

### Core Components

```typescript
// src/services/compiler-api.ts
interface CompilerAPIService {
  createProgram(files: string[], options?: ts.CompilerOptions): ts.Program;
  getTypeChecker(): ts.TypeChecker;
}

// src/services/type-resolver.ts
interface ITypeResolver {
  resolveType(node: ts.Node): ResolvedType;
  getProperties(type: ts.Type): PropertyInfo[];
  expandGeneric(type: ts.Type): ExpandedType;
}

// src/services/type-walker.ts
interface TypeWalker {
  walk(type: ts.Type, depth: number): TypeStructure;
  visitNode(node: ts.Node): void;
}
```

### Key Implementation Details

1. **Program Creation**:
   ```typescript
   const program = ts.createProgram(files, {
     target: ts.ScriptTarget.Latest,
     module: ts.ModuleKind.CommonJS,
     lib: ["lib.es2021.d.ts"],
     strict: true,
     esModuleInterop: true,
     skipLibCheck: true,
     forceConsistentCasingInFileNames: true
   });
   ```

2. **Type Resolution**:
   ```typescript
   const checker = program.getTypeChecker();
   const type = checker.getTypeAtLocation(node);
   const expandedType = checker.typeToTypeNode(
     type,
     undefined,
     ts.NodeBuilderFlags.NoTruncation | ts.NodeBuilderFlags.InTypeAlias
   );
   ```

3. **Property Walking**:
   ```typescript
   function walkProperties(type: ts.Type): PropertyInfo[] {
     const properties = type.getProperties();
     return properties.map(prop => ({
       name: prop.getName(),
       type: checker.getTypeOfSymbolAtLocation(prop, prop.valueDeclaration),
       optional: !!(prop.flags & ts.SymbolFlags.Optional),
       description: ts.displayPartsToString(prop.getDocumentationComment(checker))
     }));
   }
   ```

## Success Criteria

1. **Functional Requirements**:
   - [ ] Full resolution of generic types without AI
   - [ ] Cross-file type resolution working
   - [ ] All existing tests passing
   - [ ] Performance equal or better than ts-morph

2. **Non-Functional Requirements**:
   - [ ] Memory usage under 500MB for large projects
   - [ ] Type resolution under 100ms per type
   - [ ] Zero external API dependencies for core functionality
   - [ ] Backward compatibility maintained

3. **Quality Metrics**:
   - [ ] 90%+ test coverage
   - [ ] No regression in existing functionality
   - [ ] Documentation coverage for all public APIs
   - [ ] Performance benchmarks documented

## Risks and Mitigations

1. **Risk**: TypeScript Compiler API complexity
   - **Mitigation**: Incremental implementation with extensive testing

2. **Risk**: Performance degradation
   - **Mitigation**: Implement caching and optimization from the start

3. **Risk**: Breaking changes for existing users
   - **Mitigation**: Feature flags and backward compatibility layer

4. **Risk**: Edge cases in type resolution
   - **Mitigation**: Comprehensive test suite and fallback mechanisms

## Timeline

- **Week 1**: Foundation and Architecture
- **Week 2**: Core Type Resolution
- **Week 3**: Advanced Features
- **Week 4**: Integration and Migration
- **Week 5**: Polish and Documentation

Total estimated time: 5 weeks for full implementation

## Conclusion

This refactoring will transform OpenPkg into a powerful, deterministic type resolution tool that doesn't require AI assistance for complex types. The TypeScript Compiler API provides all necessary capabilities for full type introspection and resolution, making OpenPkg more reliable and performant.