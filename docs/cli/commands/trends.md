# doccov trends

Track documentation coverage over time.

## Usage

```bash
doccov trends [options]
```

## Options

| Flag | Description |
|------|-------------|
| `--cwd <dir>` | Working directory |
| `-n, --limit <n>` | Snapshots to show (default: 10) |
| `--record` | Record current coverage to history |
| `--prune <n>` | Keep only N snapshots |
| `--json` | Output as JSON |
| `--extended` | Show velocity & projections |
| `--tier <tier>` | Retention: `free`, `team`, `pro` |
| `--weekly` | Weekly summary breakdown |

## Examples

### View trends

```bash
doccov trends
```

### Record snapshot

```bash
doccov trends --record
```

### Extended analysis

```bash
doccov trends --extended
```

### Weekly breakdown

```bash
doccov trends --weekly
```

### Prune old snapshots

```bash
doccov trends --prune 30
```

## Output

### Default

```
Coverage Trends (last 10 snapshots)
▁▂▃▄▅▆▇█▇█  85%

2024-01-15  85%  42 exports  abc123
2024-01-14  83%  40 exports  def456
2024-01-13  80%  38 exports  789abc
...
```

### Extended

```
Coverage Trends
▁▂▃▄▅▆▇█▇█  85%

Velocity:
  7-day:   +0.5%/day
  30-day:  +0.3%/day
  90-day:  +0.2%/day

Projection:
  30-day:  ~95% (at current velocity)

All-time:
  High:    85% (2024-01-15)
  Low:     42% (2023-10-01)
```

### Weekly

```
Week of 2024-01-08
  Start:  80%
  End:    85%
  Delta:  +5%
  Snapshots: 5

Week of 2024-01-01
  Start:  75%
  End:    80%
  Delta:  +5%
  ...
```

## Retention Tiers

| Tier | Retention |
|------|-----------|
| free | 7 days |
| team | 30 days |
| pro | 90 days |

## Storage

Snapshots stored in `.doccov/history/`:

```
.doccov/
  history/
    2024-01-15T10-00-00.json
    2024-01-14T10-00-00.json
    ...
```

Each snapshot:

```json
{
  "timestamp": "2024-01-15T10:00:00Z",
  "package": "@myorg/core",
  "version": "1.0.0",
  "coverageScore": 85,
  "totalExports": 42,
  "documentedExports": 36,
  "driftCount": 3,
  "commit": "abc123",
  "branch": "main"
}
```

## CI Integration

Record after each merge:

```yaml
- name: Record coverage
  run: doccov trends --record
```
