"use client";

import { useActionState, useCallback, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { Camera, ImagePlus, Save, Trash2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { updateProfile, type UpdateProfileState } from "@/lib/services/user";

const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const ACCEPTED_EXTENSIONS = ".jpg,.jpeg,.png,.webp";

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

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

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
  const serverAvatarUrl = state.fields?.avatarUrl ?? avatarUrl ?? "";
  const avatarInitial = currentUsername.trim().slice(0, 1).toUpperCase() || "T";

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [removeAvatar, setRemoveAvatar] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const displayAvatarUrl = removeAvatar ? null : (previewUrl ?? (serverAvatarUrl || null));

  const validateAndSetFile = useCallback((file: File) => {
    setFileError(null);

    if (!ACCEPTED_TYPES.includes(file.type)) {
      setFileError("Chỉ hỗ trợ ảnh định dạng JPG, PNG hoặc WebP.");
      return;
    }

    if (file.size > AVATAR_MAX_BYTES) {
      setFileError(`Ảnh không được vượt quá 2 MB. Ảnh bạn chọn: ${formatFileSize(file.size)}.`);
      return;
    }

    if (file.size < 1) {
      setFileError("Tệp ảnh trống, vui lòng chọn ảnh khác.");
      return;
    }

    const objectUrl = URL.createObjectURL(file);

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    setSelectedFile(file);
    setPreviewUrl(objectUrl);
    setRemoveAvatar(false);
  }, [previewUrl]);

  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      validateAndSetFile(file);
    }
    // Reset the input so the same file can be re-selected
    event.target.value = "";
  }, [validateAndSetFile]);

  const handleDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setDragActive(false);

    const file = event.dataTransfer.files?.[0];
    if (file) {
      validateAndSetFile(file);
    }
  }, [validateAndSetFile]);

  const handleDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setDragActive(true);
  }, []);

  const handleDragLeave = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setDragActive(false);
  }, []);

  const handleRemoveFile = useCallback(() => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setSelectedFile(null);
    setPreviewUrl(null);
    setFileError(null);
  }, [previewUrl]);

  const handleRemoveAvatar = useCallback(() => {
    handleRemoveFile();
    setRemoveAvatar(true);
  }, [handleRemoveFile]);

  const handleBrowseClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  return (
    <section className="space-y-6">
      {/* Avatar Section */}
      <div className="bg-white p-6 shadow-sm ring-1 ring-slate-100">
        <div className="flex items-center gap-2 text-slate-500 mb-6">
          <Camera className="size-4" aria-hidden="true" />
          <span className="text-sm font-semibold">Ảnh đại diện</span>
        </div>

        <div className="flex flex-col lg:flex-row gap-8 items-start">
          {/* Avatar Preview - Left Side */}
          <div className="flex-shrink-0">
            <div
              className="group relative flex h-[140px] w-[140px] items-center justify-center overflow-hidden border border-slate-300 bg-slate-50"
              style={{ borderRadius: 0 }}
            >
              {displayAvatarUrl ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={displayAvatarUrl}
                    alt={currentUsername}
                    className="h-full w-full object-cover"
                  />
                  {canEdit && (
                    <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                      <button
                        type="button"
                        onClick={handleBrowseClick}
                        className="flex h-9 w-9 items-center justify-center bg-white/90 text-slate-700 transition-colors hover:bg-white"
                        title="Đổi ảnh đại diện"
                      >
                        <Camera className="size-4" />
                      </button>
                      <button
                        type="button"
                        onClick={handleRemoveAvatar}
                        className="flex h-9 w-9 items-center justify-center bg-red-500/90 text-white transition-colors hover:bg-red-600"
                        title="Xóa ảnh đại diện"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <span className="text-6xl font-semibold text-slate-300 select-none">
                  {avatarInitial}
                </span>
              )}
            </div>
          </div>

          {/* Upload Controls - Right Side */}
          <div className="flex-1 w-full">
            {canEdit ? (
              <>
                {/* Drag-Drop Zone */}
                <div
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  className={`
                    relative flex min-h-[140px] cursor-pointer flex-col items-center justify-center gap-3 border-2 border-dashed px-6 py-8 transition-all
                    ${dragActive
                      ? "border-slate-400 bg-slate-50"
                      : "border-slate-300 bg-white hover:border-slate-400 hover:bg-slate-50"
                    }
                  `}
                >
                  <div className="flex h-12 w-12 items-center justify-center bg-slate-100 text-slate-400">
                    <ImagePlus className="size-6" />
                  </div>
                  
                  <div className="text-center">
                    <p className="text-sm text-slate-500">
                      Kéo và thả ảnh vào đây hoặc
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      hoặc
                    </p>
                  </div>

                  <Button
                    type="button"
                    onClick={handleBrowseClick}
                    className="mt-2 h-10 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                  >
                    <Camera className="size-4" />
                    Chọn tệp
                  </Button>

                  <p className="mt-2 text-xs text-slate-400">
                    JPG, PNG hoặc WebP · Tối đa 2 MB
                  </p>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ACCEPTED_EXTENSIONS}
                  onChange={handleFileChange}
                  className="hidden"
                  aria-label="Chọn ảnh đại diện"
                />

                {/* Selected File Preview Bar */}
                {selectedFile && (
                  <div className="mt-4 flex items-center gap-3 border border-emerald-100 bg-emerald-50 px-4 py-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center bg-emerald-100 text-emerald-600">
                      <ImagePlus className="size-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-700">{selectedFile.name}</p>
                      <p className="text-xs text-slate-500">{formatFileSize(selectedFile.size)} · Sẵn sàng tải lên</p>
                    </div>
                    <button
                      type="button"
                      onClick={handleRemoveFile}
                      className="flex h-7 w-7 shrink-0 items-center justify-center text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500"
                      title="Xóa ảnh đã chọn"
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                )}

                {fileError && (
                  <p className="mt-4 border border-red-100 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-600">
                    {fileError}
                  </p>
                )}
              </>
            ) : (
              <div className="flex min-h-[140px] items-center justify-center border-2 border-dashed border-slate-200 bg-slate-50 px-6 py-8">
                <p className="text-sm leading-6 text-slate-500">
                  Tài khoản đang bị hạn chế nên không thể thay đổi ảnh đại diện.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Personal Info Form */}
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

            {/* Hidden fields to carry avatar state */}
            <AvatarHiddenFields
              selectedFile={selectedFile}
              removeAvatar={removeAvatar}
              currentAvatarUrl={serverAvatarUrl}
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
              Ảnh đại diện sẽ được tải lên Cloudflare R2 khi bạn lưu hồ sơ. Hỗ trợ JPG, PNG và WebP, tối đa 2 MB.
            </p>
          )}

          <SubmitButton disabled={!canEdit} hasFile={!!selectedFile} />
        </form>
      </section>
    </section>
  );
}

