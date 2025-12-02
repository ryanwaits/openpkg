# API Reference

## createClient

Create a new API client.

```typescript
import { createClient } from 'my-sdk';

const client = createClient('https://api.example.com', 'my-key');
```

## fetchData

Fetch data from an endpoint.

```typescript
import { createClient, fetchData } from 'my-sdk';

const client = createClient('https://api.example.com', 'key');
const result = fetchData(client, '/endpoint');
```

