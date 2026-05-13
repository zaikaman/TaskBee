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
*Goal: Initialize Next.js project, styling, and essential infrastructure.*

- [ ] T001 Initialize Next.js 14 App Router project in `/`
- [ ] T002 Setup TailwindCSS and `shadcn/ui` base configuration in `components.json` and `tailwind.config.ts`
- [ ] T003 Initialize Prisma ORM in `prisma/schema.prisma`
- [ ] T004 Setup database connection with Supabase PostgreSQL in `.env.local`
- [ ] T005 [P] Setup Supabase Auth client in `lib/auth/client.ts` and `lib/auth/server.ts`

## Phase 2: Foundational
*Goal: Configure data models and foundational layouts. Blocks user stories.*

- [ ] T006 Implement data models (User, Task, Submission, Transaction, Withdrawal) in `prisma/schema.prisma`
- [ ] T007 Generate Prisma client and create base instance in `lib/db/prisma.ts`
- [ ] T008 [P] Setup auth middleware for protected route verification in `middleware.ts`
- [ ] T009 [P] Create base application layout and navbar in `app/layout.tsx`

## Phase 3: User Story 1 - User Authentication & Profiles
*Goal: System MUST support user registration, login, email verification, and profile management.*
*Test Criteria: Can create account, verify, login, and view profile.*

- [ ] T010 [US1] Create registration UI and Server Action in `app/(auth)/register/page.tsx`
- [ ] T011 [US1] Create login UI and Server Action in `app/(auth)/login/page.tsx`
- [ ] T012 [US1] Implement email verification callback flow in `app/(auth)/verify/page.tsx`
- [ ] T013 [P] [US1] Create profile UI dashboard in `app/(dashboard)/profile/page.tsx`
- [ ] T014 [US1] Implement profile update server action in `lib/services/user.ts`

## Phase 4: User Story 2 - Employer Task Lifecycle
*Goal: System MUST allow Employers to create tasks with specific instructions, rewards, and available slots.*
*Test Criteria: Employer can fund and post a task, and later approve submissions.*

- [ ] T015 [P] [US2] Create Zod schemas for task generation in `lib/validators/task.ts`
- [ ] T016 [US2] Implement `createTask` Server Action (with Wallet Escrow lock logic) in `lib/services/task.ts`
- [ ] T017 [US2] Create the Task Creation Form UI in `components/tasks/create-task-form.tsx`
- [ ] T018 [US2] Create Task listing dashboard for Employers in `app/(dashboard)/employer/tasks/page.tsx`
- [ ] T019 [US2] Implement submission approval/rejection action (`reviewSubmission`) in `lib/services/submission.ts`

## Phase 5: User Story 3 - Worker Task Completion
*Goal: System MUST allow Workers to browse, claim slots, and submit proof for Active Tasks.*
*Test Criteria: Worker finds active task, claims slot (respecting concurrency locks), and uploads proof.*

- [ ] T020 [P] [US3] Implement optimistic lock slot claim logic (`claimTaskSlot`) in `lib/services/task.ts`
- [ ] T021 [US3] Create Task Marketplace browsing view for workers in `app/(marketplace)/page.tsx`
- [ ] T022 [US3] Create individual Task Details view in `app/(marketplace)/tasks/[id]/page.tsx`
- [ ] T023 [US3] Implement Server Action to process Worker proof submissions (`createSubmission`) in `lib/services/submission.ts`
- [ ] T024 [P] [US3] Create the proof submission upload UI (images/text) in `components/tasks/submission-form.tsx`
- [ ] T036 [US3] Implement background job (CRON/Vercel trigger) to auto-approve expired pending submissions in `app/api/cron/auto-approve/route.ts`

## Phase 6: User Story 4 - Wallet and Escrow Management
*Goal: Track user balances and handle manual withdrawal requests.*
*Test Criteria: Can view balances, deposit records, and request withdrawal to bank transfer.*

- [ ] T025 [P] [US4] Implement `wallet.ts` actions to fetch balances and calculate transaction history in `lib/services/wallet.ts`
- [ ] T026 [US4] Implement `requestWithdrawal` Server Action including 10% fee calculation in `lib/services/wallet.ts`
- [ ] T027 [US4] Create Wallet Dashboard UI (Available/Pending/Escrow) in `app/(dashboard)/wallet/page.tsx`
- [ ] T028 [US4] Create the Transaction History Table UI component in `components/wallet/transaction-history.tsx`

## Phase 7: User Story 5 - System Moderation and Anti-Abuse
*Goal: Admins manage users, manual transactions, and limit abuse.*
*Test Criteria: Admin reviews withdrawal requests, applies limits, and tests user bans.*

- [ ] T029 [P] [US5] Implement `processWithdrawal` Server Action (Approve/Reject) in `lib/services/admin.ts`
- [ ] T030 [US5] Create the unified Admin Dashboard in `app/(admin)/dashboard/page.tsx`
- [ ] T031 [US5] Create interface for Admins to view pending withdrawals in `app/(admin)/withdrawals/page.tsx`
- [ ] T032 [US5] Add rate-limiting utility wrapper for critical Server Actions in `lib/utils/rate-limit.ts`

## Phase 8: Polish & Cross-Cutting
*Goal: UI/UX polish and deployment configuration to hit performance constraints.*

- [ ] T033 [P] Add Playwright end-to-end framework test for complete Task Flow in `tests/e2e/task-flow.spec.ts`
- [ ] T034 [P] Create Jest unit tests for strict Financial Math logic safely in `tests/unit/wallet.test.ts`
- [ ] T035 [P] Refine loading states and skeleton UI globally in `components/ui/`
- [ ] T037 [P] Setup Resend email service and implement core notification utilities in `lib/services/notifications.ts`
- [ ] T038 Integrate email notification triggers into key submission and wallet workflows across services
- [ ] T039 [P] Include continuous performance profiling tests (k6 or artillery) to validate p95 < 300ms core API limits