# Organizations Endpoints

Manage organizations, members, and invites.

**Auth:** Session required

## List Organizations

```
GET /orgs/
```

### Response

```json
{
  "organizations": [
    {
      "id": "org_123",
      "name": "My Org",
      "slug": "my-org",
      "plan": "team",
      "isPersonal": false,
      "aiCallsUsed": 25,
      "role": "owner"
    }
  ]
}
```

## Get Organization

```
GET /orgs/:slug
```

### Response

```json
{
  "organization": {
    "id": "org_123",
    "name": "My Org",
    "slug": "my-org",
    "plan": "team",
    "isPersonal": false,
    "aiCallsUsed": 25
  }
}
```

## List Projects

```
GET /orgs/:slug/projects
```

### Response

```json
{
  "projects": [
    {
      "id": "proj_123",
      "name": "core",
      "fullName": "org/core",
      "isPrivate": false,
      "coveragePercent": 85,
      "createdAt": "2024-01-15T00:00:00Z"
    }
  ]
}
```

## Create Project

```
POST /orgs/:slug/projects
```

**Role:** admin+

### Request

```json
{
  "name": "new-project",
  "fullName": "org/new-project",
  "isPrivate": false
}
```

### Response (201)

```json
{
  "project": { ... }
}
```

## Members

### List Members

```
GET /orgs/:slug/members
```

#### Response

```json
{
  "members": [
    {
      "id": "mem_123",
      "userId": "user_456",
      "role": "owner",
      "email": "user@example.com",
      "name": "John Doe",
      "image": "https://...",
      "createdAt": "2024-01-15T00:00:00Z"
    }
  ],
  "myRole": "owner"
}
```

### Update Member Role

```
PATCH /orgs/:slug/members/:userId
```

**Role:** owner only

#### Request

```json
{
  "role": "admin"
}
```

Cannot change owner role.

### Remove Member

```
DELETE /orgs/:slug/members/:userId
```

**Role:** admin+

- Cannot remove owner
- Admins cannot remove other admins

## Invites

### Create Invite

```
POST /orgs/:slug/invites
```

**Role:** admin+

#### Request

```json
{
  "email": "new@example.com",
  "role": "member"
}
```

#### Response (201)

```json
{
  "invite": {
    "id": "inv_123",
    "email": "new@example.com",
    "role": "member",
    "expiresAt": "2024-01-22T00:00:00Z"
  },
  "inviteUrl": "https://doccov.dev/invite/abc123"
}
```

Invites expire after 7 days.

### List Invites

```
GET /orgs/:slug/invites
```

**Role:** admin+

### Revoke Invite

```
DELETE /orgs/:slug/invites/:inviteId
```

**Role:** admin+

## Accept Invite (Public)

### Get Invite Info

```
GET /invites/:token
```

No auth required.

#### Response

```json
{
  "invite": {
    "id": "inv_123",
    "email": "new@example.com",
    "role": "member",
    "expiresAt": "2024-01-22T00:00:00Z",
    "orgName": "My Org",
    "orgSlug": "my-org"
  }
}
```

### Accept Invite

```
POST /invites/:token/accept
```

**Auth:** Session required

#### Response

```json
{
  "success": true,
  "orgSlug": "my-org"
}
```
