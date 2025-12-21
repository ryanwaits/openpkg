# DocCov UX Audit & Design Proposal

## Executive Summary

DocCov has strong technical foundations (14 drift types, example validation, CI integration) but the UI undersells these capabilities. The current experience is **informational** rather than **actionable**.

**Core insight**: DocCov should feel like a co-pilot that actively helps you fix documentation, not just a reporter that tells you what's wrong.

---

## Current State Audit

### What Works
- Clean two-column layout with good information hierarchy
- Warm stone palette feels approachable (not cold/corporate)
- Collapsible file rows enable progressive disclosure
- Coverage percentages provide clear metrics
- IBM Plex typography is readable and professional

### Critical Gaps

| Gap | Impact | Current | Ideal |
|-----|--------|---------|-------|
| **No action pathway** | High | "You have 12 drift issues" ends there | One-click fix with preview |
| **No PR context** | High | Shows all issues equally | "This PR introduces 3 new issues" |
| **No trending data** | Medium | Snapshot only | Coverage over time, regression alerts |
| **No severity hierarchy** | Medium | All issues look equal | High/Medium/Low with visual weight |
| **No external docs view** | Medium | CLI only | Visual mapping of affected markdown |
| **No example results** | Low | Pass/fail counts | Interactive expected vs actual |

### User Journey Problems

```
Current Flow:
Dashboard → See coverage % → Click package → See undocumented list → ???

What users want:
Dashboard → See what needs attention → Click issue → Fix it → Create PR
```

---

## Highest Value Improvements

### 1. **Agent Mode Fix Workflow** (Cursor-inspired)
The killer feature DocCov is missing. Transform from "reporter" to "co-pilot".

**Concept**: When drift is detected, show the fix inline with accept/reject controls.

```
┌─────────────────────────────────────────────────────────────────┐
│ ⚠️ DRIFT DETECTED                                    [Fix All] │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  src/client.ts:42                                               │
│  ────────────────                                               │
│  param-mismatch: @param userId documented but signature has id  │
│                                                                 │
│  ┌─ Current ──────────────────┐  ┌─ Fixed ───────────────────┐ │
│  │ /**                        │  │ /**                       │ │
│  │  * @param userId The user  │  │  * @param id The user     │ │
│  │  */                        │  │  */                       │ │
│  │ function getUser(id) {}    │  │ function getUser(id) {}   │ │
│  └────────────────────────────┘  └───────────────────────────┘ │
│                                                                 │
│                        [Keep Original]  [Accept Fix]  [Edit]   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Workflow states**:
1. **Review** - Show diff, user decides
2. **Accepted** - Staged for commit
3. **Rejected** - Marked as intentional
4. **Edited** - User modified the fix

**Batch operations**:
- "Accept all param fixes"
- "Accept all in file"
- "Create PR with accepted changes"

### 2. **PR-Centric Coverage View**

Like Codecov's PR comment, but as a first-class dashboard view.

```
┌─────────────────────────────────────────────────────────────────┐
│  PR #142: Add user authentication                               │
│  ───────────────────────────────────────────────────────────────│
│                                                                 │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌───────────┐ │
│  │  PATCH     │  │  NEW       │  │  DRIFT     │  │  IMPACT   │ │
│  │  COVERAGE  │  │  EXPORTS   │  │  DELTA     │  │  FILES    │ │
│  │            │  │            │  │            │  │           │ │
│  │   86%      │  │    +4      │  │   +2 / -1  │  │    3      │ │
│  │   ████░    │  │  undoc: 2  │  │  net: +1   │  │  md files │ │
│  └────────────┘  └────────────┘  └────────────┘  └───────────┘ │
│                                                                 │
│  CHANGES IN THIS PR                                             │
│  ─────────────────                                              │
│  ✓ createUser()      100%  ████████████  +new, documented       │
│  ✓ validateToken()   100%  ████████████  +new, documented       │
│  ⚠ AuthOptions       50%   █████░░░░░░  +new, missing @example  │
│  ✗ hashPassword()    0%    ░░░░░░░░░░░  +new, no docs           │
│                                                                 │
│  DRIFT INTRODUCED                                               │
│  ────────────────                                               │
│  ⚠ param-mismatch    auth.ts:24    [View] [Fix]                 │
│  ⚠ return-mismatch   auth.ts:67    [View] [Fix]                 │
│                                                                 │
│  EXTERNAL DOCS AFFECTED                                         │
│  ──────────────────────                                         │
│  📄 docs/authentication.md                                      │
│     L42: createUser() signature changed                         │
│     L78: validateToken example outdated                         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 3. **Drift Detection Command Center**

A dedicated view for understanding and resolving all drift issues.

