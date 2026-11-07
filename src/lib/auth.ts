import { isEnvAdmin } from "@/lib/admin";
import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";

/**
 * Detect whether we're serving over HTTPS.
 * - Production (Render, custom domain): NEXTAUTH_URL starts with https://
 * - Local dev: NEXTAUTH_URL is http://localhost:3000
 *
 * `sameSite: "none"` cookies MUST be `secure: true` (browser requirement),
 * so we only enable them when serving over HTTPS.
 */
const useSecureCookies =
  (process.env.NEXTAUTH_URL ?? "").startsWith("https://");

// Cookie prefixes per RFC 6265bis.
// `__Secure-` requires: secure=true
// `__Host-`   requires: secure=true, path="/", NO domain attribute
const cookiePrefix = useSecureCookies ? "__Secure-" : "";
const hostPrefix = useSecureCookies ? "__Host-" : "";

// Browsers require `sameSite: "none"` for iframe cross-origin cookies.
// Falls back to `lax` on HTTP so local dev login still works.
const sameSitePolicy: "none" | "lax" = useSecureCookies ? "none" : "lax";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as any,

  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60, // absolute max: 24h
    updateAge: 60 * 60, // refresh token every hour when active
  },

  pages: { signIn: "/login" },

  providers: [
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            allowDangerousEmailAccountLinking: true,
          }),
        ]
      : []),
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email.toLowerCase() },
        });
        if (!user?.passwordHash) return null;

        const ok = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!ok) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
        } as any;
      },
    }),
  ],

  /**
   * ⚠️ CROSS-ORIGIN COOKIE CONFIG
   *
   * Without this block, embedding the app in an iframe on a different domain
   * (e.g. bizgrowthbot.blogspot.com → growthbot-aprv.onrender.com) will cause
   * login to silently fail because browsers block third-party cookies by
   * default.
   *
   * Setting `sameSite: "none"` + `secure: true` tells the browser it's allowed
   * to send these cookies in an iframe context. This is required for the
   * blog widget's login flow to work.
   */
  cookies: {
    sessionToken: {
      name: `${cookiePrefix}next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: sameSitePolicy,
        path: "/",
        secure: useSecureCookies,
      },
    },
    callbackUrl: {
      name: `${cookiePrefix}next-auth.callback-url`,
      options: {
        sameSite: sameSitePolicy,
        path: "/",
        secure: useSecureCookies,
        // src/lib/auth.ts — inside callbacks:

async jwt({ token, user }: any) {
  if (user) {
    token.id = user.id;
    token.role = (user as any).role ?? "user";
    token.plan = (user as any).plan ?? "free";
    token.email = user.email;
  }
  // Env-admin promotion — runs on every JWT refresh
  if (token.email && isEnvAdmin(token.email as string)) {
    token.role = "admin";
  }
  return token;
},

async session({ session, token }: any) {
  if (session.user) {
    (session.user as any).id = token.id;
    (session.user as any).role = token.role;
    (session.user as any).plan = token.plan;
    (session.user as any).isAdmin = token.role === "admin";
  }
  return session;
},
      },
    },
    csrfToken: {
      name: `${hostPrefix}next-auth.csrf-token`,
      options: {
        httpOnly: true,
        sameSite: sameSitePolicy,
        path: "/",
        secure: useSecureCookies,
      },
    },
    pkceCodeVerifier: {
      name: `${cookiePrefix}next-auth.pkce.code_verifier`,
      options: {
        httpOnly: true,
        sameSite: sameSitePolicy,
        path: "/",
        secure: useSecureCookies,
        maxAge: 60 * 15, // 15 min
      },
    },
    state: {
      name: `${cookiePrefix}next-auth.state`,
      options: {
        httpOnly: true,
        sameSite: sameSitePolicy,
        path: "/",
        secure: useSecureCookies,
        maxAge: 60 * 15, // 15 min
      },
    },
    nonce: {
      name: `${cookiePrefix}next-auth.nonce`,
      options: {
        httpOnly: true,
        sameSite: sameSitePolicy,
        path: "/",
        secure: useSecureCookies,
      },
    },
  },

  callbacks: {
    async jwt({ token, user }) {
      if (user) token.uid = (user as any).id;

      if (token.uid) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.uid as string },
          select: { role: true, plan: true, email: true },
        });

        // Admin source 1: ADMIN_EMAILS env var (wins)
        // Admin source 2: User.role === "admin" in DB
        const email = dbUser?.email ?? (token.email as string) ?? null;
        const envAdmin = isEnvAdmin(email);

        token.role = envAdmin ? "admin" : dbUser?.role ?? "user";
        token.plan = dbUser?.plan ?? "free";
      }
      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.uid;
        (session.user as any).role = token.role;
        (session.user as any).plan = token.plan;
      }
      return session;
    },
  },
};