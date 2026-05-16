"use server";

import {
  transferWorkerFundsToEmployer,
  type TransferWorkerFundsToEmployerResult,
} from "@/lib/services/wallet";
import { auth } from "@/lib/auth/session";

export type TransferWorkerFundsActionState = TransferWorkerFundsToEmployerResult;

export async function transferWorkerFundsAction(
  _previousState: TransferWorkerFundsActionState,
  formData: FormData,
): Promise<TransferWorkerFundsActionState> {
  const session = await auth();
  void session;

  const amount = String(formData.get("amount") ?? "");

  return transferWorkerFundsToEmployer(amount);
}
