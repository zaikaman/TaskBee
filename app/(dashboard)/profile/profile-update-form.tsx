"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Camera, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { updateProfile, type UpdateProfileState } from "@/lib/services/user";

type ProfileUpdateFormProps = {
  profileId: string;
  username: string;
  avatarUrl?: string | null;
  email: string;
  roleLabel: string;
  joinedDate: string;
  emailVerificationLabel: string;
  accountStatusLabel: string;
  canEdit: boolean;
};

const initialState: UpdateProfileState = {
  ok: false,
};

export function ProfileUpdateForm({
  profileId,
  username,
  avatarUrl,
  email,
  roleLabel,
  joinedDate,
  emailVerificationLabel,
  accountStatusLabel,
  canEdit,
}: ProfileUpdateFormProps) {
  const [state, formAction] = useActionState(updateProfile, initialState);
  const currentUsername = state.fields?.username ?? username;
  const currentAvatarUrl = state.fields?.avatarUrl ?? avatarUrl ?? "";
  const avatarInitial = currentUsername.trim().slice(0, 1).toUpperCase() || "T";

  return (
    <section className="space-y-6">
      <div className="bg-white p-6 shadow-sm ring-1 ring-slate-100">
        <div className="grid gap-6 lg:grid-cols-[144px_1fr] lg:items-center">
          <div className="flex justify-center">
            <div className="flex h-36 w-36 items-center justify-center overflow-hidden border border-slate-300 bg-slate-100 text-5xl font-semibold text-slate-400">
              {currentAvatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={currentAvatarUrl}
                  alt={currentUsername}
                  className="h-full w-full object-cover"
                />
              ) : (
                avatarInitial
              )}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2 text-slate-400">
              <Camera className="size-4" aria-hidden="true" />
              <span className="text-sm font-medium">Ảnh đại diện</span>
            </div>
            <p className="max-w-2xl text-sm leading-6 text-slate-600">
              Cập nhật ảnh đại diện bằng URL trực tiếp. Nút tải tệp riêng sẽ nối ở bước lưu trữ ảnh
              sau của MVP.
            </p>
          </div>
        </div>
      </div>

      <section className="bg-white p-6 shadow-sm ring-1 ring-slate-100">
        <div className="flex items-center gap-3">
          <h2 className="text-base font-semibold text-slate-950">Thông tin cá nhân</h2>
          <span className="text-sm font-semibold text-slate-400">- #{profileId.slice(0, 8)}</span>
        </div>

        <form action={formAction} className="mt-6 space-y-6">
          <div className="grid gap-5 md:grid-cols-2">
            <EditableField
              label="Tên hiển thị"
              name="username"
              defaultValue={currentUsername}
              required
              disabled={!canEdit}
              autoComplete="nickname"
            />
            <ReadonlyField label="Email" value={email} />
            <EditableField
              label="URL ảnh đại diện"
              name="avatarUrl"
              defaultValue={currentAvatarUrl}
              disabled={!canEdit}
              placeholder="https://..."
              type="url"
            />
            <ReadonlyField label="Ngày tham gia" value={joinedDate} />
            <ReadonlyField label="Vai trò" value={roleLabel} />
            <ReadonlyField label="Xác minh email" value={emailVerificationLabel} />
            <ReadonlyField label="Trạng thái tài khoản" value={accountStatusLabel} />
          </div>

          {state.error ? (
            <p className="border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
              {state.error}
            </p>
          ) : null}

          {state.message ? (
            <p className="border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
              {state.message}
            </p>
          ) : null}

          {!canEdit ? (
            <p className="text-sm leading-6 text-red-500">
              * Tài khoản đang bị hạn chế nên không thể chỉnh sửa hồ sơ.
            </p>
          ) : (
            <p className="text-sm leading-6 text-slate-500">
              Ảnh đại diện hiện hỗ trợ URL trực tiếp. Upload file sẽ được nối ở task lưu trữ ảnh riêng.
            </p>
          )}

          <SubmitButton disabled={!canEdit} />
        </form>
      </section>
    </section>
  );
}

function EditableField({
  label,
  name,
  defaultValue,
  required = false,
  disabled = false,
  placeholder,
  type = "text",
  autoComplete,
}: {
  label: string;
  name: string;
  defaultValue: string;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  type?: "text" | "url";
  autoComplete?: string;
}) {
  return (
    <label className="space-y-2">
      <span className="block text-sm font-semibold text-slate-400">
        {label}
        {required ? <span className="text-red-500"> *</span> : null}
      </span>
      <input
        name={name}
        type={type}
        defaultValue={defaultValue}
        required={required}
        disabled={disabled}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className="block min-h-11 w-full border-0 bg-slate-100 px-4 py-3 text-sm text-slate-700 outline-none ring-1 ring-transparent transition focus:bg-white focus:ring-emerald-600 disabled:cursor-not-allowed disabled:text-slate-400"
      />
    </label>
  );
}

function ReadonlyField({ label, value }: { label: string; value: string }) {
  return (
    <label className="space-y-2">
      <span className="block text-sm font-semibold text-slate-400">{label}</span>
      <span className="block min-h-11 bg-slate-100 px-4 py-3 text-sm text-slate-700">{value}</span>
    </label>
  );
}

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      disabled={disabled || pending}
      className="h-11 w-full rounded bg-emerald-600 font-bold uppercase text-white hover:bg-emerald-700"
    >
      <Save className="size-4" aria-hidden="true" />
      {pending ? "Đang lưu hồ sơ..." : "Lưu hồ sơ"}
    </Button>
  );
}
