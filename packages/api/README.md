# @doccov/api

DocCov API server for badge generation and coverage services.

## Endpoints

### Badge Endpoint

```
GET /badge/:owner/:repo
```

Returns an SVG badge showing the documentation coverage percentage.

**Query Parameters:**
- `branch` - Git branch to fetch from (default: `main`)

**Example:**
```
https://api.doccov.com/badge/tanstack/query
```

**Embed in README:**
```markdown
![DocCov](https://api.doccov.com/badge/your-org/your-repo)
```

### Health Check

```
GET /health
```

Returns API health status.

## Development

```bash
# Install dependencies
bun install

# Run in development mode
bun run dev

# Start production server
bun run start
```

## Environment Variables

- `PORT` - Server port (default: 3000)

## License

MIT

