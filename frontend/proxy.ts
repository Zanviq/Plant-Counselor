import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Next.js 16 proxy (replaces middleware).
 *
 * Auth is handled entirely client-side by:
 *   - (app)/layout.tsx  → redirects unauthenticated users to /login
 *   - app/page.tsx      → AuthRedirect redirects authenticated users to /home
 *   - (auth)/login      → redirects already-authenticated users to /home
 *
 * The session cookie is issued by the API origin (FastAPI), so this Next.js
 * server cannot validate it. Guards stay client-side (/auth/me) and the
 * backend enforces auth on every API call. A pass-through proxy lets all
 * requests reach the correct page/layout.
 */
export function proxy(_request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico).*)"],
};
