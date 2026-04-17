import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

export default NextAuth(authConfig).auth;

export const config = {
  // https://nextjs.org/docs/app/building-your-application/routing/middleware#matcher
  // /api/v1/* uses Personal Access Token auth enforced inside each route handler,
  // so we skip NextAuth middleware for that path.
  matcher: [
    "/dashboard",
    "/dashboard/:path*",
    "/api/((?!auth|v1).*)",
  ],
};
