# DocCov v1 Launch Rollout Plan

> Phased implementation specs for MLP launch.

---

## Tier Structure

**Pricing Model:** Per-seat, no minimum

| Feature | Free | Team $15/user/mo | Pro $30/user/mo |
|---------|------|------------------|-----------------|
| Rate limit | 100/day | 1k/day | 10k/day |
| Public repos | ✅ | ✅ | ✅ |
| Private repos | ❌ | ✅ | ✅ |
| Trends | ❌ | 30 days | 90 days |
| **AI calls** | ❌ | **200/user/mo** | **500/user/mo** |
| AI overflow | ❌ | BYOK | BYOK |
| Quality rules | Basic | All | All + custom |
| Per-path policies | ❌ | ❌ | ✅ |
| CODEOWNERS | ❌ | ❌ | ✅ |
| Integrations | ❌ | ❌ | Slack/webhooks |

### Example Pricing by Team Size

| Team Size | Team Plan | Pro Plan |
|-----------|-----------|----------|
| 1 user | $15/mo | $30/mo |
| 5 users | $75/mo | $150/mo |
| 10 users | $150/mo | $300/mo |
| 25 users | $375/mo | $750/mo |

### AI Pricing Model (Hybrid)

AI calls scale per-seat. When limit reached, users can BYOK for unlimited:

```
1. User runs: doccov check --fix --generate
2. Under limit → Uses DocCov's hosted AI ✨
3. Over limit → "You've used 200 included calls. Set OPENAI_API_KEY to continue"
4. With BYOK → Unlimited generation, user pays OpenAI/Anthropic directly
```

**Margin analysis (~$0.02/call avg):**
| Plan | Price/user | AI Calls/user | AI Cost | Margin |
|------|------------|---------------|---------|--------|
| Team | $15 | 200/mo | ~$4 | **~73%** |
| Pro | $30 | 500/mo | ~$10 | **~67%** |

*Margins stay consistent regardless of team size.*

### Free Tier Funnel

**Anonymous (no API key):** 10 requests/day
```
Rate limit reached. Sign up free for 100/day → doccov.com/signup
```

**Free (with API key):** 100 requests/day — upsell to Team for private repos + AI

---

## Phase Overview

| Phase | Focus | Duration |
|-------|-------|----------|
| **Phase 1** | Free Tier Polish | ~1 week |
| **Phase 2** | Team Tier ($15/user/mo) | ~2-3 weeks |
| **Phase 3** | Pro Tier ($30/user/mo) | ~3-4 weeks |

---

## Phase 1: Free Tier Polish

### 1.1 Pricing Page

**Status:** ❌ Not started

Create `/pricing` with tier cards matching structure above.

**Files:**
- `apps/site/src/app/(marketing)/pricing/page.tsx` (new)
- `apps/site/src/components/pricing-card.tsx` (new)

**Acceptance:**
- [ ] 4 tier cards (Free, Team, Pro, contact for Enterprise mention)
- [ ] Feature comparison table
- [ ] CTAs link to signup/checkout flows

---

### 1.2 Marketing Landing Polish

**Status:** 🟡 Basic hero exists

Enhance landing page with:
- Feature sections (coverage, drift detection, PR checks)
- Social proof (badge examples, testimonials if any)
- Clear CTAs

**Files:**
- `apps/site/src/app/(marketing)/page.tsx`

---

### 1.3 Dashboard Billing UI

**Status:** 🟡 Billing API exists, no UI

Add to dashboard:
- Current plan display
- Usage stats (analyses this period)
- Upgrade CTA for free users
- Manage billing link for paid users

**Files:**
- `apps/site/src/app/(platform)/settings/billing/page.tsx` (new)
- `apps/site/src/components/plan-card.tsx` (new)

---

### 1.4 Anonymous Rate Limiting

**Status:** ❌ Not started

Implement IP-based rate limiting for unauthenticated CLI usage.

**Implementation:**
- Track by IP in API middleware
- 10 requests/day for anonymous
- Return upgrade CTA in rate limit response

**Files:**
- `packages/api/src/middleware/anonymous-rate-limit.ts` (new)

---

### 1.5 Existing Items (✅ Done)

- PR Comment UX (`--format pr-comment`)
- YAML Config Support (`doccov.yaml`)
- Badge Endpoint (`/badge/:owner/:repo`)
- GitHub Action (all features)
- Quickstart docs

---

## Phase 2: Team Tier ($15/user/mo)

### 2.1 CLI `--generate` Flag

**Status:** ❌ Not started

Add AI-powered JSDoc generation to `doccov check`.

**Usage:**
```bash
doccov check --fix --generate
```

**Implementation:**
- Extend existing `--fix` flow
- Call AI to generate missing JSDoc
- Apply patches to source files
- Track AI calls for metering

**Files:**
- `packages/cli/src/commands/check.ts` (add --generate option)
- `packages/cli/src/utils/ai-generate.ts` (new)

**Prompt template:**
```
Generate JSDoc for this TypeScript export:

Name: ${export.name}
Kind: ${export.kind}
Signature: ${export.signature}

Generate:
- @description (1-2 sentences)
- @param for each parameter
- @returns
- @example (working code snippet)

Output as JSON matching JSDocPatch schema.
```

---

### 2.2 Hosted AI Inference (Hybrid Model)

