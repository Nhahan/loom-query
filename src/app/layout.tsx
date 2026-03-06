import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/layout/Sidebar";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { ErrorBoundary } from "@/components/feedback/ErrorBoundary";
import { ToastProvider } from "@/components/feedback/ToastProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "LoomQuery",
  description: "LoomQuery - AI-powered document query platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ErrorBoundary>
          <ToastProvider>
            <div className="flex h-screen overflow-hidden">
              <Sidebar />
              <div className="flex flex-1 flex-col overflow-hidden">
                <header className="flex h-14 items-center border-b border-border px-6">
                  <Breadcrumb />
                </header>
                <main className="flex-1 overflow-auto p-6">{children}</main>
              </div>
            </div>
          </ToastProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
