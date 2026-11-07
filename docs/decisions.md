# Decisions & Trade-offs

Short log of architectural decisions. Newest at the bottom. Feeds the README section “Decisions & Trade-offs”.

## 001 – The AI suggests, the code calculates

The LLM only extracts line items and proposes a category. CO₂e is computed deterministically
(`quantity × co2e_per_unit`) in pure, unit-tested functions, and every result is traceable to a
factor and its source. AI output is always validated with Zod before it is persisted.

## 002 – oxlint instead of ESLint

The Vite template ships TypeScript 7 (native compiler). `typescript-eslint` currently supports
TypeScript `<6.1`, so ESLint would have forced a TypeScript downgrade. oxlint covers the rules we need
(`react`, `react-hooks`, `jsx-a11y`, `typescript`, `import`, `vitest`) natively, is much faster and
works with TS 7. Prettier stays responsible for formatting.

**Trade-off:** no type-aware lint rules (e.g. `no-floating-promises`) for now. Revisit once
typescript-eslint or oxlint's type-aware mode supports TS 7.

## 003 – Strict TypeScript beyond `strict`

`noUncheckedIndexedAccess` and `noImplicitOverride` are on. `exactOptionalPropertyTypes` is off:
it causes friction with Radix/shadcn and React Hook Form typings for little gain in this project.
