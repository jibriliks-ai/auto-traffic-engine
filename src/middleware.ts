import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

const INDEXNOW_KEY = process.env.INDEXNOW_KEY ?? "";

export default withAuth(
  function middleware(req) {
    // Serve /{INDEXNOW_KEY}.txt directly from middleware (no DB needed)
    const { pathname } = req.nextUrl;
    if (INDEXNOW_KEY && pathname === `/${INDEXNOW_KEY}.txt`) {
      return new NextResponse(INDEXNOW_KEY, {
        headers: { "Content-Type": "text/plain" },
      });
    }
    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const { pathname } = req.nextUrl;
        // Public routes
        if (
          pathname === "/" ||
          pathname.startsWith("/login") ||
          pathname.startsWith("/register") ||
          pathname.startsWith("/api/auth") ||
          pathname.startsWith("/api/billing/paystack/webhook") ||
          pathname.startsWith("/r/") ||
          pathname.startsWith("/qa/") ||
          pathname === `/${INDEXNOW_KEY}.txt`
        ) return true;
        return !!token;
      },
    },
    pages: { signIn: "/login" },
  }
);

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};