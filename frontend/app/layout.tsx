import "./globals.css";
import type { Metadata } from "next";
import Script from "next/script";
import Providers from "./providers";

export const metadata: Metadata = {
  title: "Plant Counselor",
  description: "AI 정원사가 고민과 일정을 식물로 가꾸어 함께 돌봐드립니다.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        {/* Pre-hydration: paint correct theme before React mounts to avoid flicker. */}
        <Script src="/theme-init.js" strategy="beforeInteractive" />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