```
┌─────────────────────────────────────────────────────────────────┐
│  DRIFT OVERVIEW                              [Fix All Auto-Fix] │
│  ═══════════════════════════════════════════════════════════════│
│                                                                 │
│  BY SEVERITY                    BY TYPE                         │
│  ───────────                    ───────                         │
│  ● High (3)                     param-mismatch ████████░░ 8     │
│  ● Medium (8)                   return-type    ████░░░░░░ 4     │
│  ● Low (4)                      example-drift  ██░░░░░░░░ 2     │
│                                 broken-link    █░░░░░░░░░ 1     │
│                                                                 │
│  ───────────────────────────────────────────────────────────────│
│                                                                 │
│  ▼ HIGH PRIORITY (3)                                            │
│    ┌──────────────────────────────────────────────────────────┐ │
│    │ 🔴 example-runtime-error                                 │ │
│    │    createClient() throws TypeError                       │ │
│    │    src/client.ts:12                          [View Code] │ │
│    └──────────────────────────────────────────────────────────┘ │
│    ┌──────────────────────────────────────────────────────────┐ │
│    │ 🔴 return-type-mismatch                                  │ │
│    │    @returns {User} but returns Promise<User>             │ │
│    │    src/api.ts:45                   [View Code] [Fix]     │ │
│    └──────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ▶ MEDIUM PRIORITY (8)                                          │
│  ▶ LOW PRIORITY (4)                                             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 4. **Coverage Trends & Insights**

Historical data to show progress and catch regressions.

```
┌─────────────────────────────────────────────────────────────────┐
│  COVERAGE TRENDS                                                │
│  ═══════════════════════════════════════════════════════════════│
│                                                                 │
│  100% ┤                                                         │
│       │                                    ●────●               │
│   80% ┤              ●────●────●────●────●                      │
│       │         ●────                                           │
│   60% ┤    ●────                                                │
│       │                                                         │
│   40% ┤                                                         │
│       └────┬────┬────┬────┬────┬────┬────┬────┬────             │
│           v1.0 v1.1 v1.2 v1.3 v1.4 v1.5 v1.6 v1.7              │
│                                                                 │
│  ───────────────────────────────────────────────────────────────│
│                                                                 │
│  INSIGHTS                                                       │
│  ────────                                                       │
│  📈 Coverage increased 12% since v1.4                           │
│  ⚠️ 3 exports lost documentation in v1.6 (reverted in v1.7)     │
│  🎯 At current pace, 100% coverage in ~4 releases               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 5. **Interactive Example Validation**

Show example execution results with expected vs actual.

```
┌─────────────────────────────────────────────────────────────────┐
│  EXAMPLE VALIDATION: add()                                      │
│  ═══════════════════════════════════════════════════════════════│
│                                                                 │
│  @example                                                       │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ console.log(add(1, 2)); // => 3                      ✓     │ │
│  │ console.log(add(-1, 1)); // => 0                     ✓     │ │
│  │ console.log(add(0.1, 0.2)); // => 0.3                ✗     │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌─ Line 3 Failed ────────────────────────────────────────────┐ │
│  │  Expected: 0.3                                             │ │
│  │  Actual:   0.30000000000000004                             │ │
│  │                                                            │ │
│  │  [Update Assertion]  [Ignore]  [View Context]              │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Design Direction

### Aesthetic: "Precision Instrument"

DocCov should feel like a high-quality developer tool - think Linear, Raycast, or Vercel's dashboard. Not playful, not corporate, but **precise** and **confident**.

**Key traits**:
- Information-dense without feeling cluttered
- Monospace for code, clean sans for UI
- Muted backgrounds, vibrant accents for actions
- Strong visual hierarchy through weight and space
- Animations that feel snappy, not decorative

### Color Philosophy

Keep the warm stone base but add:
- **Success green** for fixed/passing
- **Amber warnings** for drift/issues
- **Red errors** for breaking/critical
- **Blue accents** for actions/links

```css
/* Semantic action colors */
--action-fix: #10b981;      /* emerald-500 */
--action-reject: #f59e0b;   /* amber-500 */
--status-error: #ef4444;    /* red-500 */
--status-success: #22c55e;  /* green-500 */
```

### Component Patterns

1. **Cards with actions** - Every card that shows a problem should have a fix action
2. **Inline diffs** - Show before/after side by side
3. **Progress indicators** - Visual completion states
4. **Keyboard shortcuts** - Power user efficiency (j/k navigation, a to accept, r to reject)

---

## Implementation Priority

### Phase 1: Agent Mode Fix Workflow
*Highest impact, differentiating feature*

1. Drift review panel with before/after
2. Accept/reject/edit controls
3. Batch operations
4. "Create PR" flow

### Phase 2: PR-Centric View
*Natural CI/CD integration point*

1. PR summary dashboard
2. Patch coverage calculation
3. Drift delta tracking
4. External docs impact

### Phase 3: Insights & Trends
*Retention and engagement*

1. Coverage history graph
2. Per-release tracking
3. Regression alerts
4. Team leaderboards (optional)

### Phase 4: Polish & Power Features
*Delight and efficiency*

1. Keyboard shortcuts
2. Command palette actions
3. Custom dashboards
4. Slack/Discord notifications

---

## Next Steps

1. **Prototype the fix workflow** - Most differentiating feature
2. **Design PR summary view** - Key integration point
3. **Build drift command center** - Operational hub
4. **Add trending data** - Engagement driver
