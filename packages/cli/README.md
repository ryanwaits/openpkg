# @doccov/cli

Command-line interface for documentation coverage and drift detection.

## Install

```bash
npm install -g @doccov/cli
```

## Usage

```bash
# Check coverage
doccov check --min-coverage 80

# Generate spec
doccov generate -o openpkg.json

# Require examples
doccov check --require-examples
```

## Commands

| Command | Description |
|---------|-------------|
| `check` | Validate coverage thresholds |
| `generate` | Generate OpenPkg spec |
| `diff` | Compare two specs |
| `report` | Generate coverage report |
| `scan` | Analyze GitHub repos |
| `init` | Create config file |

## Documentation

- [CLI Overview](../../docs/cli/overview.md)
- [Command Reference](../../docs/cli/commands/)
- [Configuration](../../docs/cli/configuration.md)

## License

MIT
