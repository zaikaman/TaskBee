"use server";

import {
  createDepositIntent,
  refreshDepositIntentFromProvider,
  type CreateDepositIntentResult,
  type DepositIntentDetails,
} from "@/lib/services/wallet";

export type CreateDepositActionState = CreateDepositIntentResult;

export async function createDepositAction(
  _previousState: CreateDepositActionState,
  formData: FormData,
): Promise<CreateDepositActionState> {
  const provider = String(formData.get("provider") ?? "");
  const amount = String(formData.get("amount") ?? "");
  const currency = String(formData.get("currency") ?? "VND");
  const usdtNetwork = String(formData.get("usdtNetwork") ?? "");

  return createDepositIntent({
    amount,
    provider,
    currency,
    usdtNetwork: usdtNetwork || undefined,
  });
}

export async function refreshDepositIntentAction(
  depositIntentId: string,
): Promise<DepositIntentDetails | null> {
  return refreshDepositIntentFromProvider(depositIntentId);
}
