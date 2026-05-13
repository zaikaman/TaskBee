# Feature Specification: TaskBee MVP

**Feature Branch**: `[001-taskbee-platform]`  
**Created**: May 14, 2026  
**Status**: Draft  
**Input**: User description: TaskBee microtask marketplace for Vietnam, focusing on Employer task creation, Worker submission, basic wallet escrow, and Admin moderation.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - User Authentication & Profiles (Priority: P1)

Users (Workers, Employers, Admins) must be able to securely register, verify their identities via email, login, and manage their profiles.

**Why this priority**: Without secure access and identities, no marketplace transactions can occur. This is the foundational capability.

**Independent Test**: Can be fully tested by creating a new account, verifying it, logging in, changing profile settings, and verifying role access.

**Acceptance Scenarios**:

1. **Given** an unauthenticated visitor, **When** they fill the registration form with valid details, **Then** they receive a verification email and their account is created.
2. **Given** a registered user with an unverified email, **When** they attempt to login, **Then** the system prompts them to verify their email before accessing the platform.
3. **Given** an authenticated user, **When** they view their profile, **Then** they can see their avatar, username, and role-specific stats.

---

### User Story 2 - Employer Task Lifecycle (Priority: P1)

Employers must be able to create tasks with specific instructions, rewards, and available slots, as well as fund these tasks.

**Why this priority**: Task creation generates the core supply side of the marketplace. 

**Independent Test**: Can be fully tested by an Employer user creating a task, specifying proof requirements, and seeing it listed in the marketplace.

**Acceptance Scenarios**:

1. **Given** an authenticated Employer with sufficient balance, **When** they create a task entering title, description, reward, and slots, **Then** the total task cost is reserved in escrow and the task becomes active in the marketplace.
2. **Given** an active task with pending submissions, **When** the Employer reviews a submission, **Then** they can approve or reject it, releasing the funds appropriately.
3. **Given** an Employer wants to manage active tasks, **When** they choose to pause or close a task, **Then** no new slots can be claimed and unreserved funds are returned to their wallet.

---

### User Story 3 - Worker Task Completion (Priority: P1)

Workers must be able to browse available tasks, claim a slot, follow instructions, and submit proof of completion.

**Why this priority**: Task completion is the core demand side of the marketplace.

**Independent Test**: Can be tested by a Worker finding an active task, submitting proof, and having their pending balance updated upon approval.

**Acceptance Scenarios**:

1. **Given** an authenticated Worker browsing the marketplace, **When** they view an active task, **Then** they can see instructions, reward, and remaining slots.
2. **Given** a Worker ready to complete a task, **When** they upload required proof text/images, **Then** their submission is recorded and marked as pending review.
3. **Given** an Employer has approved a Worker's submission, **When** the approval is recorded, **Then** the Worker receives a notification and the reward is added to their available balance.

---

### User Story 4 - Wallet and Escrow Management (Priority: P2)

Users must be able to track their balances, view transaction history, and request withdrawals. The system must hold funds securely in escrow while tasks are active.

**Why this priority**: Financial trust and visibility are critical for a microtask platform.

**Independent Test**: Can be tested by depositing funds, creating a task (triggering escrow), approving a submission (releasing escrow), and requesting a withdrawal.

**Acceptance Scenarios**:

1. **Given** a Worker with a balance exceeding the minimum withdrawal threshold, **When** they submit a withdrawal request, **Then** the funds are marked as pending and an Admin request is created.
2. **Given** an Employer funding a task, **When** the task is published, **Then** the exact required amount moves from their available balance to the escrow balance.

---

### User Story 5 - System Moderation and Anti-Abuse (Priority: P2)

Admins must be able to monitor the platform, manage users, handle withdrawal requests, and enforce anti-abuse measures.

**Why this priority**: Ensures the platform remains compliant, safe, and trustworthy for all participants.

**Independent Test**: Can be tested by an Admin viewing the dashboard, blocking a user account, and reviewing withdrawal requests.

**Acceptance Scenarios**:

1. **Given** an Admin reviewing pending withdrawals, **When** they approve a withdrawal, **Then** the transaction is marked complete and the user balance is permanently deducted.
2. **Given** a user violating platform rules, **When** an Admin suspends their account, **Then** the user can no longer log in or interact with active tasks.

