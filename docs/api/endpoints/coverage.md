# Coverage Endpoints

Track coverage history and snapshots.

**Auth:** Session required

## Get History

```
GET /coverage/projects/:projectId/history
```

### Query Parameters

| Param | Default | Description |
|-------|---------|-------------|
| `range` | `30d` | `7d`, `30d`, `90d`, `all` |
| `limit` | `50` | Max snapshots to return |

### Response

```json
{
  "snapshots": [
    {
      "id": "snap_123",
      "version": "1.2.0",
      "branch": "main",
      "commitSha": "abc123",
      "coveragePercent": 85,
      "documentedCount": 36,
      "totalCount": 42,
      "descriptionCount": 40,
      "paramsCount": 35,
      "returnsCount": 38,
      "examplesCount": 20,
      "driftCount": 3,
      "source": "ci",
      "createdAt": "2024-01-15T10:00:00Z"
    }
  ],
  "insights": [
    {
      "type": "improvement",
      "message": "Coverage up 5% this week",
      "severity": "info"
    }
  ],
  "regression": null
}
```

### Insights

Generated automatically:
- Coverage trends (up/down)
- Significant changes
- Streak detection

### Regression Detection

If coverage dropped:

```json
{
  "regression": {
    "fromVersion": "1.1.0",
    "toVersion": "1.2.0",
    "coverageDrop": 5,
    "exportsLost": ["helperFn", "utilityClass"]
  }
}
```

### Plan Limits

| Plan | History |
|------|---------|
| free | 0 days |
| team | 30 days |
| pro | 90 days |

## Record Snapshot

```
POST /coverage/projects/:projectId/snapshots
```

**Role:** admin+

### Request

```json
{
  "version": "1.2.0",
  "branch": "main",
  "commitSha": "abc123def456",
  "coveragePercent": 85,
  "documentedCount": 36,
  "totalCount": 42,
  "descriptionCount": 40,
  "paramsCount": 35,
  "returnsCount": 38,
  "examplesCount": 20,
  "driftCount": 3,
  "source": "ci"
}
```

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `coveragePercent` | number | 0-100 |
| `documentedCount` | number | Documented exports |
| `totalCount` | number | Total exports |

### Optional Fields

| Field | Type | Description |
|-------|------|-------------|
| `version` | string | Package version |
| `branch` | string | Git branch |
| `commitSha` | string | Git commit SHA |
| `descriptionCount` | number | Exports with description |
| `paramsCount` | number | Functions with params docs |
| `returnsCount` | number | Functions with return docs |
| `examplesCount` | number | Exports with examples |
| `driftCount` | number | Drift issues |
| `source` | string | `ci`, `local`, `api` |

### Response (201)

```json
{
  "snapshot": {
    "id": "snap_456",
    ...
  }
}
```

Also updates project's `coveragePercent` to latest value.

## CI Integration

Record snapshots in CI:

```yaml
- name: Record coverage
  run: |
    REPORT=$(cat .doccov/report.json)
    curl -X POST https://api.doccov.dev/coverage/projects/$PROJECT_ID/snapshots \
      -H "Authorization: Bearer $DOCCOV_API_KEY" \
      -H "Content-Type: application/json" \
      -d "{
        \"coveragePercent\": $(echo $REPORT | jq .coverage.score),
        \"documentedCount\": $(echo $REPORT | jq .coverage.documentedExports),
        \"totalCount\": $(echo $REPORT | jq .coverage.totalExports),
        \"commitSha\": \"$GITHUB_SHA\",
        \"branch\": \"$GITHUB_REF_NAME\",
        \"source\": \"ci\"
      }"
```
