# GitHub App Endpoints

GitHub App installation and CI integration.

## Install App

```
GET /github/install?orgId=<orgId>
```

**Auth:** Session required

Redirects to GitHub App installation page with state token.

## Installation Callback

```
GET /github/callback?installation_id=<id>&state=<state>
```

Handles GitHub App installation callback:
1. Verifies state token
2. Creates `github_installations` record
3. Links installation to organization
4. Redirects to dashboard

## Check Status

```
GET /github/status?orgId=<orgId>
```

**Auth:** Session required

### Response

```json
{
  "installed": true,
  "installationId": 12345678,
  "installedAt": "2024-01-15T00:00:00Z"
}
```

Or if not installed:

```json
{
  "installed": false,
  "installUrl": "https://github.com/apps/doccov/installations/new"
}
```

## List Repositories

```
GET /github/repos?orgId=<orgId>
```

**Auth:** Session required

### Response

```json
{
  "repos": [
    {
      "id": 123456,
      "name": "my-repo",
      "full_name": "org/my-repo",
      "private": false
    }
  ]
}
```

Returns 404 with `installUrl` if app not installed.

## Webhook

```
POST /github/webhook
```

GitHub App webhook handler (signature verified).

### Events

#### installation

- `deleted` / `suspend` → Remove installation record

#### push

Default branch push:
1. Fetch repository content
2. Run DocCov analysis
3. Create/update GitHub check run
4. Update project coverage

#### pull_request

`opened` / `synchronize`:
1. Analyze PR head commit
2. Compare with base branch
3. Post PR comment with diff
4. Create check run with status

### Check Run

Creates GitHub check with:
- **Success**: Coverage meets thresholds
- **Failure**: Coverage below threshold or errors
- **Neutral**: Analysis completed with warnings

### PR Comment

```markdown
## DocCov Coverage Report

| Metric | Value |
|--------|-------|
| Coverage | 85% (+2%) |
| Breaking Changes | 0 |
| New Undocumented | 2 |

<details>
<summary>Undocumented Exports</summary>

- `newFunction` (src/utils.ts:42)
- `NewClass` (src/models.ts:15)

</details>
```

## Environment Variables

```bash
GITHUB_APP_ID=123456
GITHUB_APP_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n..."
GITHUB_APP_WEBHOOK_SECRET=whsec_xxx
```

## Installation Permissions

Required permissions:
- **Contents**: Read (fetch repo files)
- **Checks**: Read & Write (create check runs)
- **Pull requests**: Read & Write (post comments)
- **Metadata**: Read (repo info)

## Token Management

- Installation tokens cached with 5-minute buffer
- Auto-refresh on expiry
- Scoped to installation repositories
