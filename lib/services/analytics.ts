import "server-only";

import { getPostHogClient } from "@/lib/posthog-server";

type AnalyticsProperties = Record<string, string | number | boolean | null | undefined>;

export async function captureServerEvent(
  distinctId: string,
  event: string,
  properties: AnalyticsProperties = {},
) {
  const client = getPostHogClient();

  if (!client) {
    return;
  }

  client.capture({
    distinctId,
    event,
    properties: {
      app: "taskbee",
      ...properties,
    },
  });
}

export async function captureTaskFlowEvent(
  distinctId: string,
  event:
    | "task_created"
    | "task_claimed"
    | "submission_created"
    | "submission_reviewed"
    | "withdrawal_requested"
    | "deposit_intent_created"
    | "deposit_confirmed",
  properties: AnalyticsProperties = {},
) {
  await captureServerEvent(distinctId, event, properties);
}
