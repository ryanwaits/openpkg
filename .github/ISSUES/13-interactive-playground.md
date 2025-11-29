# Phase 8B-C: Interactive Playground & UI Components

**Priority:** Future
**Phase:** 8B, 8C
**Labels:** `enhancement`, `api`, `ui`, `premium`

## Summary

Build an interactive code playground where users can experiment with documented packages. This is the premium upgrade path from the free example runner.

## 8B: Playground Backend

### POST /playground/run Endpoint

Full sandbox session with npm install capability.

```typescript
// Request
POST /api/playground/run
{
  "code": "import { z } from 'zod';\nconst schema = z.string();\nconsole.log(schema.parse('hello'));",
  "packages": [
    { "name": "zod", "version": "3.22.4" }
  ],
  "timeout": 10000
}

// Response
{
  "success": true,
  "stdout": "hello\n",
  "stderr": "",
  "exitCode": 0,
  "duration": 1234,
  "installedPackages": ["zod@3.22.4"]
}
```

**Features:**
- Full npm package installation
- TypeScript execution with type checking
- Configurable timeout (max 30s)
- Rate limiting: 10 free / unlimited premium
- Session caching for repeated runs with same deps

**Tasks:**
- [ ] 8.4a: POST /playground/run endpoint
- [ ] 8.4b: Package installation in sandbox
- [ ] 8.4c: Rate limiting with user authentication
- [ ] 8.4d: Session caching for dependency reuse

### Shareable Playground Links

```
https://doccov.com/playground?code=base64...&packages=zod@3.22
```

**Tasks:**
- [ ] 8.6a: URL state encoding (gzip + base64)
- [ ] 8.6b: Short URL generation with database storage
- [ ] 8.6c: Fork & remix functionality

## 8C: Playground UI Components

### Monaco Editor Integration

Full-featured code editor with TypeScript support.

```tsx
import { PlaygroundEditor } from '@doccov/playground';

<PlaygroundEditor
  code={code}
  onChange={setCode}
  packages={['zod@3.22']}
  theme="dark"
  showTypeHints
  height={400}
/>
```

**Features:**
- TypeScript language server
- Auto-import from installed packages
- Inline type hints and errors
- Syntax highlighting
- Keyboard shortcuts

**Tasks:**
- [ ] 8.5a: Monaco React wrapper component
- [ ] 8.5b: TypeScript worker setup
- [ ] 8.5c: Generate .d.ts from OpenPkg spec
- [ ] 8.5d: Auto-import suggestions

### Output Panel

Real-time stdout/stderr display with error highlighting.

```tsx
<OutputPanel
  stdout={result.stdout}
  stderr={result.stderr}
  exitCode={result.exitCode}
  duration={result.duration}
  onClear={() => setResult(null)}
/>
```

**Features:**
- Syntax-highlighted output
- Error stack trace parsing
- Source map support for error line mapping
- Copy to clipboard
- Clear output

**Tasks:**
- [ ] 8.9a: Read-only code block with play button
- [ ] 8.9b: Real-time output panel
- [ ] 8.9c: Error line highlighting in editor
- [ ] 8.9d: Stack trace source mapping

### Environment Toggles

```tsx
<EnvironmentConfig
  environments={{
    jsdom: { enabled: true, label: 'Browser APIs' },
    node: { enabled: true, label: 'Node.js APIs' },
  }}
  onChange={setEnvironment}
/>
```

**Tasks:**
- [ ] 8.10a: jsdom toggle for DOM examples
- [ ] 8.10b: Node.js built-in module support
- [ ] 8.10c: Environment indicator in UI

## Complete Playground UI

```
┌─────────────────────────────────────────────────────────────┐
│  DocCov Playground          [zod@3.22 ▼]  [▶ Run] [Share]   │
├─────────────────────────────────────────────────────────────┤
│                              │                              │
│  import { z } from 'zod';   │  Output                      │
│                              │  ──────                      │
│  const UserSchema = z.obj.. │  hello                       │
│    name: z.string(),        │                              │
│    age: z.number(),         │  ✓ Executed in 45ms         │
│  });                        │                              │
│                              │                              │
│  console.log(UserSchema.p.. │  [Copy] [Clear]              │
│                              │                              │
├─────────────────────────────────────────────────────────────┤
│  [✓] Browser APIs   [ ] Node.js   TypeScript 5.3           │
└─────────────────────────────────────────────────────────────┘
```

## Premium Features

| Feature | Free | Pro |
|---------|------|-----|
| Runs per day | 10 | Unlimited |
| Max timeout | 5s | 30s |
| Package install | 1 | 10 |
| Shareable links | 5 | Unlimited |
| Private playgrounds | No | Yes |
| Custom npm registry | No | Yes |

## Technical Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────────┐
│   Monaco    │────▶│   API       │────▶│ Vercel Sandbox  │
│   Editor    │     │   Gateway   │     │ (code execution)│
└─────────────┘     └──────┬──────┘     └─────────────────┘
                           │
                    ┌──────┴──────┐
                    │   Redis     │
                    │ (rate limit,│
                    │  sessions)  │
                    └─────────────┘
```

## Acceptance Criteria

### Backend (8B)
- [ ] POST /playground/run with full npm support
- [ ] Rate limiting (10 free / unlimited premium)
- [ ] Session caching for dependency reuse
- [ ] Shareable URL generation
- [ ] Short URL database storage

### Frontend (8C)
- [ ] Monaco editor with TypeScript support
- [ ] Auto-import from package exports
- [ ] Real-time output panel
- [ ] Error highlighting with source maps
- [ ] Environment toggles (jsdom, Node.js)
- [ ] Responsive design for mobile
- [ ] Dark/light theme support
