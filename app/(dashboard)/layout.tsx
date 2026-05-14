import { AppNavbar } from "@/components/layout/app-navbar";
import { requireVerifiedUser } from "@/lib/auth/session";

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await requireVerifiedUser();

  return (
    <>
      <AppNavbar />
      <main className="flex-1 bg-slate-50">
        <section className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">{children}</section>
      </main>
    </>
  );
}
