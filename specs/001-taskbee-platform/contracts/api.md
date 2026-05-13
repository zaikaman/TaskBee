# Internal Core Contracts (Server Actions)

Since this is a monolithic Next.js App Router project, there isn't a public REST API. Inter-module communication relies on typed Server Actions and internal utility functions. Input validation relies heavily on `zod` schemas.

## 1. Task Operations (`lib/services/task.ts`)

### `createTask`
- **Request**:
  ```ts
  {
    title: string;
    description: string;
    instructions: string;
    rewardParams: number;
    totalSlots: number;
    autoApproveTimeout: number; // 1-7
  }
  ```
- **Response**: `{ success: boolean, taskId?: string, error?: string }`
- **Logic**: Deducts total amount (rewardParams * totalSlots * 1.1 fee) from user's `availableBalance` to `escrowBalance`. Validations on balance > cost required. Execute as Prisma transaction.

### `claimTaskSlot`
- **Request**: `{ taskId: string }`
- **Response**: `{ success: boolean, error?: string }`
- **Logic**: Atomically decrement `availableSlots` via `UPDATE task SET availableSlots = availableSlots - 1 WHERE id = taskId AND availableSlots > 0`.

## 2. Submission Operations (`lib/services/submission.ts`)

### `createSubmission`
- **Request**:
  ```ts
  {
    taskId: string;
    proofText?: string;
    proofImages?: string[];
  }
  ```
- **Response**: `{ success: boolean, submissionId?: string, error?: string }`
- **Logic**: Requires prior slot claim validation. Creates a new submission.

### `reviewSubmission`
- **Request**:
  ```ts
  {
    submissionId: string;
    action: "APPROVE" | "REJECT";
    feedback?: string; // Required if REJECT
  }
  ```
- **Response**: `{ success: boolean, error?: string }`
- **Logic**: Moving funds from Escrow to Worker available balance on Auth (with transaction creation). Releasing partial escrow back to Employer if Rejected and no more tries permitted.

## 3. Wallet Operations (`lib/services/wallet.ts`)

### `requestWithdrawal`
- **Request**:
  ```ts
  {
    amount: number;
    bankDetails: {
      accountNumber: string;
      bankName: string;
      accountName: string;
    }
  }
  ```
- **Response**: `{ success: boolean, withdrawalId?: string, error?: string }`
- **Logic**: Checks if `availableBalance >= amount`. Deducts amount and adds to `pendingBalance`.

## 4. Admin Operations (`lib/services/admin.ts`)

### `processWithdrawal`
- **Request**:
  ```ts
  {
    withdrawalId: string;
    action: "APPROVE" | "REJECT";
    feedback?: string;
  }
  ```
- **Response**: `{ success: boolean, error?: string }`
- **Logic**: Move from Pending balance to absolute zero if Approved, or return to Available if Rejected.