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
      if (user) {
        token.id = (user as any).id;
        token.role = (user as any).role ?? "user";
        token.plan = (user as any).plan ?? "free";
        token.email = user.email;
      }

      if (token.email) {
        const emailIsAdmin = isEnvAdmin(token.email as string);
        const dbRoleIsAdmin = token.role === "admin";
        if (emailIsAdmin || dbRoleIsAdmin) {
          token.role = "admin";
          token.plan = "premium";
        }
      }

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
      if (!session.user) return session;

      let userId = token.id as string | undefined;
      let role = token.role as string | undefined;
      let plan = token.plan as string | undefined;

      // ── HEAL STALE JWTs ──
      // If the JWT was minted before token.id existed, userId is undefined.
      // Look up the user by email so downstream routes always get a valid id.
      if (!userId && session.user.email) {
        try {
          const dbUser = await prisma.user.findUnique({
            where: { email: session.user.email },
            select: { id: true, role: true, plan: true, email: true },
          });
          if (dbUser) {
            userId = dbUser.id;
            const emailIsAdmin = isEnvAdmin(dbUser.email);
            const dbRoleIsAdmin = dbUser.role === "admin";
            role = emailIsAdmin || dbRoleIsAdmin ? "admin" : dbUser.role;
            plan = emailIsAdmin || dbRoleIsAdmin ? "premium" : dbUser.plan;
          }
        } catch {
          /* DB hiccup — leave id undefined and let route guards return 401 */
        }
      }

      (session.user as any).id = userId;
      (session.user as any).role = role;
      (session.user as any).plan = plan;
      (session.user as any).isAdmin = role === "admin";
      return session;
    },
  },

  pages: { signIn: "/login" },
  secret: process.env.NEXTAUTH_SECRET,
};