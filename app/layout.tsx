import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AppNavbar } from "@/components/layout/app-navbar";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "TaskBee",
  description: "TaskBee - sàn nhiệm vụ nhỏ cho Việt Nam",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="vi"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <AppNavbar />
        {children}
      </body>
    </html>
  );
}
