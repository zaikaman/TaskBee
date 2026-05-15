"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import {
  confirmLoginOtp,
  requestLoginOtp,
  type LoginState,
} from "@/lib/services/auth";

const initialState: LoginState = {
  phase: "form",
};

type LoginOtpFormProps = {
  redirectTo?: string;
};

export function LoginOtpForm({ redirectTo = "/marketplace" }: LoginOtpFormProps) {
  const [sendState, sendAction, sendPending] = useActionState(requestLoginOtp, {
    ...initialState,
    redirectTo,
  });
  const [verifyState, verifyAction, verifyPending] = useActionState(confirmLoginOtp, {
    ...initialState,
    redirectTo,
  });

  const activeEmail = sendState.email ?? verifyState.email ?? "";
  const activeRedirectTo = sendState.redirectTo ?? verifyState.redirectTo ?? redirectTo;
  const rememberMe = sendState.rememberMe ?? verifyState.rememberMe ?? true;
  const isOtpStep = sendState.phase === "otp";
  const resendAvailableAt = sendState.resendAvailableAt ?? 0;
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  const remainingResendSeconds = Math.max(
    0,
    Math.ceil((resendAvailableAt - currentTime) / 1000),
  );
  const canResendOtp = remainingResendSeconds === 0 && !sendPending;

  useEffect(() => {
    if (!resendAvailableAt) {
      return;
    }

    const timerId = window.setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(timerId);
    };
  }, [resendAvailableAt]);

  return (
    <div className="w-full">
      <h1 className="text-[30px] font-bold leading-none text-[#203259]">Đăng nhập</h1>

      {!isOtpStep ? (
        <form action={sendAction} className="mt-9 space-y-7">
          <input name="redirectTo" type="hidden" value={activeRedirectTo} />

          <label className="block">
            <span className="mb-2 block text-sm font-bold text-[#a8b0bf]">Email</span>
            <input
              autoComplete="email"
              className="h-[42px] w-full rounded-none border-0 bg-[#edf4ff] px-4 text-sm text-[#203259] outline-none placeholder:text-[#7f8aa0] focus:bg-[#f2f4f7] focus:ring-1 focus:ring-[#22ab59]"
              defaultValue={activeEmail}
              name="email"
              placeholder="email@example.com"
              required
              type="email"
            />
          </label>

          <div className="flex items-center justify-between text-sm">
            <label className="flex items-center gap-2 font-bold text-[#1b1b1b]">
              <input
                className="size-3.5 accent-[#22ab59]"
                defaultChecked={rememberMe}
                name="rememberMe"
                type="checkbox"
                value="true"
              />
              Ghi nhớ tôi
            </label>
            <Link className="text-[#22ab59] underline hover:text-[#005924]" href="/register">
              Tạo tài khoản
            </Link>
          </div>

          {sendState.error ? (
            <p className="border border-[#fce3e5] bg-[#fff6f6] px-4 py-3 text-sm text-[#e63e46]">
              {sendState.error}
            </p>
          ) : null}

          {sendState.message ? (
            <p className="border border-[#d7f4e2] bg-[#f3fff8] px-4 py-3 text-sm text-[#005924]">
              {sendState.message}
            </p>
          ) : null}

          <button
            className="h-[46px] w-full bg-[#22ab59] text-sm font-black uppercase text-white hover:bg-[#005924] disabled:opacity-60"
            disabled={sendPending}
            type="submit"
          >
            {sendPending ? "Đang gửi..." : "Gửi OTP"}
          </button>
        </form>
      ) : (
        <div className="mt-9 space-y-7">
          <p className="text-base leading-6 text-black">
            Mã OTP đã được gửi tới <span className="font-bold text-[#203259]">{activeEmail}</span>.
            Nhập mã để đăng nhập TaskBee.
          </p>

          <form action={verifyAction} className="space-y-7">
            <input name="email" type="hidden" value={activeEmail} />
            <input name="redirectTo" type="hidden" value={activeRedirectTo} />
            <input name="rememberMe" type="hidden" value={rememberMe ? "true" : "false"} />

            <label className="block">
              <span className="mb-2 block text-sm font-bold text-[#a8b0bf]">Mã OTP</span>
              <input
                autoComplete="one-time-code"
                className="h-[48px] w-full rounded-none border-0 bg-[#edf4ff] px-4 text-center text-2xl tracking-[0.32em] text-[#203259] outline-none placeholder:text-[#a8b0bf] focus:bg-[#f2f4f7] focus:ring-1 focus:ring-[#22ab59]"
                inputMode="numeric"
                maxLength={6}
                name="otp"
                placeholder="000000"
                required
              />
            </label>

            {verifyState.error ? (
              <p className="border border-[#fce3e5] bg-[#fff6f6] px-4 py-3 text-sm text-[#e63e46]">
                {verifyState.error}
              </p>
            ) : null}

            <button
              className="h-[46px] w-full bg-[#22ab59] text-sm font-black uppercase text-white hover:bg-[#005924] disabled:opacity-60"
              disabled={verifyPending}
              type="submit"
            >
              {verifyPending ? "Đang xác nhận..." : "Đăng nhập"}
            </button>
          </form>

          {sendState.error ? (
            <p className="border border-[#fce3e5] bg-[#fff6f6] px-4 py-3 text-sm text-[#e63e46]">
              {sendState.error}
            </p>
          ) : null}

          <form action={sendAction} className="flex items-center justify-between gap-4">
            <input name="email" type="hidden" value={activeEmail} />
            <input name="redirectTo" type="hidden" value={activeRedirectTo} />
            <input name="rememberMe" type="hidden" value={rememberMe ? "true" : "false"} />
            <button
              className="text-sm text-[#22ab59] underline disabled:cursor-not-allowed disabled:text-[#a8b0bf]"
              disabled={!canResendOtp}
              type="submit"
            >
              {sendPending
                ? "Đang gửi lại mã OTP..."
                : remainingResendSeconds > 0
                  ? `Gửi lại OTP sau ${remainingResendSeconds} giây`
                  : "Gửi lại OTP"}
            </button>
            <button
              className="text-sm text-[#22ab59] underline"
              onClick={() => window.location.reload()}
              type="button"
            >
              Đổi email
            </button>
          </form>
        </div>
      )}

      <p className="mt-5 text-center text-sm text-black">
        Chưa có tài khoản TaskBee?{" "}
        <Link className="text-[#22ab59] underline" href="/register">
          Tạo tài khoản
        </Link>
      </p>
    </div>
  );
}
