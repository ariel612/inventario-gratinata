import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/lib/auth.config";

// Instancia liviana (sin Prisma) exclusiva para Edge Middleware.
const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const { pathname } = req.nextUrl;

  if (pathname === "/login") {
    if (isLoggedIn) return NextResponse.redirect(new URL("/", req.nextUrl));
    return NextResponse.next();
  }

  if (!isLoggedIn) {
    return NextResponse.redirect(new URL("/login", req.nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!api/auth|_next/static|_next/image|favicon.ico|manifest.json|sw.js|.*\\.png$|.*\\.svg$).*)",
  ],
};
