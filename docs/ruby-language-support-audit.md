# Ruby Language Support Audit for DocCov

## Executive Summary

**Difficulty: Medium-High**

Adding Ruby support to DocCov is feasible but requires significant work. Ruby's ecosystem has mature tooling for AST parsing, type signatures, and documentation extraction. The main challenge is DocCov's current TypeScript-centric architecture which lacks a pluggable language abstraction.

| Factor | Assessment |
|--------|------------|
| Ruby Tooling Maturity | **Excellent** - YARD, Prism, RBS, Sorbet ecosystem |
| DocCov Architecture Readiness | **Low** - Hardcoded for TypeScript |
| Estimated Implementation Effort | **Medium-High** - 3-4 weeks full-time |
| Technical Risk | **Low** - Clear path, proven tools |

---

## Part 1: DocCov Architecture Analysis

### Current State

DocCov is **TypeScript-only** with the analysis pipeline tightly coupled to the TypeScript Compiler API:

```
packages/sdk/src/
├── detect/           # Generic project detection
├── analysis/
│   ├── program.ts    # ts.createProgram() ← TS-specific
│   ├── context.ts    # Holds ts.TypeChecker ← TS-specific
│   ├── spec-builder.ts   # Uses ts.isFunctionDeclaration(), etc.
│   └── serializers/  # All use TS AST nodes
└── utils/
    └── type-formatter.ts  # Converts TS types → JSON Schema
```

**Key Coupling Points:**
1. `AnalysisContext` holds `ts.Program`, `ts.TypeChecker`, `ts.SourceFile`
2. `buildOpenPkgSpec()` iterates TS AST with `ts.is*Declaration()` checks
3. All serializers accept TS-specific node types
4. Type formatter uses `ts.Type` and `ts.TypeChecker`
5. Ecosystem hardcoded as `'js/ts'` in spec-builder.ts:67

### What DocCov Needs for Multi-Language Support

```typescript
// Proposed abstraction (doesn't exist yet)
interface LanguageAnalyzer {
  language: 'typescript' | 'ruby' | 'python' | 'go';
  detectProject(dir: string): Promise<ProjectInfo>;
  createProgram(entryFile: string): Promise<ProgramLike>;
  getExportedSymbols(): Symbol[];
  serializeExport(symbol: Symbol): ExportDefinition;
  formatType(type: any): SpecSchema;
  extractDocumentation(node: any): string | null;
}
```

### Required DocCov Refactoring

