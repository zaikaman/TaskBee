# Implementation Tasks: TaskBee MVP

**Feature**: TaskBee MVP ([001-taskbee-platform])

## Task Graph

```text
Phase 1 (Setup)
 ├──> Phase 2 (Foundational)
       ├──> Phase 3 (US1: Auth & Profiles)
       │     ├──> Phase 4 (US2: Employer Task Lifecycle)
       │     │     ├──> Phase 5 (US3: Worker Task Completion)
       │     │     │     ├──> Phase 6 (US4: Wallet & Escrow Management)
       │     │     │     │     └──> Phase 7 (US5: System Moderation and Anti-Abuse)
       │     │     │     │           └──> Phase 8 (Polish & Cross-Cutting)
```

## Phase 1: Setup
*Goal: Initialize the project with the latest stable application libraries, styling, and essential infrastructure.*

- [x] T001 Initialize latest stable Next.js App Router project in `/` using `create-next-app@latest`
- [x] T002 Setup latest stable TailwindCSS and `shadcn/ui` base configuration in `components.json` and Tailwind/PostCSS config
- [x] T003 Initialize latest stable Prisma ORM in `prisma/schema.prisma`
- [x] T004 Setup database connection with Supabase PostgreSQL in `.env.local`
- [x] T005 [P] Setup latest stable Supabase Auth clients in `lib/auth/client.ts` and `lib/auth/server.ts`
- [x] T040 [P] Expand `.env.example` with all required Supabase, Prisma, email, analytics, and cron secret variables
- [x] T041 [P] Add project-level constants for fees, withdrawal minimums, timeout bounds, and supported Vietnamese bank metadata in `config/app.ts`

## Phase 2: Foundational
*Goal: Configure data models and foundational layouts. Blocks user stories.*

- [x] T006 Implement data models (User, Task, Submission, Transaction, Withdrawal) in `prisma/schema.prisma`
- [x] T007 Generate Prisma client and create base instance in `lib/db/prisma.ts`
- [x] T008 [P] Setup auth proxy for protected route verification in `proxy.ts`
- [x] T009 [P] Create base application layout and navbar in `app/layout.tsx`
- [x] T042 Extend data model for claimed task slots in `prisma/schema.prisma` to distinguish reserved slots from submitted proof
- [x] T043 Extend data model for manual employer deposits in `prisma/schema.prisma` to satisfy Manual Bank Transfer funding
- [x] T044 Extend data model for in-app notifications in `prisma/schema.prisma`
- [x] T045 Extend data model for admin audit logs in `prisma/schema.prisma`
- [x] T046 [P] Create auth/session helpers for current user lookup, email verification checks, and role guards in `lib/auth/session.ts`
- [x] T047 [P] Create route group layouts for public auth, protected dashboard, marketplace, and admin areas
- [x] T048 [P] Create shared money utilities for Decimal-safe fee, escrow, balance, and ledger calculations in `lib/utils/money.ts`
- [x] T049 Create database seed script for initial Admin user and demo marketplace data in `prisma/seed.ts`

## Phase 3: User Story 1 - User Authentication & Profiles
*Goal: System MUST support user registration, login, email verification, and profile management.*
*Test Criteria: Can create account, verify, login, and view profile.*

- [ ] T010 [US1] Create registration UI and Server Action in `app/(auth)/register/page.tsx`
- [ ] T011 [US1] Create login UI and Server Action in `app/(auth)/login/page.tsx`
- [ ] T012 [US1] Implement email verification callback flow in `app/(auth)/verify/page.tsx`
- [ ] T013 [P] [US1] Create profile UI dashboard in `app/(dashboard)/profile/page.tsx`
- [ ] T014 [US1] Implement profile update server action in `lib/services/user.ts`
- [ ] T050 [US1] Implement logout Server Action and navigation entry in `lib/services/auth.ts`
- [ ] T051 [US1] Create role selection/onboarding flow in `app/(auth)/onboarding/page.tsx`
- [ ] T052 [US1] Enforce email verification and role-specific access in Server Components and Server Actions
- [ ] T053 [P] [US1] Add avatar upload support with Supabase Storage in `lib/services/storage.ts`
- [ ] T054 [P] [US1] Create password reset request and update flows in `app/(auth)/forgot-password/page.tsx` and `app/(auth)/reset-password/page.tsx`

