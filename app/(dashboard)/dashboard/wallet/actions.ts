"use server";

import {
  transferWorkerFundsToEmployer,
  type TransferWorkerFundsToEmployerResult,
} from "@/lib/services/wallet";

export type TransferWorkerFundsActionState = TransferWorkerFundsToEmployerResult;

export async function transferWorkerFundsAction(
  _previousState: TransferWorkerFundsActionState,
  formData: FormData,
): Promise<TransferWorkerFundsActionState> {
  const amount = String(formData.get("amount") ?? "");

  return transferWorkerFundsToEmployer(amount);
}
