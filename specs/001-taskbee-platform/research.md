# Phase 0: Research & Clarifications

## 1. Testing Frameworks for Next.js App Router
- **Decision**: Jest for Unit/Integration Testing, Playwright for E2E Testing.
- **Rationale**: The Constitution mandates rigorous testing standards (TDD, automated suites). Playwright gives high-fidelity E2E simulation (mandatory to test user workflows like task claim and wallet transactions), whereas Jest perfectly handles unit components, utility functions, and Prisma mock interactions.
- **Alternatives considered**: Vitest (faster but Next.js compatibility in App Router often easier natively with Jest templates), Cypress (less efficient context isolation per test compared to Playwright).

## 2. Slot/Concurrency Strategy with Prisma & PostgreSQL
- **Decision**: Optimistic Concurrency Control (OCC) using explicitly atomic `increment`/`decrement` combined with a strict constraint/checkout validation. Alternatively, pessimistic locking (`FOR UPDATE`) for direct wallet transactions.
- **Rationale**: For Task Slots, atomic decrement guarantees safe concurrency without full row locking. However, Wallet tracking needs strictly pessimistic row-locks (e.g. `$executeRaw` transaction with `SELECT ... FOR UPDATE`) to eliminate double-spend risks effectively with exact escrow holding. PostgreSQL handles row locks smoothly under this load.
- **Alternatives considered**: Redis Locks (introduces complex external dependency, violates Constitution's "minimization of complex external dependencies"), standard `UPDATE` without locks (high risk of race condition in financial apps).

*All Technical Context unknowns have been resolved.*