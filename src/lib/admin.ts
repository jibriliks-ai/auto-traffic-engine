// src/lib/admin.ts

/**
 * Returns true if the email is in the ADMIN_EMAILS env var.
 * ADMIN_EMAILS is a comma-separated list, case-insensitive.
 */
export function isEnvAdmin(email?: string | null): boolean {
  if (!email) return false;
  const raw = process.env.ADMIN_EMAILS ?? "";
  if (!raw.trim()) return false;
  const list = raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(email.toLowerCase());
}

/**
 * Returns true if a NextAuth session belongs to an admin.
 * Checks (in order):
 *   1. session.user.role === "admin"   (set from DB)
 *   2. session.user.isAdmin === true   (legacy)
 *   3. session.user.email in ADMIN_EMAILS env
 */
export function isAdminSession(session: any): boolean {
  if (!session?.user) return false;
  if (session.user.role === "admin") return true;
  if (session.user.isAdmin === true) return true;
  return isEnvAdmin(session.user.email);
}