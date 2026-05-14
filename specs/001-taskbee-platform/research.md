# Phase 0: Research & Clarifications

## 1. Testing Frameworks for Next.js App Router
- **Decision**: Jest for Unit/Integration Testing, Playwright for E2E Testing.
- **Rationale**: The Constitution mandates rigorous testing standards (TDD, automated suites). Playwright gives high-fidelity E2E simulation (mandatory to test user workflows like task claim and wallet transactions), whereas Jest perfectly handles unit components, utility functions, and Prisma mock interactions.
- **Alternatives considered**: Vitest (faster but Next.js compatibility in App Router often easier natively with Jest templates), Cypress (less efficient context isolation per test compared to Playwright).

## 2. Slot/Concurrency Strategy with Prisma & PostgreSQL
- **Decision**: Optimistic Concurrency Control (OCC) using explicitly atomic `increment`/`decrement` combined with a strict constraint/checkout validation. Alternatively, pessimistic locking (`FOR UPDATE`) for direct wallet transactions.
- **Rationale**: For Task Slots, atomic decrement guarantees safe concurrency without full row locking. However, Wallet tracking needs strictly pessimistic row-locks (e.g. `$executeRaw` transaction with `SELECT ... FOR UPDATE`) to eliminate double-spend risks effectively with exact escrow holding. PostgreSQL handles row locks smoothly under this load.
- **Alternatives considered**: Redis Locks (introduces complex external dependency, violates Constitution's "minimization of complex external dependencies"), standard `UPDATE` without locks (high risk of race condition in financial apps).

## 3. Latest Stable Library Baseline
- **Decision**: Phase 1 setup MUST use npm `latest` dist-tags for application libraries instead of pinning an older framework line such as Next.js 14.
- **Research date**: May 14, 2026.
- **Observed npm latest versions**:
  - `next`: 16.2.6
  - `react`: 19.2.6
  - `react-dom`: 19.2.6
  - `tailwindcss`: 4.3.0
  - `@tailwindcss/postcss`: 4.3.0
  - `shadcn`: 4.7.0
  - `prisma`: 7.8.0
  - `@prisma/client`: 7.8.0
  - `@supabase/supabase-js`: 2.105.4
  - `@supabase/ssr`: 0.10.3
  - `lucide-react`: 1.14.0
  - `zod`: 4.4.3
  - `class-variance-authority`: 0.7.1
  - `tailwind-merge`: 3.6.0
- **Rationale**: The MVP has not yet been scaffolded, so there is no migration cost to starting from current stable packages. Using latest stable avoids beginning the implementation on an already stale major version, while the generated `package-lock.json` still provides reproducible installs after scaffold.
- **Implementation note**: Use `npx create-next-app@latest` and package installs with `@latest`, then verify generated config because latest Next.js uses the current App Router stack and Tailwind v4 conventions.

*All Technical Context unknowns have been resolved.*