| Component | Current | Required Change |
|-----------|---------|-----------------|
| detect/ | Generic | Add language detection (gem vs npm) |
| analysis/context.ts | TS-specific | Abstract to LanguageContext |
| analysis/program.ts | ts.createProgram | Language-specific loaders |
| analysis/serializers/* | 8 TS-specific files | Per-language serializer suites |
| utils/type-formatter.ts | TS types → JSON Schema | Per-language type mappers |

---

## Part 2: Ruby Ecosystem Analysis

### 2.1 AST Parsing Options

#### Option A: Prism (Recommended for Ruby 3.4+)

- **Source**: [github.com/ruby/prism](https://github.com/ruby/prism)
- **Status**: Ruby's official parser since 3.4
- **Key Features**:
  - Built into Ruby stdlib
  - Faster than legacy parsers
  - `Prism::Translation::Parser` provides compatibility with legacy AST format
  - Rich location information

```ruby
require 'prism'
result = Prism.parse("def hello(name); end")
result.value # => AST node tree
```

#### Option B: Parser gem (Ruby < 3.4)

- **Source**: [github.com/whitequark/parser](https://github.com/whitequark/parser)
- **Status**: De facto standard before Prism
- **Key Features**:
  - Powers RuboCop
  - Supports Ruby 1.8 through 3.3
  - Well-documented AST format
  - `ruby-parse` CLI tool

```ruby
require 'parser/current'
Parser::CurrentRuby.parse("def hello(name); end")
```

#### Option C: rubocop-ast

- **Source**: [docs.rubocop.org/rubocop-ast](https://docs.rubocop.org/rubocop-ast/index.html)
- **Status**: Enhanced wrapper around Parser gem
- **Key Features**:
  - `RuboCop::AST::Node` with convenient traversal
  - `NodePattern` for regex-style AST matching
  - Battle-tested in RuboCop

**Recommendation**: Use Prism with fallback to Parser gem for Ruby < 3.4.

---

### 2.2 Documentation Extraction

#### YARD (Primary Recommendation)

- **Source**: [yardoc.org](https://yardoc.org/)
- **Status**: Industry standard
- **Key Features**:
  - `@tag` style syntax (like JSDoc/TSDoc)
  - Machine-readable `.yardoc` database (Marshal-serialized)
  - `yard stats --list-undoc` for coverage analysis
  - Programmatic access via `YARD::Registry`

```ruby
# Example YARD documentation
# @param name [String] the user's name
# @param age [Integer, nil] optional age
# @return [String] greeting message
def greet(name, age = nil)
  "Hello, #{name}!"
end
```

**Registry Access**:
```ruby
require 'yard'
YARD::Registry.load('.yardoc')
YARD::Registry.all(:method).each do |method|
  puts method.docstring
  method.tags(:param).each { |t| puts "#{t.name}: #{t.types}" }
end
```

**JSON/Raw Data Output**:
YARD stores objects as Marshal dumps, but provides API to traverse and export:
```ruby
YARD::Registry.all.each do |obj|
  # obj.docstring, obj.signature, obj.tags, obj.source_type
end
```

#### RDoc (Alternative)

- **Source**: Ruby stdlib
- **Status**: Bundled with Ruby
- **Limitation**: Less structured metadata, no type annotations

**Recommendation**: YARD is strongly preferred for its structured tags and type annotations.

---

### 2.3 Type Signature Systems

#### RBS (Official Ruby 3.0+ Type Signatures)

- **Source**: [github.com/ruby/rbs](https://github.com/ruby/rbs)
- **Status**: Official Ruby type language
- **File Format**: `.rbs` files separate from code

```rbs
# sig/user.rbs
class User
  attr_reader name: String
  attr_reader age: Integer?

  def initialize: (String name, ?Integer age) -> void
  def greet: () -> String
end
```

**Key Commands**:
```bash
rbs prototype rb lib/user.rb  # Generate RBS from Ruby code
rbs parse sig/user.rbs        # Validate RBS syntax
```

#### Sorbet (Stripe's Type Checker)

- **Source**: [sorbet.org](https://sorbet.org/)
- **Status**: Widely adopted, inline annotations
- **File Format**: Inline `sig` blocks + `.rbi` stubs

```ruby
# typed: strict
class User
  extend T::Sig

  sig { params(name: String, age: T.nilable(Integer)).void }
  def initialize(name, age = nil)
    @name = name
    @age = age
  end

  sig { returns(String) }
  def greet
    "Hello, #{@name}!"
  end
end
```

#### Tapioca (RBI Generation)

- **Source**: [github.com/Shopify/tapioca](https://github.com/Shopify/tapioca)
- **Status**: Shopify-maintained, recommended by Sorbet
- **Purpose**: Auto-generate RBI files for gems and DSLs

```bash
bundle exec tapioca init
bundle exec tapioca gems    # Generate RBI for dependencies
bundle exec tapioca dsl     # Generate RBI for Rails DSL methods
```

**Recommendation**:
- Primary: RBS (standard) + YARD annotations
- Secondary: Sorbet RBI support for projects using it

---

### 2.4 Language Server & Static Analysis

#### Solargraph

- **Source**: [solargraph.org](https://solargraph.org/)
- **Status**: Most mature Ruby LSP
- **Key Features**:
  - Intellisense via YARD
  - Type inference
  - `solargraph scan` for project analysis
  - JSON reporter available

```bash
gem install solargraph
solargraph scan --reporter json
```

#### Steep

- **Source**: [github.com/soutaro/steep](https://github.com/soutaro/steep)
- **Status**: RBS-based type checker
- **Key Features**:
  - Static type checking using RBS
  - LSP support
  - Good integration with ruby-lsp

#### Ruby LSP (Shopify)

- **Source**: [github.com/Shopify/ruby-lsp](https://github.com/Shopify/ruby-lsp)
- **Status**: Newer, actively developed
- **Key Features**:
  - Extensible architecture
  - Better performance
  - Prism-based

---

### 2.5 Documentation Coverage Tools

| Tool | Purpose | Output |
|------|---------|--------|
| `yard stats` | YARD doc coverage | Text/percentages |
| `yard stats --list-undoc` | List undocumented items | Text list |
| [Yardstick](https://github.com/dkubb/yardstick) | Advanced YARD coverage | Detailed metrics |
| [Inch](https://github.com/rrrene/inch) | Documentation quality | Grades (A-F) |

---

## Part 3: Implementation Strategy

### Recommended Approach

#### Phase 1: DocCov Core Refactoring (Pre-requisite)

Before adding Ruby, DocCov needs a language abstraction layer:

1. **Create `LanguageAnalyzer` interface** in `/packages/sdk/src/analysis/languages/`
2. **Refactor TypeScript support** as first implementation
3. **Abstract `AnalysisContext`** to be language-generic
4. **Add language detection** to project detection phase

Estimated effort: **1-2 weeks**

#### Phase 2: Ruby Implementation

```
packages/sdk/src/analysis/languages/ruby/
├── index.ts              # RubyAnalyzer class
├── program.ts            # Invoke Ruby parser (Prism/Parser)
├── yard-registry.ts      # YARD database reader
├── rbs-parser.ts         # RBS file parser (optional)
├── type-formatter.ts     # Ruby types → JSON Schema
├── serializers/
│   ├── methods.ts        # def/def self.
│   ├── classes.ts        # class/module
│   ├── modules.ts        # module (mixins)
│   ├── constants.ts      # CONST = value
│   └── attributes.ts     # attr_reader/writer/accessor
└── doc-parser.ts         # YARD tag extraction
```

#### Phase 3: CLI Integration

1. Add `--language ruby` flag (or auto-detect from Gemfile)
2. Add Ruby-specific config options (RBS paths, YARD options)
3. Add Ruby examples to documentation

---

### Technical Decisions

#### Decision 1: How to Run Ruby Parsers?

**Option A: Shell out to Ruby scripts** (Recommended)
```typescript
// From TypeScript
const result = await exec('ruby scripts/parse.rb lib/myclass.rb');
const ast = JSON.parse(result.stdout);
```
- Pros: Use native Ruby gems, simpler
- Cons: Ruby runtime dependency

**Option B: Use WASM Ruby** (Future consideration)
- [Ruby.wasm](https://github.com/aspect-build/aspect-cli) exists but immature
- Not recommended for v1

**Option C: Port logic to TypeScript**
- Impractical, would duplicate Ruby ecosystem

**Recommendation**: Option A - shell out to Ruby with bundled scripts.

#### Decision 2: Type Extraction Priority

| Source | Priority | Rationale |
|--------|----------|-----------|
| RBS files | 1st | Official, standardized |
| YARD annotations | 2nd | Widely used, rich metadata |
| Sorbet sigs | 3rd | Popular in larger projects |
| Type inference | 4th | Fallback, limited |

#### Decision 3: Export Detection

Ruby's visibility model differs from TypeScript:

| TypeScript | Ruby |
|------------|------|
| `export function` | Public method in module |
| `export class` | Class defined at top-level |
| `export const` | Constant (`CONST = ...`) |
| `export default` | No equivalent |

Detection strategy:
1. Parse entry file (e.g., `lib/mygem.rb`)
2. Follow `require`/`require_relative` to build full picture
3. Mark public methods/classes as "exports"
4. Respect Ruby's `private`/`protected`/`public` modifiers

---

## Part 4: Ruby-Specific Mapping to OpenPkg

### Export Kinds Mapping

| Ruby Construct | OpenPkg Kind | Notes |
|----------------|--------------|-------|
| `def method_name` | `function` | Instance method |
| `def self.method_name` | `function` | Class method, mark as `static` |
| `class Foo` | `class` | |
| `module Bar` | `module` | Could also map to `namespace` |
| `CONST = value` | `variable` | With `const: true` |
| `attr_reader :name` | Property on class | |
| `Foo = Struct.new(:a, :b)` | `class` | Struct as class |

### Type Mapping

| Ruby Type (RBS/YARD) | OpenPkg Schema |
|----------------------|----------------|
| `String` | `{ type: 'string' }` |
| `Integer` | `{ type: 'integer' }` |
| `Float` | `{ type: 'number' }` |
| `TrueClass \| FalseClass` or `bool` | `{ type: 'boolean' }` |
| `nil` | `{ type: 'null' }` |
| `Array[String]` | `{ type: 'array', items: { type: 'string' } }` |
| `Hash[Symbol, Integer]` | `{ type: 'object', additionalProperties: { type: 'integer' } }` |
| `String?` (nilable) | `{ anyOf: [{ type: 'string' }, { type: 'null' }] }` |
| `String \| Integer` | `{ anyOf: [...] }` |
| `untyped` | `{ type: 'any' }` |

---

## Part 5: Risk Assessment

### Low Risk
- **YARD ecosystem maturity**: Well-documented, stable APIs
- **Prism availability**: Built into Ruby 3.4+
- **RBS standardization**: Official Ruby type language

### Medium Risk
- **Ruby version fragmentation**: Need to support Ruby 2.7-3.4+
  - Mitigation: Use Parser gem for < 3.4, Prism for 3.4+
- **YARD adoption variance**: Not all projects use YARD
  - Mitigation: Fall back to basic AST analysis
- **Dynamic metaprogramming**: Ruby's `define_method`, `method_missing`
  - Mitigation: Skip or warn, focus on static definitions

### Considerations
- **Runtime dependency**: Requires Ruby installed
  - Could be optional: "Install Ruby for Ruby project support"
- **Performance**: Shelling out to Ruby adds latency
  - Mitigation: Batch operations, cache results

---

## Part 6: Recommended Gems & Tools

### Core Dependencies (Ruby side)

```ruby
# Gemfile for DocCov Ruby analysis
source 'https://rubygems.org'

gem 'prism'           # AST parsing (Ruby 3.3+)
gem 'parser'          # AST parsing (Ruby < 3.4 fallback)
gem 'yard'            # Documentation extraction
gem 'rbs'             # Type signature parsing
gem 'solargraph'      # Optional: enhanced analysis
```

### CLI Tools to Leverage

| Tool | Command | Output |
|------|---------|--------|
| YARD | `yard doc --db .yardoc` | Marshal database |
| YARD | `yard stats --list-undoc` | Coverage report |
| RBS | `rbs prototype rb lib/` | RBS from Ruby |
| RBS | `rbs parse sig/*.rbs` | Validate RBS |
| Prism | `ruby -r prism -e "puts Prism.parse(ARGF.read).value.inspect"` | AST |

---

## Part 7: Effort Estimate

### Phase 1: Core Refactoring
| Task | Effort |
|------|--------|
| Design LanguageAnalyzer interface | 2 days |
| Refactor TS as first implementation | 3-4 days |
| Add language detection | 1 day |
| **Subtotal** | **~1.5 weeks** |

### Phase 2: Ruby Implementation
| Task | Effort |
|------|--------|
| Ruby parser integration (Prism/Parser) | 3 days |
| YARD registry reader | 2-3 days |
| Export serializers (methods, classes, modules) | 4-5 days |
| Type formatter (Ruby → JSON Schema) | 2-3 days |
| RBS parser integration | 2 days |
| Testing & edge cases | 3 days |
| **Subtotal** | **~3 weeks** |

### Phase 3: Integration
| Task | Effort |
|------|--------|
| CLI flags & config | 1 day |
| Documentation | 1 day |
| CI/CD for Ruby | 1 day |
| **Subtotal** | **~3 days** |

**Total Estimated Effort: 4-5 weeks**

---

## Part 8: Conclusion & Recommendations

### Should You Do It?

**YES**, if:
- Ruby is a target ecosystem for DocCov users
- You're willing to invest in the core refactoring first
- You can accept Ruby as a runtime dependency

**WAIT**, if:
- TypeScript-only serves current users well
- Resources are limited
- Multi-language is not on the roadmap

### Recommended Next Steps

1. **Validate demand**: Survey users about Ruby support need
2. **Design the abstraction**: Create `LanguageAnalyzer` interface RFC
3. **Prototype**: Build minimal Ruby → OpenPkg proof of concept
4. **Refactor core**: Make TS the first LanguageAnalyzer implementation
5. **Implement Ruby**: Follow the phased approach above

### Alternative: Plugin Architecture

Instead of built-in support, DocCov could expose a plugin interface:

```typescript
// doccov-plugin-ruby
export default {
  name: 'ruby',
  detect: (dir) => fs.existsSync(path.join(dir, 'Gemfile')),
  analyze: (entryFile) => { /* ... */ },
} satisfies DocCovLanguagePlugin;
```

This would allow community-driven language support while keeping core lean.

---

## References

### Ruby Tools
- [YARD Documentation](https://yardoc.org/)
- [Prism Parser](https://github.com/ruby/prism)
- [Parser gem](https://github.com/whitequark/parser)
- [RBS](https://github.com/ruby/rbs)
- [Sorbet](https://sorbet.org/)
- [Tapioca](https://github.com/Shopify/tapioca)
- [Solargraph](https://solargraph.org/)

### Documentation Coverage
- [YARD stats guide](https://joeyates.info/posts/checking-yard-documentation-coverage/)
- [Yardstick gem](https://github.com/dkubb/yardstick)

### Type Systems
- [RBS Syntax](https://github.com/ruby/rbs/blob/master/docs/syntax.md)
- [Sorbet Signatures](https://sorbet.org/docs/sigs)
- [Prism Translation Layer](https://docs.ruby-lang.org/en/3.4/Prism/Translation/Parser.html)
