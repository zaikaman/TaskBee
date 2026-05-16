import Link from "next/link";
import { AlertTriangle, ArrowLeft, Home, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

type RouteStateProps = {
  title: string;
  description: string;
  primaryHref?: string;
  primaryLabel?: string;
  onRetry?: () => void;
};

export function RouteState({
  title,
  description,
  primaryHref = "/",
  primaryLabel = "Về trang chủ",
  onRetry,
}: RouteStateProps) {
  return (
    <main className="mx-auto flex min-h-[60vh] w-full max-w-3xl flex-col items-center justify-center px-4 py-16 text-center">
      <div className="mb-5 flex size-12 items-center justify-center rounded-full bg-amber-50 text-amber-600">
        <AlertTriangle className="size-6" aria-hidden="true" />
      </div>
      <h1 className="text-3xl font-semibold text-zinc-950">{title}</h1>
      <p className="mt-3 max-w-xl text-sm leading-6 text-zinc-600">{description}</p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        {onRetry ? (
          <Button onClick={onRetry} className="rounded bg-emerald-600 text-white hover:bg-emerald-700">
            <RefreshCw className="size-4" />
            Thử lại
          </Button>
        ) : null}
        <Button asChild variant="outline" className="rounded">
          <Link href={primaryHref}>
            {primaryHref === "/" ? <Home className="size-4" /> : <ArrowLeft className="size-4" />}
            {primaryLabel}
          </Link>
        </Button>
      </div>
    </main>
  );
}
