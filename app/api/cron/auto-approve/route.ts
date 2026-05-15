import { revalidatePath } from "next/cache";
import { type NextRequest } from "next/server";
import { getPrisma } from "@/lib/db/prisma";
import {
  approveSubmissionTransaction,
  loadExpiredPendingSubmissionContexts,
} from "@/lib/services/submission-workflow";

export const dynamic = "force-dynamic";

const CRON_SECRET_HEADER = "x-cron-secret";

function readProvidedCronSecret(request: NextRequest) {
  const headerSecret = request.headers.get(CRON_SECRET_HEADER)?.trim();

  if (headerSecret) {
    return headerSecret;
  }

  const authorizationHeader = request.headers.get("authorization")?.trim();

  if (authorizationHeader) {
    if (/^bearer\s+/i.test(authorizationHeader)) {
      return authorizationHeader.replace(/^bearer\s+/i, "").trim();
    }

    return authorizationHeader;
  }

  return request.nextUrl.searchParams.get("secret")?.trim() ?? "";
}

async function handleAutoApproveCron(request: NextRequest) {
  const configuredSecret = process.env.CRON_SECRET?.trim();

  if (!configuredSecret) {
    return Response.json(
      {
        ok: false,
        error: "CRON_SECRET chưa được cấu hình trên môi trường chạy.",
      },
      {
        status: 500,
      },
    );
  }

  const providedSecret = readProvidedCronSecret(request);

  if (!providedSecret || providedSecret !== configuredSecret) {
    return Response.json(
      {
        ok: false,
        error: "Không có quyền chạy cron auto-approve.",
      },
      {
        status: 401,
      },
    );
  }

  const prisma = getPrisma();
  const now = new Date();
  const submissions = await loadExpiredPendingSubmissionContexts(now);
  const affectedTaskIds = new Set<string>();
  const failures: Array<{ submissionId: string; error: string }> = [];
  let approvedCount = 0;
  let skippedCount = 0;

  for (const submission of submissions) {
    try {
      const result = await prisma.$transaction(async (tx) =>
        approveSubmissionTransaction(tx, submission),
      );

      approvedCount += 1;
      affectedTaskIds.add(result.taskId);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Không thể auto-approve submission này.";

      if (
        message === "Submission này đã được review rồi." ||
        message === "Task này không còn active nên không thể duyệt submission."
      ) {
        skippedCount += 1;
        continue;
      }

      failures.push({
        submissionId: submission.id,
        error: message,
      });
    }
  }

  if (approvedCount > 0) {
    revalidatePath("/dashboard/employer/tasks");
    revalidatePath("/dashboard/worker/tasks");
    revalidatePath("/marketplace");

    for (const taskId of affectedTaskIds) {
      revalidatePath(`/dashboard/employer/tasks/${taskId}`);
      revalidatePath(`/marketplace/${taskId}`);
    }
  }

  const responseBody = {
    ok: failures.length === 0,
    totalFound: submissions.length,
    approvedCount,
    skippedCount,
    failedCount: failures.length,
    failures,
  };

  if (failures.length > 0) {
    return Response.json(responseBody, {
      status: 500,
    });
  }

  return Response.json(responseBody);
}

export async function GET(request: NextRequest) {
  return handleAutoApproveCron(request);
}

export async function POST(request: NextRequest) {
  return handleAutoApproveCron(request);
}