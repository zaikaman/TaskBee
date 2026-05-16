import { type NextRequest } from "next/server";
import { reconcileDepositIntents } from "@/lib/services/payments/reconciliation";

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

function parsePositiveIntegerParam(value: string | null) {
  if (!value) {
    return null;
  }

  const parsedValue = Number.parseInt(value, 10);

  return Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : null;
}

function jsonResponse(body: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers);

  headers.set("Cache-Control", "no-store");

  return Response.json(body, {
    ...init,
    headers,
  });
}

async function handleReconcileDepositsCron(request: NextRequest) {
  const configuredSecret = process.env.CRON_SECRET?.trim();

  if (!configuredSecret) {
    return jsonResponse(
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
    return jsonResponse(
      {
        ok: false,
        error: "Không có quyền chạy cron đối soát lệnh nạp tiền.",
      },
      {
        status: 401,
      },
    );
  }

  const summary = await reconcileDepositIntents({
    batchSize: parsePositiveIntegerParam(request.nextUrl.searchParams.get("batchSize")),
    lookbackHours: parsePositiveIntegerParam(request.nextUrl.searchParams.get("lookbackHours")),
  });

  if (!summary.ok) {
    return jsonResponse(summary, {
      status: 500,
    });
  }

  return jsonResponse(summary);
}

export async function GET(request: NextRequest) {
  return handleReconcileDepositsCron(request);
}

export async function POST(request: NextRequest) {
  return handleReconcileDepositsCron(request);
}
