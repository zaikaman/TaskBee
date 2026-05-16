import { Landmark } from "lucide-react";
import { SUPPORTED_BANKS } from "@/config/app";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export type BankTransferFormValue = {
  bankCode?: string;
  accountNumber?: string;
  accountName?: string;
};

export type BankTransferFormErrors = Partial<Record<keyof BankTransferFormValue | "root", string>>;

type BankTransferFormProps = {
  action?: string | ((formData: FormData) => void | Promise<void>);
  defaultValue?: BankTransferFormValue;
  disabled?: boolean;
  errors?: BankTransferFormErrors;
  formId?: string;
  onSubmit?: React.FormEventHandler<HTMLFormElement>;
  submitLabel?: string;
  title?: string;
  description?: string;
  className?: string;
};

function FieldError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }

  return <p className="text-sm font-medium text-[#e63e46]">{message}</p>;
}

export function BankTransferForm({
  action,
  defaultValue,
  disabled = false,
  errors,
  formId,
  onSubmit,
  submitLabel = "Lưu thông tin ngân hàng",
  title = "Thông tin chuyển khoản ngân hàng",
  description = "Nhập đúng thông tin tài khoản chính chủ để hệ thống xử lý rút tiền an toàn.",
  className,
}: BankTransferFormProps) {
  return (
    <form
      action={action}
      className={cn("space-y-5 bg-white text-[#001b49]", className)}
      id={formId}
      onSubmit={onSubmit}
    >
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#001b49] text-white">
          <Landmark className="size-5" aria-hidden="true" />
        </span>
        <div>
          <h2 className="text-base font-bold">{title}</h2>
          <p className="mt-1 text-sm leading-6 text-[#686d77]">{description}</p>
        </div>
      </div>

      {errors?.root ? (
        <div className="bg-[#fce3e5] px-4 py-3 text-sm font-medium text-[#8a1218]">
          {errors.root}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="bankCode">Ngân hàng</Label>
          <select
            className="h-10 w-full border border-[#d3dae6] bg-white px-3 text-sm outline-none transition-colors focus:border-[#22ab59] focus:ring-2 focus:ring-[#22ab59]/20 disabled:cursor-not-allowed disabled:bg-[#f5f7fa] disabled:text-[#686d77]"
            defaultValue={defaultValue?.bankCode ?? ""}
            disabled={disabled}
            id="bankCode"
            name="bankCode"
            required
          >
            <option value="">Chọn ngân hàng</option>
            {SUPPORTED_BANKS.map((bank) => (
              <option key={bank.code} value={bank.code}>
                {bank.name}
              </option>
            ))}
          </select>
          <FieldError message={errors?.bankCode} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="accountNumber">Số tài khoản</Label>
          <Input
            autoComplete="off"
            className="h-10 rounded-none border-[#d3dae6] bg-white focus-visible:border-[#22ab59] focus-visible:ring-[#22ab59]/20"
            defaultValue={defaultValue?.accountNumber ?? ""}
            disabled={disabled}
            id="accountNumber"
            inputMode="numeric"
            name="accountNumber"
            placeholder="Ví dụ: 0123456789"
            required
          />
          <FieldError message={errors?.accountNumber} />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="accountName">Tên chủ tài khoản</Label>
        <Input
          autoComplete="name"
          className="h-10 rounded-none border-[#d3dae6] bg-white uppercase focus-visible:border-[#22ab59] focus-visible:ring-[#22ab59]/20"
          defaultValue={defaultValue?.accountName ?? ""}
          disabled={disabled}
          id="accountName"
          name="accountName"
          placeholder="NGUYEN VAN A"
          required
        />
        <FieldError message={errors?.accountName} />
      </div>

      <Button
        className="h-11 w-full rounded-none bg-[#22ab59] text-sm font-bold uppercase text-white hover:bg-[#005924]"
        disabled={disabled}
        type="submit"
      >
        {submitLabel}
      </Button>
    </form>
  );
}
