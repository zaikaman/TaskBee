export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <main className="flex flex-1 items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-md rounded border border-slate-200 bg-white p-6 shadow-sm">
        {children}
      </div>
    </main>
  );
}
