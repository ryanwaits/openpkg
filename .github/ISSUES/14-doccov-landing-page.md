# Deploy doccov.com Landing Page

**Priority:** P2.7
**Phase:** 2
**Labels:** `enhancement`, `marketing`, `website`

## Summary

Deploy the doccov.com landing page with a badge generator and "scan any repo" one-click tool. This is the remaining item from Phase 2 (SaaS MVP).

## Features

### Badge Generator

Interactive tool to generate coverage badges for any repository.

```
┌─────────────────────────────────────────────────────────────┐
│  Generate Your Badge                                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Repository URL:                                            │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ https://github.com/tanstack/query                    │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  [Generate Badge]                                           │
│                                                             │
│  Preview:                                                   │
│  ┌────────────────────────┐                                │
│  │ docs coverage | 87%    │                                │
│  └────────────────────────┘                                │
│                                                             │
│  Markdown:                                                  │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ [![Docs Coverage](https://doccov.com/badge/tanst... │   │
│  └─────────────────────────────────────────────────────┘   │
│  [Copy]                                                     │
│                                                             │
│  HTML:                                                      │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ <a href="https://doccov.com/repo/tanstack/query">  │   │
│  └─────────────────────────────────────────────────────┘   │
│  [Copy]                                                     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Scan Any Repo Tool

One-click analysis of any public GitHub repository.

```
┌─────────────────────────────────────────────────────────────┐
│  Scan a Repository                                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ tanstack/query                                       │   │
│  └─────────────────────────────────────────────────────┘   │
│  [Scan Now]                                                 │
│                                                             │
│  ───────────────────────────────────────────────────────   │
│                                                             │
│  Scanning tanstack/query...                                 │
│  ✓ Cloning repository                                       │
│  ✓ Installing dependencies                                  │
│  ✓ Building project                                         │
│  ◐ Analyzing documentation...                               │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Results Page

```
┌─────────────────────────────────────────────────────────────┐
│  tanstack/query                              [Add Badge]     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Documentation Coverage                                      │
│  ┌────────────────────────────────────────────┐            │
│  │████████████████████████░░░░░░░░│ 87%       │            │
│  └────────────────────────────────────────────┘            │
│                                                             │
│  Signal Breakdown                                           │
│  ┌────────────────────────────────────────────┐            │
│  │ Descriptions  ██████████████████░░  92%    │            │
│  │ Parameters    ████████████████░░░░  85%    │            │
│  │ Returns       ████████████████████  100%   │            │
│  │ Examples      ██████░░░░░░░░░░░░░░  35%    │            │
│  └────────────────────────────────────────────┘            │
│                                                             │
│  Drift Issues (3)                                           │
│  • useQuery: @param 'options' type mismatch                │
│  • useMutation: Missing @returns description               │
│  • QueryClient: @deprecated tag out of sync                │
│                                                             │
│  [View Full Report] [Download openpkg.json]                │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Landing Page Sections

1. **Hero**: "The Codecov for Documentation" with badge preview
2. **How It Works**: 3-step visual (Install → Check → Badge)
3. **Features**: Coverage scoring, drift detection, CI integration
4. **Leaderboard**: Top documented packages in the ecosystem
5. **Scan Tool**: Try it on any public repo
6. **Pricing**: Free tier + Pro tiers
7. **Footer**: GitHub, docs, Discord

## Technical Implementation

### Stack

- **Framework**: Next.js 14 (App Router)
- **Styling**: Tailwind CSS
- **Hosting**: Vercel
- **API**: Existing packages/api endpoints

### Pages

```
app/
├── page.tsx              # Landing page
├── badge/[owner]/[repo]/ # Badge generation
├── scan/page.tsx         # Scan tool
├── repo/[owner]/[repo]/  # Results page
├── leaderboard/page.tsx  # Public leaderboard
└── docs/                 # Documentation (redirect to docs site)
```

### API Integration

```typescript
// Badge generator
const badgeUrl = `https://doccov.com/badge/${owner}/${repo}`;

// Scan endpoint (existing)
const response = await fetch('/api/scan-stream', {
  method: 'POST',
  body: JSON.stringify({ repoUrl }),
});

// Leaderboard (existing)
const leaderboard = await fetch('/api/leaderboard?limit=20');
```

## SEO & Marketing

- **Meta tags**: Open Graph images with coverage badges
- **Sitemap**: Auto-generated for scanned repos
- **Analytics**: Plausible or Fathom
- **Social**: Twitter cards with badge previews

## Acceptance Criteria

- [ ] Landing page deployed at doccov.com
- [ ] Badge generator with markdown/HTML copy buttons
- [ ] "Scan any repo" tool with real-time progress
- [ ] Results page with coverage breakdown
- [ ] Leaderboard page showing top packages
- [ ] Mobile-responsive design
- [ ] SEO meta tags and Open Graph images
- [ ] Analytics integration
