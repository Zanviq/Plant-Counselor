import "./globals.css";
import type { Metadata } from "next";
import Providers from "./providers";

export const metadata: Metadata = {
  title: "Plant Counselor",
  description: "AI 정원사가 고민과 일정을 식물로 가꾸어 함께 돌봐드립니다.",
};

// Theme-init script inlined to avoid Next.js 16 Script component warning.
// Runs synchronously before React hydration to prevent theme flicker.
const themeInitScript = `(function(){try{var r=localStorage.getItem("pc-theme");var s=r?JSON.parse(r).state:null;var m=(s&&s.mode)||"system";var a=(s&&s.accent)||"emerald";var v=m==="system"?(window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"):m;var d=document.documentElement;d.setAttribute("data-theme",v);if(a!=="emerald")d.setAttribute("data-accent",a);}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
