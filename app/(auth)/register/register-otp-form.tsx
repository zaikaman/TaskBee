"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import {
  confirmRegistrationOtp,
  requestRegistrationOtp,
  type RegisterState,
} from "@/lib/services/auth";

const initialState: RegisterState = {
  phase: "form",
};

function Field({
  label,
  name,
  placeholder,
  type = "text",
}: {
  label: string;
  name: string;
  placeholder: string;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold text-[#a8b0bf]">{label}</span>
      <input
        name={name}
        type={type}
        placeholder={placeholder}
        className="h-[42px] w-full rounded-none border-0 bg-[#f5f7fa] px-4 text-sm text-[#203259] outline-none placeholder:text-[#3b506d] focus:bg-[#f2f4f7] focus:ring-1 focus:ring-[#22ab59]"
      />
    </label>
  );
}

function RoleOption({
  checked,
  description,
  label,
  value,
}: {
  checked: boolean;
  description: string;
  label: string;
  value: "EMPLOYER" | "WORKER";
}) {
  return (
    <label className="block cursor-pointer">
      <span className="flex items-center gap-1.5 text-sm text-[#1b1b1b]">
        <input
          defaultChecked={checked}
          className="size-3.5 accent-[#22ab59]"
          name="role"
          type="radio"
          value={value}
        />
        {label}
      </span>
      <span className="ml-5 mt-1 block text-sm italic text-[#22ab59]">{description}</span>
    </label>
  );
}

export function RegisterOtpForm() {
  const [sendState, sendAction, sendPending] = useActionState(requestRegistrationOtp, initialState);
  const [verifyState, verifyAction, verifyPending] = useActionState(
    confirmRegistrationOtp,
    initialState,
  );

  const profile = useMemo(
    () =>
      sendState.profile ?? {
        firstName: "",
        lastName: "",
        nickname: "",
        role: "WORKER" as const,
      },
    [sendState.profile],
  );

  const activeEmail = sendState.email ?? verifyState.email ?? "";
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

    const initialTimerId = window.setTimeout(() => {
      setCurrentTime(Date.now());
    }, 0);
    const intervalId = window.setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);

    return () => {
      window.clearTimeout(initialTimerId);
      window.clearInterval(intervalId);
    };
  }, [resendAvailableAt]);

  return (
    <div className="w-full">
      <h1 className="text-[30px] font-semibold leading-none text-[#203259]">Đăng ký</h1>

      {!isOtpStep ? (
        <form action={sendAction} className="mt-9 space-y-7">
          <div>
            <p className="max-w-[360px] text-base leading-6 text-black">
              Chọn loại hồ sơ mong muốn ngay bây giờ, bạn có thể chuyển đổi sau.
            </p>
            <div className="mt-5 grid grid-cols-2 gap-8">
              <RoleOption
                checked
                description="Tôi muốn kiếm tiền"
                label="Tôi là người làm thuê"
                value="WORKER"
              />
              <RoleOption
                checked={false}
                description="Tôi muốn thuê người"
                label="Tôi là người thuê"
                value="EMPLOYER"
              />
            </div>
          </div>

          <div>
            <p className="mb-5 text-base text-black">Tên thật chỉ dùng để xác minh nội bộ.</p>
            <div className="grid grid-cols-2 gap-x-5 gap-y-7">
              <Field label="Tên" name="firstName" placeholder="Nhập nội dung" />
              <Field label="Họ" name="lastName" placeholder="Nhập nội dung" />
              <Field label="Biệt danh" name="nickname" placeholder="Nhập nội dung" />
              <Field label="Email" name="email" placeholder="Nhập nội dung" type="email" />
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <label className="flex items-start gap-2 text-sm font-bold text-[#596274]">
              <input
                defaultChecked
                className="mt-0.5 size-4 accent-[#22ab59]"
                name="agreeTerms"
                type="checkbox"
                value="true"
              />
              <span>Tôi đồng ý với Điều khoản dịch vụ và Chính sách bảo mật của TaskBee.</span>
            </label>
            <label className="flex items-start gap-2 text-sm font-bold text-[#596274]">
              <input className="mt-0.5 size-4 accent-[#22ab59]" name="sendUpdates" type="checkbox" />
              <span>Gửi cho tôi tin tức, sự kiện và ưu đãi qua email định kỳ.</span>
            </label>
          </div>

          {sendState.error ? (
            <p className="border border-[#fce3e5] bg-[#fff6f6] px-4 py-3 text-sm text-[#e63e46]">
              {sendState.error}
            </p>
          ) : null}

          <button
            className="h-[46px] w-full bg-[#22ab59] text-sm font-black uppercase text-white hover:bg-[#005924] disabled:opacity-60"
            disabled={sendPending}
            type="submit"
          >
            {sendPending ? "Đang gửi..." : "Gửi mã OTP"}
          </button>
        </form>
      ) : (
        <div className="mt-9 space-y-7">
          <div>
            <p className="max-w-[390px] text-base leading-6 text-black">
              Mã OTP đã được gửi tới <span className="font-bold text-[#203259]">{activeEmail}</span>.
              Nhập mã để xác nhận email và tạo tài khoản.
            </p>
          </div>

          <form action={verifyAction} className="space-y-7">
            <input name="email" type="hidden" value={activeEmail} />
            <input name="role" type="hidden" value={profile.role} />
            <input name="firstName" type="hidden" value={profile.firstName} />
            <input name="lastName" type="hidden" value={profile.lastName} />
            <input name="nickname" type="hidden" value={profile.nickname} />

            <label className="block">
              <span className="mb-2 block text-sm font-bold text-[#a8b0bf]">Mã OTP</span>
              <input
                autoComplete="one-time-code"
                inputMode="numeric"
                maxLength={6}
                name="otp"
                placeholder="Nhập 6 số"
                className="h-[48px] w-full rounded-none border-0 bg-[#f5f7fa] px-4 text-center text-2xl tracking-[0.32em] text-[#203259] outline-none placeholder:text-[#a8b0bf] focus:bg-[#f2f4f7] focus:ring-1 focus:ring-[#22ab59]"
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
              {verifyPending ? "Đang xác nhận..." : "Xác nhận email"}
            </button>
          </form>

          {sendState.error ? (
            <p className="border border-[#fce3e5] bg-[#fff6f6] px-4 py-3 text-sm text-[#e63e46]">
              {sendState.error}
            </p>
          ) : null}

          <form action={sendAction}>
            <input name="firstName" type="hidden" value={profile.firstName} />
            <input name="lastName" type="hidden" value={profile.lastName} />
            <input name="nickname" type="hidden" value={profile.nickname} />
            <input name="email" type="hidden" value={activeEmail} />
            <input name="role" type="hidden" value={profile.role} />
            <input name="agreeTerms" type="hidden" value="true" />
            <input name="sendUpdates" type="hidden" value="false" />
            <button
              className="text-sm text-[#22ab59] underline disabled:cursor-not-allowed disabled:text-[#a8b0bf]"
              disabled={!canResendOtp}
              type="submit"
            >
              {sendPending
                ? "Đang gửi lại mã OTP..."
                : remainingResendSeconds > 0
                  ? `Gửi lại mã OTP sau ${remainingResendSeconds} giây`
                  : "Gửi lại mã OTP"}
            </button>
          </form>
        </div>
      )}

      <p className="mt-5 text-center text-sm text-black">
        Đã có tài khoản?{" "}
        <a href="/login" className="text-[#22ab59] underline">
          Đăng nhập ngay
        </a>
        .
      </p>
    </div>
  );
}
