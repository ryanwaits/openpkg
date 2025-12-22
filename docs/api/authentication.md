# Authentication

## Methods

### 1. Public (No Auth)

Badge and demo endpoints require no authentication:

```bash
curl https://api.doccov.dev/badge/owner/repo
```

Rate limited by IP address.

### 2. Session (Browser)

Dashboard uses session cookies via GitHub OAuth:

1. User visits `/auth/signin`
2. Redirects to GitHub OAuth
3. Returns with session cookie
4. Cookie sent automatically with requests

For browser-based integrations:
```typescript
// Session automatically included via cookies
fetch('https://api.doccov.dev/orgs/', {
  credentials: 'include'
});
```

### 3. API Key

For programmatic access to `/v1/*` endpoints:

```bash
curl https://api.doccov.dev/v1/ai/generate \
  -H "Authorization: Bearer doccov_abc123..."
```

## API Keys

### Create Key

Dashboard → Organization → Settings → API Keys → Create

Or via API (requires session):

```bash
POST /api-keys/
{
  "orgId": "org_123",
  "name": "CI Pipeline",
  "expiresIn": 90  // days (optional)
}
```

Response:
```json
{
  "id": "key_123",
  "key": "doccov_abc123...",  // Shown once!
  "name": "CI Pipeline",
  "prefix": "doccov_abc",
  "expiresAt": "2024-04-15T00:00:00Z"
}
```

### Key Format

```
doccov_{random_32_chars}
```

Example: `doccov_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6`

### Key Storage

Keys are hashed (SHA-256) before storage. Only the prefix is stored for identification.

### List Keys

```bash
GET /api-keys/?orgId=org_123
```

### Revoke Key

```bash
DELETE /api-keys/key_123
```

## Permissions

### Roles

| Role | Permissions |
|------|-------------|
| owner | Full access, billing, delete org |
| admin | Manage members, projects, API keys |
| member | Read access, use API keys |

### Endpoint Requirements

| Endpoint | Required Role |
|----------|---------------|
| `GET /orgs/*` | member |
| `POST /orgs/*/projects` | admin |
| `POST /orgs/*/invites` | admin |
| `PATCH /orgs/*/members/*` | owner |
| `GET /billing/*` | admin |
| `POST /api-keys/` | admin |

## GitHub OAuth

OAuth app settings:
- Scopes: `read:user`, `user:email`
- Callback: `{API_URL}/auth/callback/github`

## Environment Variables

```bash
GITHUB_CLIENT_ID=xxx
GITHUB_CLIENT_SECRET=xxx
```
