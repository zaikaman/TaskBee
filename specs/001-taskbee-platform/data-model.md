# Phase 1: Data Model

## Core Entities

### User
Represents individuals (Workers, Employers, Admins) on the platform.
- **Fields**:
  - `id`: UUID (Primary Key)
  - `email`: String (Unique)
  - `username`: String (Unique, Nullable until set)
  - `role`: Enum (ADMIN, EMPLOYER, WORKER)
  - `avatarUrl`: String (Nullable)
  - `emailVerified`: Boolean (Default false)
  - `status`: Enum (ACTIVE, SUSPENDED, BANNED)
  - `availableBalance`: Decimal (Default 0, constraint: >= 0)
  - `pendingBalance`: Decimal (Default 0, constraint: >= 0)
  - `escrowBalance`: Decimal (Default 0, constraint: >= 0)
  - `createdAt`, `updatedAt`: DateTime
- **Relationships**:
  - One-to-Many with Task (as Employer)
  - One-to-Many with Submission (as Worker)
  - One-to-Many with Transaction
  - One-to-Many with Withdrawal

### Task
Represents a microtask published by an Employer.
- **Fields**:
  - `id`: UUID (Primary Key)
  - `employerId`: UUID (Foreign Key to User)
  - `title`: String
  - `description`: Text
  - `instructions`: Text
  - `rewardParams`: Decimal (Reward per slot)
  - `totalSlots`: Int
  - `availableSlots`: Int (Constraint: >= 0)
  - `status`: Enum (DRAFT, ACTIVE, PAUSED, COMPLETED, CANCELLED)
  - `autoApproveTimeout`: Int (Days, default 3)
  - `expiresAt`: DateTime (Nullable)
  - `createdAt`, `updatedAt`: DateTime
- **Relationships**:
  - Many-to-One with User (Employer)
  - One-to-Many with Submission

### Submission
Represents a Worker's proof of task completion.
- **Fields**:
  - `id`: UUID (Primary Key)
  - `taskId`: UUID (Foreign Key to Task)
  - `workerId`: UUID (Foreign Key to User)
  - `status`: Enum (PENDING, APPROVED, REJECTED)
  - `proofText`: Text (Nullable)
  - `proofImages`: JSON (Array of URLs, Nullable)
  - `employerFeedback`: Text (Nullable)
  - `createdAt`, `updatedAt`: DateTime
- **Relationships**:
  - Many-to-One with Task
  - Many-to-One with User (Worker)
- **Constraints**: Unique constraint on `[taskId, workerId]` to prevent duplicate submissions per task.

### Transaction
Immutable ledger tracking all fund flows.
- **Fields**:
  - `id`: UUID (Primary Key)
  - `userId`: UUID (Foreign Key to User)
  - `type`: Enum (DEPOSIT, WITHDRAWAL, TASK_ESCROW_LOCK, TASK_ESCROW_RELEASE, TASK_REWARD, FEE)
  - `amount`: Decimal (Positive for credit, Negative for debit)
  - `balanceAfter`: Decimal (Used for audit)
  - `referenceId`: UUID (Nullable, points to Task, Submission, or Withdrawal based on type)
  - `description`: String
  - `createdAt`: DateTime
- **Relationships**:
  - Many-to-One with User

### Withdrawal
Withdrawal request by user.
- **Fields**:
  - `id`: UUID (Primary Key)
  - `userId`: UUID (Foreign Key to User)
  - `amount`: Decimal
  - `fee`: Decimal (10%)
  - `netAmount`: Decimal (Amount - Fee)
  - `status`: Enum (PENDING, APPROVED, REJECTED, CANCELLED)
  - `bankDetails`: JSON
  - `adminFeedback`: Text (Nullable)
  - `createdAt`, `updatedAt`: DateTime
- **Relationships**:
  - Many-to-One with User

## State Transitions
- **Task Status**: DRAFT -> ACTIVE <-> PAUSED -> COMPLETED | CANCELLED
- **Submission Status**: PENDING -> APPROVED | REJECTED
- **Withdrawal Status**: PENDING -> APPROVED | REJECTED | CANCELLED (if suspended)