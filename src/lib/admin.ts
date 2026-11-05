/**
 * Admin access control.
 *
 * Two sources of truth:
 * 1. `ADMIN_EMAILS` env var (comma-separated) — wins over DB
 * 2. `User.role === "admin"` in the database
 *
 * If a user's email is in ADMIN_EMAILS, they are admin regardless of DB role.
 * This lets you manage admins from Render's env tab without SQL.
 */

export function getEnvAdmins(): string[] {
  const raw = process.env.ADMIN_EMAILS ?? "";
  return raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isEnvAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  const admins = getEnvAdmins();
  if (admins.length === 0) return false;
  return admins.includes(email.toLowerCase());
}