## Phase 4: User Story 2 - Employer Task Lifecycle
*Goal: System MUST allow Employers to create tasks with specific instructions, rewards, and available slots.*
*Test Criteria: Employer can fund and post a task, and later approve submissions.*

- [ ] T015 [P] [US2] Create Zod schemas for task generation in `lib/validators/task.ts`
- [ ] T016 [US2] Implement `createTask` Server Action (with Wallet Escrow lock logic) in `lib/services/task.ts`
- [ ] T017 [US2] Create the Task Creation Form UI in `components/tasks/create-task-form.tsx`
- [ ] T018 [US2] Create Task listing dashboard for Employers in `app/(dashboard)/employer/tasks/page.tsx`
- [ ] T019 [US2] Implement submission approval/rejection action (`reviewSubmission`) in `lib/services/submission.ts`
- [ ] T055 [US2] Add task proof requirement fields to validators, schema, create form, and detail view
- [ ] T056 [US2] Implement Employer 10% task creation fee calculation and ledger entries in `lib/services/task.ts`
- [ ] T057 [US2] Implement task pause, resume, close, and cancel actions with escrow refund handling in `lib/services/task.ts`
- [ ] T058 [US2] Create Employer task detail and submission review UI in `app/(dashboard)/employer/tasks/[id]/page.tsx`
- [ ] T059 [P] [US2] Create reusable task status badges, fee preview, and escrow summary components in `components/tasks/`

## Phase 5: User Story 3 - Worker Task Completion
*Goal: System MUST allow Workers to browse, claim slots, and submit proof for Active Tasks.*
*Test Criteria: Worker finds active task, claims slot (respecting concurrency locks), and uploads proof.*

- [ ] T020 [P] [US3] Implement optimistic lock slot claim logic (`claimTaskSlot`) in `lib/services/task.ts`
- [ ] T021 [US3] Create Task Marketplace browsing view for workers in `app/(marketplace)/page.tsx`
- [ ] T022 [US3] Create individual Task Details view in `app/(marketplace)/tasks/[id]/page.tsx`
- [ ] T023 [US3] Implement Server Action to process Worker proof submissions (`createSubmission`) in `lib/services/submission.ts`
- [ ] T024 [P] [US3] Create the proof submission upload UI (images/text) in `components/tasks/submission-form.tsx`
- [ ] T036 [US3] Implement background job (CRON/Vercel trigger) to auto-approve expired pending submissions in `app/api/cron/auto-approve/route.ts`
- [ ] T060 [US3] Persist task claims and prevent duplicate active claims per worker/task in `lib/services/task.ts`
- [ ] T061 [US3] Create Worker "My Tasks" dashboard for claimed, pending, approved, and rejected submissions in `app/(dashboard)/worker/tasks/page.tsx`
- [ ] T062 [US3] Add marketplace search, category/status filters, reward range filters, and pagination in `app/(marketplace)/page.tsx`
- [ ] T063 [US3] Implement Supabase Storage upload flow for proof screenshots in `lib/services/storage.ts`
- [ ] T064 [US3] Add friendly full-slot and duplicate-submission error states across claim and submission UI
- [ ] T065 [US3] Add Vercel Cron configuration and cron secret validation for auto-approve route

## Phase 6: User Story 4 - Wallet and Escrow Management
*Goal: Track user balances and handle manual withdrawal requests.*
*Test Criteria: Can view balances, deposit records, and request withdrawal to bank transfer.*

