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
 * This app uses @supabase/supabase-js which stores sessions in localStorage,
 * not in HTTP cookies, so server-side session checks are not possible here.
 * A pass-through proxy lets all requests reach the correct page/layout.
 */
export function proxy(_request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico).*)"],
};
