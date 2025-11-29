# `doccov fix --interactive`: Review Changes Before Applying

**Priority:** P2.5
**Phase:** 10A
**Labels:** `enhancement`, `cli`, `ux`

## Summary

Add an interactive mode to `doccov fix` that prompts the user to review and approve each fix before applying it.

## Proposed CLI

```bash
doccov fix --interactive
# or shorthand
doccov fix -i
```

## Behavior

For each fix:
1. Show the before/after diff
2. Prompt: `Apply this fix? (y/n/s/q)`
   - `y` = yes, apply
   - `n` = no, skip this one
   - `s` = skip remaining in this file
   - `q` = quit, don't apply any more

## Example Output

```
Fix 1/5: add (src/index.ts:1-6)

- @param b - This param was renamed
+ (removed)

Apply this fix? [y/n/s/q]: y
✓ Applied

Fix 2/5: add (src/index.ts:1-6)

- @returns {string}
+ @returns {number}

Apply this fix? [y/n/s/q]: n
⊘ Skipped

...

Applied 3 of 5 fixes
```

## Implementation Notes

- Use `inquirer` or `prompts` for interactive prompts
- Support `--yes` flag to auto-accept all (current default behavior)
- Respect `--dry-run` (show what would be prompted but don't prompt)

## Acceptance Criteria

- [ ] `--interactive` / `-i` flag implemented
- [ ] Shows colorized diff for each change
- [ ] Supports y/n/s/q responses
- [ ] Summary at end shows applied vs skipped count
- [ ] Works correctly with `--only` filter
