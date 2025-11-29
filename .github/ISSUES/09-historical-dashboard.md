# Phase 6: Historical Versioning & Dashboard

**Priority:** Future (2025+)
**Phase:** 6
**Labels:** `enhancement`, `api`, `dashboard`, `major-feature`

## Summary

Build a web dashboard to track documentation health over time. Persist specs to a database, visualize trends, and enable version comparison.

## Features

### 6.1: Spec Persistence

Store specs in a database for historical tracking.

```typescript
// Database schema (Prisma)
model Spec {
  id          String   @id @default(cuid())
  owner       String
  repo        String
  branch      String   @default("main")
  commitSha   String
  coverage    Float
  driftCount  Int
  spec        Json     // Full OpenPkg spec
  createdAt   DateTime @default(now())

  @@unique([owner, repo, commitSha])
  @@index([owner, repo])
}
```

**Tasks:**
- [ ] Set up Prisma with Turso/PlanetScale
- [ ] POST /api/specs/:owner/:repo endpoint to store specs
- [ ] Auto-upload spec on GitHub Action runs

### 6.2: Trend Dashboard

Web dashboard showing coverage over time.

```
┌─────────────────────────────────────────────────────────────┐
│  tanstack/query                                    ⚙️ Settings │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Coverage Trend (Last 90 Days)                             │
│  ┌─────────────────────────────────────────────┐           │
│  │     📈 ____                                 │  87%      │
│  │       /    \____/\                          │           │
│  │      /            \____                     │           │
│  │_____/                                       │           │
│  └─────────────────────────────────────────────┘           │
│  Jan 1        Jan 15        Feb 1        Feb 15            │
│                                                             │
│  Recent Commits                                             │
│  ┌─────────────────────────────────────────────┐           │
│  │ abc1234  feat: add useInfiniteQuery    +3%  │ ✓        │
│  │ def5678  fix: query options type       +0%  │ ✓        │
│  │ ghi9012  refactor: internal utils      -2%  │ ⚠️        │
│  └─────────────────────────────────────────────┘           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Tasks:**
- [ ] Build React dashboard with Recharts/Tremor
- [ ] GET /api/specs/:owner/:repo/history endpoint
- [ ] Coverage sparkline component
- [ ] Commit-by-commit coverage delta

### 6.3: Version Comparison View

Compare any two points in time.

```
┌─────────────────────────────────────────────────────────────┐
│  Compare: v5.0.0 ↔ v5.1.0                                   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Coverage: 85% → 87% (+2%)                                 │
│  Exports:  142 → 148 (+6)                                  │
│  Drift:    12 → 8 (-4)                                     │
│                                                             │
│  New Exports (6)                                            │
│  ┌─────────────────────────────────────────────┐           │
│  │ + useInfiniteQuery     100% documented      │           │
│  │ + usePrefetchQuery     100% documented      │           │
│  │ + QueryErrorBoundary   0% undocumented ⚠️    │           │
│  └─────────────────────────────────────────────┘           │
│                                                             │
│  Removed Exports (0)                                        │
│                                                             │
│  Changed Signatures (3)                                     │
│  ┌─────────────────────────────────────────────┐           │
│  │ useQuery - added 'select' param             │           │
│  │ QueryClient - new method 'prefetchInfinite' │           │
│  └─────────────────────────────────────────────┘           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Tasks:**
- [ ] Version/tag picker UI component
- [ ] Side-by-side diff view using existing `diffSpec()`
- [ ] Export-level diff details

## Technical Stack

- **Database**: Turso (SQLite edge) or PlanetScale (MySQL)
- **ORM**: Prisma
- **Frontend**: Next.js 14 App Router + Tailwind
- **Charts**: Recharts or Tremor
- **Auth**: GitHub OAuth (for private repos)

## Monetization Potential

| Tier | Features |
|------|----------|
| Free | Public repos, 30-day history |
| Pro ($9/mo) | Private repos, 1-year history, alerts |
| Team ($29/mo) | Org-wide dashboard, export reports |

## Acceptance Criteria

- [ ] Specs stored in database with commit association
- [ ] Coverage trend graph with 90-day default view
- [ ] Per-commit coverage delta displayed
- [ ] Version comparison view with diff details
- [ ] GitHub OAuth for private repo access
- [ ] Responsive dashboard design