### Edge Cases

- [All edge cases resolved during clarification session]

## Clarifications

### Session 2026-05-14
- Q: What is the platform fee model? → A: 10% per worker withdrawal and 10% per task creation by Employer
- Q: What happens to pending submissions when a task expires? → A: Auto-approve after employer-configured timeout (1 to 7 days).
- Q: How to handle pending withdrawals if an account is suspended? → A: Automatically cancel the withdrawal and freeze funds.
- Q: How to handle concurrent slot reservations? → A: First-come, first-served with a friendly error to the loser.
- Q: Rejecting without feedback allowed? → A: No, rejection feedback is mandatory to submit rejection.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST support user registration and authentication via email/password.
- **FR-002**: System MUST enforce email verification before a user can act as an Employer or Worker.
- **FR-003**: System MUST support role-based access control (Admin, Employer, Worker).
- **FR-004**: System MUST allow Employers to create tasks defining instructions, slots, pricing, and proof requirements.
- **FR-005**: System MUST deduct and hold necessary total task funds in escrow upon task creation.
- **FR-006**: System MUST allow Workers to browse, filter, and view active tasks.
- **FR-007**: System MUST allow Workers to submit textual and visual proof (screenshots) for task completion.
- **FR-008**: System MUST allow Employers to approve or reject a Worker's submission.
- **FR-009**: System MUST enforce provision of rejection feedback when an Employer rejects a submission.
- **FR-010**: System MUST automatically transfer funds from escrow to the Worker's available balance upon submission approval.
- **FR-011**: System MUST support withdrawal requests from Workers who meet a minimum balance threshold.
- **FR-012**: System MUST allow Admins to approve/process or reject withdrawal requests.
- **FR-013**: System MUST track and display full transaction history and wallet states for all users.
- **FR-014**: System MUST implement basic rate limiting and duplicate submission prevention to mitigate abuse.
- **FR-015**: System MUST generate notifications (in-app and/or email) for critical events like submission review, withdrawal status, and task updates.
- **FR-016**: System MUST support Manual Bank Transfer as the primary method for Employer deposits and Worker withdrawals in the MVP.
- **FR-017**: System MUST charge Employers a 10% fee on top of the total task cost during task creation.
- **FR-018**: System MUST deduct a 10% fee from the requested amount during Worker withdrawals.
- **FR-019**: System MUST allow Employers to configure an auto-approve timeout (1 to 7 days) upon task creation.
- **FR-020**: System MUST automatically approve pending submissions once the configured auto-approve timeout has elapsed.
- **FR-021**: System MUST automatically cancel any pending withdrawal requests and freeze funds if the associated user account is suspended by an Admin.
- **FR-022**: System MUST use optimistic or pessimistic database locking when claiming a task slot to ensure exact slot limits (first-come, first-served), returning a friendly error if full.

### Key Entities

- **User**: Represents individuals on the platform containing authentication status, wallet balances (available, pending, escrow), and roles.
- **Task**: Represents a unit of work created by an Employer, holding requirements, budget, slot counts, and state tracking.
- **Submission**: Represents a Worker's attempt to complete a Task, containing proof data and approval state.
- **Transaction**: Immutable ledger entries tracking the movement of funds (deposits, escrows, rewards, withdrawals).
- **Withdrawal**: A specific user request to extract funds from the platform to external accounts.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Employers can successfully post a funded task in under 3 minutes.
- **SC-002**: Workers can submit proof for an active task with zero data loss or duplicate submissions during high concurrency.
- **SC-003**: The system flawlessly balances the ledger 100% of the time, ensuring total distributed funds equal total deposited funds minus withdrawals and fees.
- **SC-004**: System can support at least 1,000 concurrent users browsing the task marketplace without performance degradation.
- **SC-005**: 95% of core API requests (task loading, submission) return a response within 300ms.

## Assumptions

- Users have stable internet connectivity and can provide digital proof (screenshots).
- Disputed submissions that aren't resolved between Employer and Worker will be manually handled by Admins within the MVP.
- Real-time chat, AI moderation, generic crypto payment, and affiliate structures are explicitly out of scope for the MVP.
- All users understand Vietnamese localization as the primary language of the interface.
- Standard email delivery services will be capable of ensuring high deliverability of verification and notification emails.