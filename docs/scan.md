# DocCov Scan Architecture Overview

## CLI Commands (`@doccov/cli`)

| Command | Input | Output | Use Case |
|---------|-------|--------|----------|
| `generate` | Local dir/entry | `openpkg.json` spec file | Generate API spec for a local project |
| `check` | Local dir/entry | Pass/fail + coverage % | CI validation, pre-commit hooks |
| `scan` | GitHub URL | JSON coverage summary | Analyze any public GitHub repo remotely |
| `diff` | Two specs | Diff report | Compare API changes between versions |
| `init` | Interactive | `doccov.config.ts` | Project setup |

---

## Execution Paths

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              USER INTERFACES                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   Local Development          CI/CD Pipeline          Web/Badge Service      │
│   ─────────────────          ──────────────          ────────────────       │
│   $ doccov generate          $ doccov check          POST /scan             │
│   $ doccov check             $ doccov diff           GET /badge/:owner/:repo│
│   $ doccov scan <url>                                                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                │                      │                       │
                ▼                      ▼                       ▼
┌───────────────────────┐  ┌───────────────────────┐  ┌───────────────────────┐
│     CLI (local)       │  │     CLI (local)       │  │   Vercel API          │
│                       │  │                       │  │                       │
│  • Has filesystem     │  │  • Runs in CI runner  │  │  api/index.ts (Edge)  │
│  • Direct SDK access  │  │  • Exit code = status │  │  ├─ /health           │
│  • Full type res.     │  │  • JSON for pipelines │  │  └─ /badge/*          │
└───────────────────────┘  └───────────────────────┘  │                       │
         │                          │                 │  api/scan.ts (Node)   │
         ▼                          ▼                 │  └─ /scan (POST)      │
┌─────────────────────────────────────────────────┐  └───────────────────────┘
│                  @doccov/sdk                     │             │
│                                                  │             ▼
│  • TypeScript AST analysis                       │  ┌───────────────────────┐
│  • TSDoc parsing                                 │  │   Vercel Sandbox      │
│  • Coverage calculation                          │  │                       │
│  • Drift detection                               │  │  Isolated container:  │
│                                                  │  │  1. Clone repo        │
└──────────────────────────────────────────────────┘  │  2. npm install       │
                                                      │  3. doccov generate   │
                                                      │  4. Return JSON       │
                                                      └───────────────────────┘
```

---

## Command Details

### 1. `doccov generate` (Local)
```bash
doccov generate --cwd ./my-project -o openpkg.json
```
- **Who uses it**: Library authors documenting their API
- **Outputs**: Full OpenPkg spec with exports, types, docs coverage, drift

### 2. `doccov check` (Local/CI)
```bash
doccov check --min-coverage 80 --require-examples
```
- **Who uses it**: CI pipelines, pre-commit hooks
- **Outputs**: Exit 0 (pass) or Exit 1 (fail) + coverage report

### 3. `doccov scan <url>` (CLI → Remote)
```bash
doccov scan https://github.com/owner/repo --ref main --package @scope/pkg
```
- **Who uses it**: Developers checking any public repo's docs quality
- **Process**: Clones locally, installs deps, runs SDK analysis
- **Outputs**: Coverage summary JSON or formatted text

### 4. `POST /scan` (API → Vercel Sandbox)
```bash
curl -X POST https://api.doccov.dev/scan \
  -d '{"url": "https://github.com/owner/repo"}'
```
- **Who uses it**: Web UI, badges, integrations
- **Process**: Spins up isolated Vercel Sandbox → runs `doccov generate`
- **Outputs**: JSON coverage summary

---

## DX/UX Use Cases

| Persona | Tool | Flow |
|---------|------|------|
| **Library Author** | CLI `generate` + `check` | Local dev → CI validation → publish with spec |
| **Contributor** | CLI `diff` | Compare PR changes against main branch API |
| **Consumer** | Web badge / `scan` | Quick check of any library's doc quality |
| **Platform** | API `/scan` | Automated analysis for leaderboards, badges |

---

## Key Files

| File | Purpose |
|------|---------|
| `packages/cli/src/commands/scan.ts` | CLI scan (clones + analyzes locally) |
| `packages/cli/src/commands/check.ts` | CI-friendly local validation |
| `packages/cli/src/commands/generate.ts` | Full spec generation |
| `packages/api/api/scan.ts` | Vercel serverless → Sandbox execution |
| `packages/api/api/index.ts` | Edge routes (health, badge, root) |
| `packages/sdk/src/openpkg.ts` | Core analysis engine |