# Repository Guidelines

## Project Structure & Module Organization
OpenPkg is a Bun-powered TypeScript monorepo managed via workspaces. Runtime source lives in `packages/sdk/src` and `packages/cli/src`; both build to `dist/` using Bunup and should never be edited directly. JSON schemas that describe the OpenPkg spec are kept under `schemas/`, while reference materials and design notes live in `docs/` and `POC.md`. Sample projects that double as manual verification targets reside in `examples/`. Temporary fixtures for extractor testing are under `test/temp/`; feel free to add focused samples there when exploring new language features.

## Build, Test, and Development Commands
Use Bun for every scripted task. `bun run build` compiles the SDK first, then the CLI, and is required before publishing or packaging. `bun run dev` starts both workspaces in watch mode; you can scope to one package with `bun run dev:sdk` or `bun run dev:cli`. Linting and formatting flow through Biome: run `bun run lint` for analysis and `bun run lint:fix` or `bun run format` to apply fixes. When you need to execute unit specs, run `bun test` from the repository root or target a single file, e.g. `bun test test/temp/test.ts`.

## Coding Style & Naming Conventions
The Biome configuration enforces two-space indentation, LF endings, single quotes, trailing commas, and required semicolons. Stick to TypeScript `export`/`import` syntax and prefer explicit return types on public APIs. Filenames follow kebab-case for CLI files and camelCase for utilities; TypeScript types and classes retain PascalCase. Run Biome locally before committing to avoid CI churn.

## Testing Guidelines
Tests now cover both SDK and CLI flows. Runtime fixtures live under `packages/sdk/test/` (extractor, remote analysis, caching) and `packages/cli/test/` (command wiring). Name files with the feature under test, using `.test.ts` so Bun picks them up automatically. Keep assertions close to generated specs/import metadata and capture representative edge cases (generics, unions, circular references, remote fetch retries). Record manual CLI runs in PR discussions when automated coverage is impractical.

## Commit & Pull Request Guidelines
Commits in this repo favor concise, present-tense summaries (e.g. `add biome`, `update extractor diagnostics`). Group related changes and avoid multi-topic commits. Every PR should describe intent, list key commands run (`bun run build`, `bun test`, etc.), and link to any tracking issues. Include screenshots or spec snippets when the CLI output changes, and tick the checklist once lint and tests pass locally.
