# Getting Started with My SDK

Install the package:

```bash
npm install my-sdk
```

## Quick Start

Create a client and fetch some data:

```typescript
import { createClient, fetchData } from 'my-sdk';

const client = createClient('https://api.example.com', 'sk-123');

// Fetch users
const users = fetchData(client, '/users');
console.log(users);
```

## Legacy API

For backwards compatibility, you can still use:

```typescript
import { legacyFetch } from 'my-sdk';

const data = legacyFetch('https://api.example.com/users');
```

