# @doccov/api

DocCov API server for badges, widgets, and scanning.

## Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /badge/:owner/:repo` | Coverage badge SVG |
| `GET /widget/:owner/:repo` | Coverage widget SVG |
| `GET /leaderboard` | Public rankings |
| `GET /scan-stream` | SSE repo scanning |
| `POST /api/examples/run` | Execute code |

## Badge

```markdown
![DocCov](https://api.doccov.com/badge/YOUR_ORG/YOUR_REPO)
```

## Development

```bash
cd packages/api
bun run dev
```

## Deployment

```bash
vercel --prod
```

## Documentation

- [API Overview](../../docs/api/overview.md)
- [Endpoints](../../docs/api/endpoints/)
- [Self-Hosting](../../docs/api/self-hosting.md)

## License

MIT