**Status:** ❌ Not started

API endpoint for AI generation with included calls + BYOK overflow.

**Endpoint:** `POST /ai/generate`

**Implementation:**
- Authenticate with API key
- Check plan allows AI (Team+)
- Track usage per org, check against monthly limit
- Under limit: use DocCov's OpenAI/Anthropic keys
- Over limit: return error prompting BYOK setup
- If user has BYOK key configured: use their key, no limit

**Files:**
- `packages/api/src/routes/ai.ts` (new)
- `packages/cli/src/utils/ai-client.ts` (BYOK fallback logic)

**AI calls (per-seat):**
| Plan | Per User/Month | 5-user org | Overflow |
|------|----------------|------------|----------|
| Free | 0 | 0 | ❌ |
| Team | 200 | 1,000 | BYOK |
| Pro | 500 | 2,500 | BYOK |

**CLI overflow UX:**
```
✗ Monthly AI limit reached (200/200 calls used)

To continue generating docs:
  1. Set your own API key: doccov config set OPENAI_API_KEY=sk-...
  2. Or upgrade to Pro for 500 calls/user/mo: doccov.com/upgrade
```

---

### 2.3 GitHub App for Private Repos

**Status:** ❌ Not started

Create GitHub App for private repository access.

**Implementation:**
- Create GitHub App (repo read permissions)
- Installation flow in dashboard
- Store installation tokens per org
- Badge endpoint works with auth for private repos

**Files:**
- `apps/site/src/app/api/github/install/route.ts` (new)
- `apps/site/src/app/api/github/callback/route.ts` (new)
- `packages/api/src/routes/github-app.ts` (new)

---

### 2.4 Coverage Trends (30 days)

**Status:** ✅ Backend done, 🟡 UI partial

- CoverageSnapshots table exists
- CLI `trends` command exists
- Dashboard visualization exists

**Remaining:**
- [ ] Gate behind Team+ plan
- [ ] 30-day retention enforcement for Team
- [ ] "Upgrade for trends" CTA for free users

---

### 2.5 Usage Limits UI

**Status:** 🟡 Data exists, no UI

Show in dashboard:
```
Team Plan: 5 seats × $15 = $75/mo

AI Calls: 823 / 1,000 this month (200/user × 5 users)
Analyses: 456 / 1,000 today

💡 Running low on AI calls? Set up BYOK for unlimited →
[Manage Billing] [Add Seats]
```

**Files:**
- `apps/site/src/app/(platform)/settings/usage/page.tsx` (new)
- `apps/site/src/app/(platform)/settings/seats/page.tsx` (new)

---

## Phase 3: Pro Tier ($30/user/mo)

### 3.1 Extended Trends (90 days)

**Status:** ❌ Not started

- 90-day retention for Pro (vs 30 for Team)
- Scheduled weekly digest emails

---

### 3.2 Per-Path Coverage Thresholds

**Status:** ❌ Not started

Policy packs for monorepo governance.

**Config:**
```yaml
policies:
  - path: "packages/public-api/**"
    min_coverage: 95
    require_examples: true
  - path: "packages/internal/**"
    min_coverage: 50
```

**Files:**
- `packages/sdk/src/config/policies.ts` (new)
- `packages/cli/src/commands/check.ts` (add policy evaluation)

---

### 3.3 CODEOWNERS Integration

**Status:** ❌ Not started

- Parse CODEOWNERS file
- Attribute undocumented exports to owners
- Coverage breakdown by owner

---

### 3.4 Per-Contributor Stats

**Status:** ❌ Not started

- Track who documented what (git blame)
- Dashboard shows contributor breakdown
- Useful for team accountability

---

### 3.5 Integrations

**Status:** ❌ Not started

**Slack/Discord:**
- Webhook on coverage change
- Weekly digest to channel

**Export:**
- PDF reports
- CSV export

**Files:**
- `packages/api/src/routes/webhooks.ts` (new)
- `packages/cli/src/reports/pdf.ts` (new)

---

## Current Implementation Status

### ✅ Complete
- Auth system (GitHub OAuth, sessions, orgs)
- Billing (Polar checkout, portal, webhooks)
- API keys + rate limiting (key-based)
- PR comment format
- YAML config
- Badge endpoint
- GitHub Action
- Coverage trends backend
- Dashboard (basic)
- Quality rules engine

### 🟡 Partial
- Marketing site (basic hero only)
- Dashboard billing UI (API exists, no UI)
- Usage tracking (stored, not displayed)

### ❌ Not Started
- Pricing page
- Anonymous rate limiting
- `--generate` AI flag
- Hosted AI inference
- GitHub App (private repos)
- Plan gating for trends
- Usage limits UI
- Per-path policies
- CODEOWNERS
- Contributor stats
- Slack/webhooks
- Export formats

---

## Success Metrics

| Phase | Target |
|-------|--------|
| Phase 1 | 1,000 badges, 50 public repos, 500 free accounts |
| Phase 2 | 50 Team orgs, ~200 seats (~$3k MRR) |
| Phase 3 | 25 Pro orgs, ~150 seats (~$4.5k MRR) |

**MRR calculation:**
- Team: 200 seats × $15 = $3,000/mo
- Pro: 150 seats × $30 = $4,500/mo
- **Combined target:** ~$7.5k MRR

*Per-seat scales better over time as orgs grow.*
