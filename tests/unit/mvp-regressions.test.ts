import { readFileSync } from "node:fs";
import { join } from "node:path";

const rootDir = process.cwd();

function readSource(relativePath: string) {
  return readFileSync(join(rootDir, relativePath), "utf8");
}

function functionBlock(source: string, functionName: string) {
  const exportedStart = source.indexOf(`export async function ${functionName}`);
  const privateStart = source.indexOf(`async function ${functionName}`);
  const start = exportedStart >= 0 ? exportedStart : privateStart;
  expect(start).toBeGreaterThanOrEqual(0);

  const nextExport = source.indexOf("\nexport async function ", start + 1);
  const nextPrivate = source.indexOf("\nasync function ", start + 1);
  const candidates = [nextExport, nextPrivate].filter((index) => index >= 0);
  const nextFunction = candidates.length > 0 ? Math.min(...candidates) : -1;

  return nextFunction === -1 ? source.slice(start) : source.slice(start, nextFunction);
}

describe("MVP regression guards", () => {
  it("không cho luồng đăng ký OTP kích hoạt lại profile đã tồn tại", () => {
    const block = functionBlock(readSource("lib/services/auth.ts"), "confirmRegistrationOtp");

    expect(block).toContain("existingProfile");
    expect(block).toContain("prisma.user.create");
    expect(block).not.toContain("prisma.user.upsert");
    expect(block).not.toContain('status: "ACTIVE"');
  });

  it("hủy withdrawal phải lock row và dùng conditional update", () => {
    const block = functionBlock(readSource("lib/services/wallet.ts"), "cancelWithdrawal");

    expect(block).toContain('SELECT id FROM "Withdrawal"');
    expect(block).toContain("FOR UPDATE");
    expect(block).toContain("tx.withdrawal.updateMany");
    expect(block).toContain("status: WithdrawalStatus.PENDING");
    expect(block).toContain("tx.user.updateMany");
    expect(block).toContain("pendingBalance");
    expect(block).toContain("gte: amount");
  });

  it("close/cancel task phải lock task và update trạng thái có điều kiện", () => {
    const taskSource = readSource("lib/services/task.ts");
    const closeBlock = functionBlock(taskSource, "closeTask");
    const cancelBlock = functionBlock(taskSource, "cancelTask");

    for (const block of [closeBlock, cancelBlock]) {
      expect(block).toContain("await lockTaskRow(tx, taskId)");
      expect(block).toContain("tx.task.updateMany");
      expect(block).toContain("employerId: profile.id");
      expect(block).toContain("in: [TaskStatus.ACTIVE, TaskStatus.PAUSED]");
    }
  });

  it("resubmit sau khi bị reject không tăng submittedSlots lần nữa", () => {
    const block = functionBlock(readSource("lib/services/submission.ts"), "createSubmissionRecord");

    expect(block).toContain("const hadExistingSubmission = Boolean(claim.submission)");
    expect(block).toContain("if (!hadExistingSubmission)");
    expect(block).toContain("submittedSlots");
    expect(block).toContain("hadExistingSubmission,");
  });
});
