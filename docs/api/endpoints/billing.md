# Billing Endpoints

Manage subscriptions and usage.

**Auth:** Session required, admin+ role

## Start Checkout

```
GET /billing/checkout?plan=<plan>&orgId=<orgId>
```

### Parameters

| Param | Description |
|-------|-------------|
| `plan` | `team` or `pro` |
| `orgId` | Organization ID |

### Response

Redirects to Polar checkout page.

## Customer Portal

```
GET /billing/portal?orgId=<orgId>
```

### Response

Redirects to Polar customer portal for:
- Manage payment methods
- View invoices
- Cancel subscription

Returns 404 if no billing account exists.

## Billing Status

```
GET /billing/status?orgId=<orgId>
```

### Response

```json
{
  "plan": "team",
  "hasSubscription": true,
  "usage": {
    "aiCalls": 25,
    "resetAt": "2024-02-01T00:00:00Z"
  },
  "portalUrl": "https://polar.sh/..."
}
```

## Usage Details

```
GET /billing/usage?orgId=<orgId>
```

### Response

```json
{
  "plan": "team",
  "seats": 5,
  "monthlyCost": 49,
  "aiCalls": {
    "used": 25,
    "limit": 50,
    "resetAt": "2024-02-01T00:00:00Z"
  },
  "analyses": {
    "limit": 50,
    "resetAt": "2024-02-01T00:00:00Z"
  },
  "history": {
    "days": 30
  },
  "privateRepos": true
}
```

## Plan Comparison

| Feature | Free | Team ($49/mo) | Pro ($99/mo) |
|---------|------|---------------|--------------|
| Seats | 1 | 5 | 20 |
| AI Calls | 0 | 50/mo | 250/mo |
| Analyses | 0 | 50/day | 200/day |
| History | 0 days | 30 days | 90 days |
| Private Repos | No | Yes | Yes |

## Webhook

```
POST /billing/webhook
```

Polar webhook handler (no auth, signature verified).

### Events

| Event | Action |
|-------|--------|
| `subscription.active` | Upgrade org plan |
| `subscription.canceled` | Downgrade to free |
| `subscription.revoked` | Clear subscription, downgrade |

### Payload

```json
{
  "type": "subscription.active",
  "data": {
    "id": "sub_123",
    "metadata": {
      "orgId": "org_456"
    },
    "product": {
      "id": "prod_team"
    }
  }
}
```

## Environment Variables

```bash
POLAR_ACCESS_TOKEN=xxx
POLAR_WEBHOOK_SECRET=xxx
POLAR_PRODUCT_TEAM=prod_xxx
POLAR_PRODUCT_PRO=prod_xxx
```
