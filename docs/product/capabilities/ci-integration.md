# CI/CD Integration

> Last updated: 2024-12-10

How to integrate DocCov into your CI/CD pipeline.

---

## GitHub Actions

### Basic Setup
```yaml
- name: Check documentation
  run: doccov check --min-coverage 80
```

### Full Example
```yaml
name: Documentation
on: [push, pull_request]

jobs:
  doccov:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1

      - run: bun install
      - run: bun run build

      - name: Generate head spec
        run: doccov spec -o head.json

      - name: Check coverage
        run: doccov check --min-coverage 80

      - name: Diff (PRs only)
        if: github.event_name == 'pull_request'
        run: |
          git checkout ${{ github.base_ref }}
          doccov spec -o base.json
          git checkout ${{ github.sha }}
          doccov diff base.json head.json --format github --strict all
```

---

## Strict Modes

```bash
doccov diff base.json head.json --strict <modes>
```

| Mode | Fails When |
|------|------------|
| `regression` | Coverage decreased |
| `drift` | New drift issues |
| `docs-impact` | External docs need updates |
| `breaking` | Breaking changes detected |
| `undocumented` | New exports lack docs |
| `all` | Any of the above |

---

## GitHub Annotations

```bash
doccov diff base.json head.json --format github
```

Output appears inline in PR diffs:
```
::warning file=docs/api.md,line=30::API Change: method removed
```
