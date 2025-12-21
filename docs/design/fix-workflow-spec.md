# Fix Workflow Component Specification

## Overview

The Fix Workflow transforms DocCov from a reporter to a co-pilot. Users can review, accept, reject, or edit auto-generated fixes for drift issues - similar to Cursor's agent mode or GitHub Copilot's inline suggestions.

---

## Core Components

### 1. DriftReviewPanel

The main container for reviewing a single drift issue.

```
┌─────────────────────────────────────────────────────────────────────────┐
│ ┌─ Header ────────────────────────────────────────────────────────────┐ │
│ │ ⚠ param-mismatch                                           1 of 12 │ │
│ │ src/client.ts:42 · getUser()                                        │ │
│ └─────────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│ ┌─ Description ───────────────────────────────────────────────────────┐ │
│ │ @param userId documented but function signature has id              │ │
│ │ Suggestion: Rename @param to match actual parameter name            │ │
│ └─────────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│ ┌─ Diff View ─────────────────────────────────────────────────────────┐ │
│ │ ┌─ Before ─────────────────┐  ┌─ After ──────────────────┐         │ │
│ │ │ /**                      │  │ /**                      │         │ │
│ │ │  * Gets a user by ID     │  │  * Gets a user by ID     │         │ │
│ │ │- * @param userId ...     │  │+ * @param id The user... │         │ │
│ │ │  */                      │  │  */                      │         │ │
│ │ │ export function getUser( │  │ export function getUser( │         │ │
│ │ │   id: string             │  │   id: string             │         │ │
│ │ │ ): User                  │  │ ): User                  │         │ │
│ │ └──────────────────────────┘  └──────────────────────────┘         │ │
│ └─────────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│ ┌─ Actions ───────────────────────────────────────────────────────────┐ │
│ │                                                                     │ │
│ │  [← Prev]   [Skip]   [Reject]   [Edit]   [Accept ✓]   [Next →]     │ │
│ │     j                   r         e          a            k         │ │
│ │                                                                     │ │
│ └─────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
```

**Props**:
```typescript
interface DriftReviewPanelProps {
  issue: DriftIssue;
  suggestedFix: CodeFix;
  onAccept: () => void;
  onReject: () => void;
  onSkip: () => void;
  onEdit: (customFix: string) => void;
  position: { current: number; total: number };
}
```

**States**:
- `reviewing` - Default, showing diff
- `editing` - User is modifying the fix
- `accepted` - Fix staged
- `rejected` - Marked as intentional

---

### 2. DiffViewer

Side-by-side or unified diff display with syntax highlighting.

```typescript
interface DiffViewerProps {
  before: string;
  after: string;
  language: string;
  mode: 'split' | 'unified';
  highlights?: {
    before: Range[];
    after: Range[];
  };
}
```

**Features**:
- Syntax highlighting via CodeHike
- Line-level diff highlighting (red for removed, green for added)
- Word-level diff for changed lines
- Expandable context (show more lines)
- Copy button for after state

---

### 3. FixQueueSidebar

Navigation for multiple drift issues.

```
┌─────────────────────────────┐
│ FIX QUEUE                   │
│ ─────────────────────────── │
│ 8 remaining · 4 accepted    │
│                             │
│ ▼ High Priority (2)         │
│   ○ param-mismatch          │
│   ○ return-type-mismatch    │
│                             │
│ ▼ Medium Priority (6)       │
│   ● param-mismatch ← active │
│   ○ param-mismatch          │
│   ✓ optionality-mismatch    │
│   ✓ deprecated-mismatch     │
│   ✗ example-drift           │
│   ○ broken-link             │
│                             │
│ ▼ Low Priority (4)          │
│   ○ visibility-mismatch     │
│   ...                       │
│                             │
│ ─────────────────────────── │
│ [Accept All Auto-Fixable]   │
│ [Create PR with Accepted]   │
└─────────────────────────────┘
```