/**
 * Injects the selected avatar file into the form's FormData via a hidden
 * file input. Also sends `avatarUrl` so the server action can tell
 * whether the user removed their avatar vs. keeping the existing one.
 */
function AvatarHiddenFields({
  selectedFile,
  removeAvatar,
  currentAvatarUrl,
}: {
  selectedFile: File | null;
  removeAvatar: boolean;
  currentAvatarUrl: string;
}) {
  const avatarFileInputRef = useRef<HTMLInputElement>(null);

  // We use a ref callback to attach the selected File to the hidden input
  // so the browser form submission includes it in the FormData payload.
  const setFileInputFiles = useCallback(
    (input: HTMLInputElement | null) => {
      if (!input) return;

      if (selectedFile) {
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(selectedFile);
        input.files = dataTransfer.files;
      } else {
        input.files = new DataTransfer().files;
      }
    },
    [selectedFile],
  );

  const avatarUrlValue = removeAvatar ? "" : currentAvatarUrl;

  return (
    <>
      <input
        ref={(el) => {
          (avatarFileInputRef as React.MutableRefObject<HTMLInputElement | null>).current = el;
          setFileInputFiles(el);
        }}
        type="file"
        name="avatarFile"
        className="hidden"
        tabIndex={-1}
        aria-hidden="true"
      />
      <input
        type="hidden"
        name="avatarUrl"
        value={avatarUrlValue}
      />
    </>
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

function SubmitButton({ disabled, hasFile }: { disabled: boolean; hasFile: boolean }) {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      disabled={disabled || pending}
      className="h-11 w-full rounded bg-emerald-600 font-bold uppercase text-white hover:bg-emerald-700"
    >
      <Save className="size-4" aria-hidden="true" />
      {pending
        ? hasFile
          ? "Đang tải ảnh và lưu hồ sơ..."
          : "Đang lưu hồ sơ..."
        : "Lưu hồ sơ"
      }
    </Button>
  );
}
