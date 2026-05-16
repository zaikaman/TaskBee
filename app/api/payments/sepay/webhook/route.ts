import { createHmac, timingSafeEqual } from "node:crypto";
import { PAYMENT_CONFIG } from "@/config/app";
import {
  processSePayWebhookPayload,
  type SePayWebhookPayload,
} from "@/lib/services/payments/sepay";

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
  const secret = process.env.SEPAY_WEBHOOK_SECRET?.trim();

  if (!secret) {
    return null;
  }

  return secret;
}

function readWebhookApiKey() {
  return process.env.SEPAY_WEBHOOK_API_KEY?.trim() ?? null;
}

function normalizeSignature(signature: string | null) {
  return signature?.trim().replace(/^sha256=/i, "") ?? "";
}

function verifyTimestamp(timestampHeader: string | null) {
  const timestamp = Number(timestampHeader);

  if (!Number.isFinite(timestamp)) {
    return false;
  }

  const timestampMs = timestamp > 10_000_000_000 ? timestamp : timestamp * 1000;
  const ageSeconds = Math.abs(Date.now() - timestampMs) / 1000;

  return ageSeconds <= PAYMENT_CONFIG.sepay.webhook.replayToleranceSeconds;
}

function verifySignature(
  rawBody: string,
  timestampHeader: string,
  signatureHeader: string | null,
  secret: string,
) {
  const providedSignature = normalizeSignature(signatureHeader);

  if (!providedSignature) {
    return false;
  }

  const expectedSignature = createHmac("sha256", secret)
    .update(`${timestampHeader}.${rawBody}`, "utf8")
    .digest("hex");
  const providedBuffer = Buffer.from(providedSignature, "hex");
  const expectedBuffer = Buffer.from(expectedSignature, "hex");

  if (providedBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(providedBuffer, expectedBuffer);
}

function parseJsonPayload(rawBody: string): SePayWebhookPayload {
  const payload = JSON.parse(rawBody) as SePayWebhookPayload;

  if (!payload || typeof payload !== "object") {
    throw new Error("Payload SePay không hợp lệ.");
  }

  return payload;
}

function verifyApiKey(authorizationHeader: string | null, expectedApiKey: string | null) {
  if (!expectedApiKey || !authorizationHeader) {
    return false;
  }

  const providedApiKey = authorizationHeader.replace(/^apikey\s+/i, "").trim();

  return providedApiKey === expectedApiKey;
}

function verifyWebhookAuthentication(request: Request, rawBody: string) {
  const timestampHeader = request.headers.get(PAYMENT_CONFIG.sepay.webhook.timestampHeader);
  const signatureHeader = request.headers.get(PAYMENT_CONFIG.sepay.webhook.signatureHeader);
  const webhookSecret = readWebhookSecret();

  if (timestampHeader || signatureHeader) {
    return Boolean(
      webhookSecret &&
        timestampHeader &&
        verifyTimestamp(timestampHeader) &&
        verifySignature(rawBody, timestampHeader, signatureHeader, webhookSecret),
    );
  }

  return verifyApiKey(request.headers.get("authorization"), readWebhookApiKey());
}

export async function POST(request: Request) {
  let rawBody = "";

  try {
    const contentType = request.headers.get("content-type") ?? "";

    if (!contentType.toLowerCase().includes(JSON_CONTENT_TYPE)) {
      console.warn("Webhook SePay bị từ chối vì content-type không hợp lệ.", {
        contentType,
      });

      return jsonResponse(
        {
          success: false,
          error: "Webhook SePay chỉ chấp nhận JSON.",
        },
        {
          status: 415,
        },
      );
    }

    rawBody = await request.text();

    if (!verifyWebhookAuthentication(request, rawBody)) {
      console.warn("Webhook SePay bị từ chối vì xác thực không hợp lệ.", {
        hasSignature: Boolean(request.headers.get(PAYMENT_CONFIG.sepay.webhook.signatureHeader)),
        hasTimestamp: Boolean(request.headers.get(PAYMENT_CONFIG.sepay.webhook.timestampHeader)),
        hasAuthorization: Boolean(request.headers.get("authorization")),
      });

      return jsonResponse(
        {
          success: false,
          error: "Xác thực webhook SePay không hợp lệ.",
        },
        {
          status: 401,
        },
      );
    }

    const payload = parseJsonPayload(rawBody);
    const result = await processSePayWebhookPayload(payload);

    console.info("Kết quả xử lý webhook SePay:", {
      status: result.status,
      depositIntentId: result.depositIntentId,
      paymentCode: result.paymentCode,
      message: result.message,
    });

    return jsonResponse(PAYMENT_CONFIG.sepay.webhook.successResponse);
  } catch (error) {
    console.error("Lỗi khi xử lý webhook SePay:", {
      error,
      rawBody,
    });

    return jsonResponse(
      {
        success: false,
        error: "Không thể xử lý webhook SePay lúc này.",
      },
      {
        status: 500,
      },
    );
  }
}