- [ ] T025 [P] [US4] Implement `wallet.ts` actions to fetch balances and calculate transaction history in `lib/services/wallet.ts`
- [ ] T026 [US4] Implement `requestWithdrawal` Server Action including 10% fee calculation in `lib/services/wallet.ts`
- [ ] T027 [US4] Create Wallet Dashboard UI (Available/Pending/Escrow) in `app/(dashboard)/wallet/page.tsx`
- [ ] T028 [US4] Create the Transaction History Table UI component in `components/wallet/transaction-history.tsx`
- [ ] T066 [US4] Create bank detail Zod validators and reusable bank transfer form components in `lib/validators/wallet.ts` and `components/wallet/`
- [ ] T067 [US4] Enforce minimum withdrawal threshold and insufficient-balance errors in `requestWithdrawal`
- [ ] T068 [US4] Implement manual Employer deposit request action in `lib/services/wallet.ts`
- [ ] T069 [US4] Create Employer deposit request UI and instructions in `app/(dashboard)/wallet/deposit/page.tsx`
- [ ] T070 [US4] Record immutable ledger entries for deposits, escrow locks, escrow releases, rewards, withdrawals, and fees
- [ ] T071 [P] [US4] Create ledger reconciliation utility to verify wallet totals and transaction consistency in `lib/services/ledger.ts`

## Phase 7: User Story 5 - System Moderation and Anti-Abuse
*Goal: Admins manage users, manual transactions, and limit abuse.*
*Test Criteria: Admin reviews withdrawal requests, applies limits, and tests user bans.*

- [ ] T029 [P] [US5] Implement `processWithdrawal` Server Action (Approve/Reject) in `lib/services/admin.ts`
- [ ] T030 [US5] Create the unified Admin Dashboard in `app/(admin)/dashboard/page.tsx`
- [ ] T031 [US5] Create interface for Admins to view pending withdrawals in `app/(admin)/withdrawals/page.tsx`
- [ ] T032 [US5] Add rate-limiting utility wrapper for critical Server Actions in `lib/utils/rate-limit.ts`
- [ ] T072 [US5] Implement Admin manual deposit approval/rejection flow in `lib/services/admin.ts`
- [ ] T073 [US5] Create Admin deposit review UI in `app/(admin)/deposits/page.tsx`
- [ ] T074 [US5] Implement Admin user search, role/status management, suspension, and ban actions in `lib/services/admin.ts`
- [ ] T075 [US5] Cancel pending withdrawals and freeze funds automatically when Admin suspends a user
- [ ] T076 [US5] Create Admin user management UI in `app/(admin)/users/page.tsx`
- [ ] T077 [P] [US5] Record admin audit logs for withdrawals, deposits, task moderation, and user status changes
- [ ] T078 [P] [US5] Apply rate-limit wrappers to registration, login, task creation, slot claim, submission, withdrawal, and admin actions

## Phase 8: Polish & Cross-Cutting
*Goal: UI/UX polish and deployment configuration to hit performance constraints.*

- [ ] T033 [P] Add Playwright end-to-end framework test for complete Task Flow in `tests/e2e/task-flow.spec.ts`
- [ ] T034 [P] Create Jest unit tests for strict Financial Math logic safely in `tests/unit/wallet.test.ts`
- [ ] T035 [P] Refine loading states and skeleton UI globally in `components/ui/`
- [ ] T037 [P] Setup Gmail SMTP email service and implement core notification utilities in `lib/services/notifications.ts`
- [ ] T038 Integrate email notification triggers into key submission and wallet workflows across services
- [ ] T039 [P] Include continuous performance profiling tests (k6 or artillery) to validate p95 < 300ms core API limits
- [ ] T079 [P] Install and configure Jest test runner, TypeScript transform, and test scripts in `jest.config.ts`
- [ ] T080 [P] Install and configure Playwright project, browser setup, and CI-friendly test scripts in `playwright.config.ts`
- [ ] T081 [P] Add unit tests for task fee, withdrawal fee, ledger reconciliation, and balance invariant utilities
- [ ] T082 [P] Add concurrency tests for slot claiming to prove exact slot limits under parallel requests
- [ ] T083 [P] Create in-app notification center UI in `components/notifications/notification-center.tsx`
- [ ] T084 Integrate notification records and Gmail SMTP email triggers for verification, submission review, auto-approval, withdrawal status, task status, and deposit status
- [ ] T085 [P] Add localized Vietnamese UI copy, empty states, error states, and currency formatting across user-facing pages
- [ ] T086 [P] Add global error, loading, forbidden, and not-found pages for each route group
- [ ] T087 [P] Add analytics instrumentation for key funnels with PostHog in `lib/services/analytics.ts`
- [ ] T088 Add deployment configuration including `vercel.json`, cron schedule, required env docs, and production readiness checklist
