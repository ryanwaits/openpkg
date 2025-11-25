# DocCov GitHub Action

Check documentation coverage and detect drift in TypeScript projects.

## Usage

```yaml
name: Docs Coverage
on: [push, pull_request]

jobs:
  doccov:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: doccov/doccov@v1
        with:
          min-coverage: 80
          require-examples: false
          comment-on-pr: true
```

## Inputs

| Input | Description | Default |
|-------|-------------|---------|
| `min-coverage` | Minimum coverage percentage (0-100) | `80` |
| `require-examples` | Require @example blocks on all exports | `false` |
| `fail-on-regression` | Fail if coverage regresses | `false` |
| `fail-on-drift` | Fail if new drift is introduced | `false` |
| `comment-on-pr` | Post coverage report as PR comment | `true` |
| `working-directory` | Working directory for the check | `.` |
| `github-token` | GitHub token for PR comments | `${{ github.token }}` |

## PR Comments

When `comment-on-pr` is enabled, the action posts a comment on PRs with:

- Coverage percentage change
- New undocumented exports
- Drift issues introduced/resolved

## Badge

Add a coverage badge to your README:

```markdown
![DocCov](https://api.doccov.com/badge/your-org/your-repo)
```

## License

MIT

