# CI/CD Integration

Integrate DocCov into various CI/CD systems.

## GitHub Actions

See [GitHub Action](./github-action.md) for full reference.

### Quick Setup

```yaml
name: Docs
on: [push, pull_request]

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npx @doccov/cli check --min-coverage 80
```

## GitLab CI

### Basic Check

```yaml
# .gitlab-ci.yml
docs:
  image: node:20
  script:
    - npm ci
    - npx @doccov/cli check --min-coverage 80
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
    - if: $CI_COMMIT_BRANCH == "main"
```

### With Diff

```yaml
docs-diff:
  image: node:20
  script:
    - npm ci
    # Generate head spec
    - npx @doccov/cli spec -o head.json
    # Get base spec from main
    - git fetch origin main
    - git checkout origin/main -- openpkg.json || echo "{}" > openpkg.json
    - mv openpkg.json base.json
    # Diff
    - npx @doccov/cli diff base.json head.json --fail-on-regression
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
```

## CircleCI

### Basic Check

```yaml
# .circleci/config.yml
version: 2.1

jobs:
  docs:
    docker:
      - image: cimg/node:20.0
    steps:
      - checkout
      - run: npm ci
      - run: npx @doccov/cli check --min-coverage 80

workflows:
  main:
    jobs:
      - docs
```

### With Cache

```yaml
jobs:
  docs:
    docker:
      - image: cimg/node:20.0
    steps:
      - checkout
      - restore_cache:
          keys:
            - npm-deps-{{ checksum "package-lock.json" }}
      - run: npm ci
      - save_cache:
          paths:
            - node_modules
          key: npm-deps-{{ checksum "package-lock.json" }}
      - run: npx @doccov/cli check --min-coverage 80
```

## Azure Pipelines

```yaml
# azure-pipelines.yml
trigger:
  - main
  - feature/*

pool:
  vmImage: 'ubuntu-latest'

steps:
  - task: NodeTool@0
    inputs:
      versionSpec: '20.x'

  - script: npm ci
    displayName: 'Install dependencies'

  - script: npx @doccov/cli check --min-coverage 80
    displayName: 'Check docs coverage'
```

## Jenkins

### Jenkinsfile

```groovy
pipeline {
    agent {
        docker {
            image 'node:20'
        }
    }

    stages {
        stage('Install') {
            steps {
                sh 'npm ci'
            }
        }

        stage('Docs Check') {
            steps {
                sh 'npx @doccov/cli check --min-coverage 80'
            }
        }
    }
}
```

## Pre-commit Hook

### Using Husky

```bash
npm install -D husky
npx husky init
```

Add to `.husky/pre-commit`:

```bash
#!/usr/bin/env sh
npx doccov check --min-coverage 80
```

### Using lint-staged

```json
{
  "lint-staged": {
    "*.ts": "doccov check --info"
  }
}
```

## npm Scripts

Add to `package.json`:

```json
{
  "scripts": {
    "docs:check": "doccov check --min-coverage 80",
    "docs:spec": "doccov spec -o openpkg.json",
    "docs:report": "doccov check --format markdown -o COVERAGE.md",
    "docs:strict": "doccov check --min-coverage 90 --examples presence"
  }
}
```

## Exit Codes

All CI systems check exit codes:

| Code | Meaning | CI Result |
|------|---------|-----------|
| 0 | Pass | Success |
| 1 | Fail | Failure (when `--min-coverage` threshold not met) |

## Artifacts

### Save Report

```yaml
# GitHub Actions
- run: npx @doccov/cli check --format html -o coverage.html
- uses: actions/upload-artifact@v4
  with:
    name: coverage
    path: coverage.html
```

### Save Spec

```yaml
- run: npx @doccov/cli spec -o openpkg.json
- uses: actions/upload-artifact@v4
  with:
    name: spec
    path: openpkg.json
```

## Environment Variables

No environment variables required for basic usage.

Optional:

| Variable | Description |
|----------|-------------|
| `OPENAI_API_KEY` | LLM fallback for entry detection |

## Caching Strategy

### Node Modules

```yaml
# GitHub Actions
- uses: actions/cache@v4
  with:
    path: node_modules
    key: ${{ runner.os }}-node-${{ hashFiles('package-lock.json') }}
```

### npm Cache

```yaml
- uses: actions/cache@v4
  with:
    path: ~/.npm
    key: ${{ runner.os }}-npm-${{ hashFiles('package-lock.json') }}
```

## See Also

- [GitHub Action](./github-action.md) - Full action reference
- [check Command](../cli/commands/check.md) - CLI options
- [diff Command](../cli/commands/diff.md) - Compare specs
