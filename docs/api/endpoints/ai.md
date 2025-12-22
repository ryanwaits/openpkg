# AI Endpoints

Generate JSDoc documentation using AI.

**Auth:** API Key required (paid plans only)

## Generate JSDoc

```
POST /v1/ai/generate
```

### Headers

```
Authorization: Bearer doccov_xxx
Content-Type: application/json
```

### Request

```json
{
  "exports": [
    {
      "name": "createUser",
      "kind": "function",
      "signature": "function createUser(name: string, email: string): Promise<User>"
    },
    {
      "name": "User",
      "kind": "interface",
      "members": [
        { "name": "id", "type": "string" },
        { "name": "name", "type": "string" },
        { "name": "email", "type": "string" }
      ]
    }
  ],
  "packageName": "@myorg/users"
}
```

### Export Object

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Export name |
| `kind` | string | Yes | `function`, `class`, `interface`, `type`, `variable` |
| `signature` | string | No | Full type signature |
| `members` | array | No | For classes/interfaces |

### Limits

- Max 20 exports per request
- Quota: free=0, team=50/mo, pro=250/mo

### Response

```json
{
  "success": true,
  "generated": 2,
  "failed": 0,
  "results": [
    {
      "name": "createUser",
      "patch": "/**\n * Creates a new user with the given name and email.\n * \n * @param name - The user's display name\n * @param email - The user's email address\n * @returns Promise resolving to the created User object\n * \n * @example\n * ```ts\n * const user = await createUser('John', 'john@example.com');\n * console.log(user.id);\n * ```\n */"
    },
    {
      "name": "User",
      "patch": "/**\n * Represents a user in the system.\n */"
    }
  ],
  "quota": {
    "remaining": 48,
    "resetAt": "2024-02-01T00:00:00Z"
  }
}
```

### Errors

| Status | Code | Description |
|--------|------|-------------|
| 400 | `INVALID_REQUEST` | Missing/invalid exports |
| 401 | `UNAUTHORIZED` | Missing/invalid API key |
| 403 | `FREE_PLAN` | AI not available on free plan |
| 429 | `QUOTA_EXCEEDED` | Monthly quota exceeded |

#### Quota Exceeded Response

```json
{
  "error": "Monthly AI quota exceeded",
  "code": "QUOTA_EXCEEDED",
  "quota": {
    "limit": 50,
    "used": 50,
    "resetAt": "2024-02-01T00:00:00Z"
  }
}
```

## Check Quota

```
GET /v1/ai/quota
```

### Headers

```
Authorization: Bearer doccov_xxx
```

### Response

```json
{
  "plan": "team",
  "used": 25,
  "limit": 50,
  "remaining": 25,
  "resetAt": "2024-02-01T00:00:00Z"
}
```

## AI Models

Server-side generation uses:
- Primary: Claude Sonnet 4
- Fallback: GPT-4o-mini

## Quota Reset

Quotas reset on the 1st of each month at 00:00 UTC.

## CLI Integration

```bash
# Uses DOCCOV_API_KEY
doccov check --fix --generate
```

Or with local keys (BYOK fallback):

```bash
export OPENAI_API_KEY=sk-xxx
# or
export ANTHROPIC_API_KEY=sk-ant-xxx

doccov check --fix --generate
```
