import { PAYMENT_CONFIG } from "@/config/app";
import {
  processNowPaymentsUsdtWebhookPayload,
  verifyNowPaymentsSignature,
  type NowPaymentsIpnPayload,
} from "@/lib/services/payments/nowpayments";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const JSON_CONTENT_TYPE = "application/json";

function jsonResponse(body: Record<string, unknown>, init?: ResponseInit) {
  return Response.json(body, {
    ...init,
    headers: {
      "Cache-Control": "no-store",
      ...(init?.headers ?? {}),
    },
  });
}

function readWebhookSecret() {
  const secret = process.env.USDT_WEBHOOK_SECRET?.trim();

  if (!secret) {
    throw new Error("USDT_WEBHOOK_SECRET chưa được cấu hình.");
  }

  return secret;
}

function parseJsonPayload(rawBody: string): NowPaymentsIpnPayload {
  const payload = JSON.parse(rawBody) as NowPaymentsIpnPayload;

  if (!payload || typeof payload !== "object") {
    throw new Error("Payload NOWPayments không hợp lệ.");
  }

  return payload;
}

export async function POST(request: Request) {
  let rawBody = "";

  try {
    const contentType = request.headers.get("content-type") ?? "";

    if (!contentType.toLowerCase().includes(JSON_CONTENT_TYPE)) {
      return jsonResponse(
        {
          success: false,
          error: "Webhook USDT chỉ chấp nhận JSON.",
        },
        {
          status: 415,
        },
      );
    }

    rawBody = await request.text();
    const payload = parseJsonPayload(rawBody);
    const webhookSecret = readWebhookSecret();
    const signatureHeader = request.headers.get(PAYMENT_CONFIG.usdt.webhook.signatureHeader);

    if (!verifyNowPaymentsSignature(payload, signatureHeader, webhookSecret)) {
      return jsonResponse(
        {
          success: false,
          error: "Chữ ký webhook NOWPayments không hợp lệ.",
        },
        {
          status: 401,
        },
      );
    }

    const result = await processNowPaymentsUsdtWebhookPayload(payload);

    console.info("Kết quả xử lý webhook USDT NOWPayments:", {
      status: result.status,
      depositIntentId: result.depositIntentId,
      paymentCode: result.paymentCode,
      message: result.message,
    });

    return jsonResponse(PAYMENT_CONFIG.usdt.webhook.successResponse);
  } catch (error) {
    console.error("Lỗi khi xử lý webhook USDT NOWPayments:", {
      error,
      rawBody,
    });

    return jsonResponse(
      {
        success: false,
        error: "Không thể xử lý webhook USDT lúc này.",
      },
      {
        status: 500,
      },
    );
  }
}
