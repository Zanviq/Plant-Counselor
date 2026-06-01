import "./globals.css";
import type { Metadata } from "next";
import Script from "next/script";
import Providers from "./providers";

export const metadata: Metadata = {
  title: "Plant Counselor",
  description: "AI 정원사가 고민과 일정을 식물로 가꾸어 함께 돌봐드립니다.",
};

// Theme-init script — applies the persisted theme before hydration to prevent
// a flash of the wrong theme. Uses next/script with `beforeInteractive` (the
// App Router way to inline a pre-hydration script); it is injected into <head>
// regardless of placement, so it must NOT be rendered as a raw <script> tag.
const themeInitScript = `(function(){try{var r=localStorage.getItem("pc-theme");var s=r?JSON.parse(r).state:null;var m=(s&&s.mode)||"system";var v=m==="system"?(window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"):m;var d=document.documentElement;d.setAttribute("data-theme",v);d.removeAttribute("data-accent");}catch{}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body>
        <Script
          id="pc-theme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: themeInitScript }}
        />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
