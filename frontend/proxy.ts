import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 정적 자산 제외
  if (
    pathname.startsWith("/_next") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  const isAuthRoute = pathname === "/login" || pathname === "/signup";
  const hasRefresh = request.cookies.has("refresh_token");

  // 인증 필요 페이지에 쿠키 없으면 로그인으로
  if (!isAuthRoute && !hasRefresh) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // 이미 로그인 상태에서 로그인 페이지 접근 시 홈으로
  if (isAuthRoute && hasRefresh) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico).*)"],
};