**Icons**:
- `○` Pending review
- `●` Currently reviewing
- `✓` Accepted
- `✗` Rejected
- `~` Skipped

---

### 4. BatchActionsBar

Floating bar for bulk operations.

```
┌─────────────────────────────────────────────────────────────────────────┐
│  4 fixes accepted                                                       │
│                                                                         │
│  [Clear Selection]  [Apply to Files]  [Create PR ↗]  [Copy as Patch]   │
└─────────────────────────────────────────────────────────────────────────┘
```

---

### 5. EditFixModal

Modal for customizing a fix before accepting.

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Edit Fix                                                          [×]  │
│ ─────────────────────────────────────────────────────────────────────── │
│                                                                         │
│ ┌─ Editor ────────────────────────────────────────────────────────────┐ │
│ │ /**                                                                 │ │
│ │  * Gets a user by their unique identifier                          │ │
│ │  * @param id The unique user identifier                            │ │
│ │  * @returns The user object if found                               │ │
│ │  */                                                                 │ │
│ │ export function getUser(id: string): User                          │ │
│ └─────────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│ ┌─ Preview ───────────────────────────────────────────────────────────┐ │
│ │ Drift resolved: param-mismatch ✓                                   │ │
│ │ Coverage: 75% → 100% (+25%)                                        │ │
│ └─────────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│                                        [Cancel]  [Accept Custom Fix]   │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `j` | Next issue |
| `k` | Previous issue |
| `a` | Accept fix |
| `r` | Reject fix |
| `s` | Skip issue |
| `e` | Edit fix |
| `Enter` | Accept and next |
| `Escape` | Close modal/cancel |
| `Cmd+Enter` | Create PR with accepted |

---

## State Management

```typescript
interface FixWorkflowState {
  issues: DriftIssue[];
  currentIndex: number;
  decisions: Map<string, 'accepted' | 'rejected' | 'skipped'>;
  customFixes: Map<string, string>;
  isCreatingPR: boolean;
}

type FixWorkflowAction =
  | { type: 'ACCEPT'; issueId: string }
  | { type: 'REJECT'; issueId: string }
  | { type: 'SKIP'; issueId: string }
  | { type: 'EDIT'; issueId: string; fix: string }
  | { type: 'NEXT' }
  | { type: 'PREV' }
  | { type: 'ACCEPT_ALL_AUTO_FIXABLE' }
  | { type: 'CREATE_PR' };
```

---

## Animation & Transitions

1. **Issue transition**: Slide left/right when navigating
2. **Accept feedback**: Green flash + checkmark animation
3. **Reject feedback**: Red flash + X animation
4. **Queue update**: Smooth reorder with accepted items moving to "done" section
5. **PR creation**: Loading spinner → success confetti

---

## API Integration

```typescript
// GET /api/drift - Fetch all drift issues with suggested fixes
interface DriftResponse {
  issues: DriftIssue[];
  fixes: Record<string, SuggestedFix>;
}

// POST /api/fix - Apply fixes
interface ApplyFixRequest {
  fixes: Array<{
    issueId: string;
    fix: string; // The code to apply
  }>;
  createPR?: boolean;
  prTitle?: string;
  prDescription?: string;
}

// Response includes PR URL if created
interface ApplyFixResponse {
  applied: number;
  failed: Array<{ issueId: string; error: string }>;
  pr?: { url: string; number: number };
}
```

---

## Edge Cases

1. **No auto-fix available**: Show manual guidance instead of diff
2. **Conflicting fixes**: Warn if accepting one invalidates another
3. **File already modified**: Detect dirty state, offer to reload
4. **Fix introduces new drift**: Validate fix before applying
5. **Large diffs**: Collapse with "Show full diff" option

---

## Success Metrics

- **Fix acceptance rate**: % of suggested fixes accepted
- **Time to resolution**: Average time from drift detection to fix
- **PR creation rate**: % of fix sessions that result in PRs
- **Edit rate**: How often users modify suggestions (inform AI improvements)
