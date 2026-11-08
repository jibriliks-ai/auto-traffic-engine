import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { isEnvAdmin } from "@/lib/admin";

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },

  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email.toLowerCase().trim() },
        });

        // User must exist and have a password (OAuth-only users have null passwordHash)
        if (!user || !user.passwordHash) return null;

        const valid = await compare(credentials.password, user.passwordHash);
        if (!valid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role ?? "user",
          plan: user.plan ?? "free",
        } as any;
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user, trigger }) {
      // Fresh login — seed from user object
      if (user) {
        token.id = (user as any).id;
        token.role = (user as any).role ?? "user";
        token.plan = (user as any).plan ?? "free";
        token.email = user.email;
      }

      // ─── ADMIN PROMOTION (runs on every JWT refresh) ───
      // Env-admin OR DB role=admin → force role='admin' AND plan='premium'.
      // plan='premium' unlocks every "premium only" gate in the app.
      if (token.email) {
        const emailIsAdmin = isEnvAdmin(token.email as string);
        const dbRoleIsAdmin = token.role === "admin";
        if (emailIsAdmin || dbRoleIsAdmin) {
          token.role = "admin";
          token.plan = "premium";
        }
      }

      // Re-fetch from DB on explicit session update
      if (trigger === "update" && token.id) {
        const fresh = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { role: true, plan: true, email: true },
        });
        if (fresh) {
          const emailIsAdmin = isEnvAdmin(fresh.email);
          const dbRoleIsAdmin = fresh.role === "admin";
          token.role = emailIsAdmin || dbRoleIsAdmin ? "admin" : fresh.role;
          token.plan = emailIsAdmin || dbRoleIsAdmin ? "premium" : fresh.plan;
        }
      }

      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id;
        (session.user as any).role = token.role;
        (session.user as any).plan = token.plan;
        (session.user as any).isAdmin = token.role === "admin";
      }
      return session;
    },
  },

  pages: { signIn: "/login" },
  secret: process.env.NEXTAUTH_SECRET,
};