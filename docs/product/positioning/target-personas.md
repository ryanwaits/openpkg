# Target Personas

> Last updated: 2024-12-08

Who DocCov is built for.

---

## Primary Persona: Library Author

<!-- TODO: Flesh out with user research -->

### Profile
- **Role**: Open source maintainer or internal SDK developer
- **Company size**: Startups to enterprises
- **Tech stack**: TypeScript, npm ecosystem

### Pain Points
- Documentation gets stale after API changes
- No way to measure documentation quality
- Examples break silently
- Manual review doesn't catch doc issues

### Goals
- Ship libraries users can trust
- Reduce "docs are wrong" bug reports
- Maintain docs efficiently as API evolves

### How DocCov Helps
- Coverage scores show what's missing
- Drift detection catches mismatches
- Example validation ensures code works
- Auto-fix reduces manual toil

---

## Secondary Persona: DevRel Engineer

<!-- TODO: Flesh out with user research -->

### Profile
- **Role**: Developer Relations, Developer Advocate
- **Responsibility**: Documentation, tutorials, developer experience

### Pain Points
- Don't know which tutorials break after releases
- Hard to prioritize doc improvements
- Can't prove docs are getting better

### Goals
- Keep all docs in sync with API
- Measurable doc quality improvements
- Efficient triage of doc updates needed

### How DocCov Helps
- Docs impact analysis shows affected files
- Coverage trends show improvement over time
- Line-level precision for updates needed

---

## Secondary Persona: Platform Engineer

<!-- TODO: Flesh out with user research -->

### Profile
- **Role**: Platform/Infrastructure engineer
- **Responsibility**: Internal SDKs, shared libraries

### Pain Points
- Other teams don't document their code
- Can't enforce doc standards
- Support burden from missing docs

### Goals
- Enforce minimum doc coverage
- Reduce support tickets
- Consistent doc quality across teams

### How DocCov Helps
- CI thresholds enforce minimums
- Lint rules standardize format
- PR gates prevent regression

---

## Anti-Personas (Not For)

### Application Developers
- Building apps, not libraries
- Don't publish APIs
- Internal docs only

### Non-TypeScript Projects
- Python, Go, Rust, etc.
- DocCov is TypeScript-specific

### Doc Site Builders
- Just need to generate a site
- TypeDoc is a better fit
- DocCov complements, doesn't replace

---

## TODO

- [ ] Conduct user interviews
- [ ] Add quotes from real users
- [ ] Define jobs-to-be-done for each persona
- [ ] Map persona to feature priorities
- [ ] Add company/project examples
