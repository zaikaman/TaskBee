# Implementation Plan: TaskBee MVP

**Branch**: `001-taskbee-platform` | **Date**: May 14, 2026 | **Spec**: [specs/001-taskbee-platform/spec.md](specs/001-taskbee-platform/spec.md)
**Input**: Feature specification from `specs/001-taskbee-platform/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Build a monolithic fullstack TypeScript microtask marketplace for Vietnam using Next.js App Router, Prisma ORM, and Supabase (PostgreSQL, Auth, Storage). The MVP focuses on employer task creation, worker submission, essential wallet escrow, and admin moderation, prioritizing speed to market while ensuring a clean, scalable architecture.

## Technical Context

**Language/Version**: TypeScript (strict mode), Node.js current LTS or newer
**Primary Dependencies**: Latest stable Next.js App Router, TailwindCSS, shadcn/ui, Prisma ORM, Supabase Auth/Storage, Gmail SMTP, PostHog
**Storage**: PostgreSQL (via Supabase Relational Database)
**Testing**: Jest, Playwright (Resolved via Phase 0 Research to satisfy Constitution II)
**Target Platform**: Web browsers (deployed on Vercel)
**Project Type**: Monolithic fullstack web application
**Performance Goals**: Support 1,000 concurrent browsing users, 95% of core API requests p95 < 300ms
**Constraints**: Transaction-sensitive logic must run server-side; manual bank transfers for MVP; optimistic/pessimistic locking to ensure exact slot limits.
**Scale/Scope**: MVP release catering to hundreds to thousands of users processing tasks, proofs, and basic wallet escrow.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **I. Code Quality First**: TypeScript strict mode enforced, standardizing Server Actions.
- [x] **II. Rigorous Testing Standards**: TDD approach embedded, requiring automated test strategies for core business logic despite initial emphasis on 'manual testing' in user spec.
- [x] **III. User Experience Consistency**: Leveraging TailwindCSS + shadcn/ui to construct a homogeneous design system across layouts.
- [x] **IV. Performance and Optimization Requirements**: Edge and Server-Side rendering utilized for <300ms p95 targets constraint, with optimistic caching loops.

## Project Structure

### Documentation (this feature)

```text
specs/001-taskbee-platform/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
/app
  /(auth)
  /(dashboard)
  /(marketplace)
  /(admin)
  /api

/components
  /ui
  /dashboard
  /tasks
  /wallet
  /admin

/lib
  /auth
  /db
  /services
  /validators
  /utils

/prisma
  schema.prisma

/hooks

/types

/config
```

**Structure Decision**: Selected Monolithic fullstack single project. Standard Next.js App Router directory routing with split groupings by domain (auth, dashboard, marketplace, admin) enables seamless code-splitting and scaling without microservice complexity.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| *None* | | |
