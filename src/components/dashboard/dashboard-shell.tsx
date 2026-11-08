"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import {
  LayoutDashboard, Building2, Search, MessageSquare, Link2,
  Megaphone, Share2, Video, CreditCard, HelpCircle, Shield,
  Menu, X, LogOut, ChevronDown, Sparkles, Loader2, Zap, DollarSign,
} from "lucide-react";
import InstallPWAButton from "@/components/install-pwa-button";

type Business = { id: string; name: string };

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/businesses", label: "Businesses", icon: Building2 },
  { href: "/seo-audit", label: "SEO Audit", icon: Search },
  { href: "/qa-finder", label: "Q&A Finder", icon: MessageSquare },
  { href: "/indexer", label: "Website Indexer", icon: Link2 },
  { href: "/classifieds", label: "Classifieds", icon: Megaphone },
  { href: "/social", label: "Social Poster", icon: Share2 },
  { href: "/money-engine", label: "Auto Money Engine", icon: DollarSign },
  { href: "/video", label: "Video", icon: Video },
  { href: "/billing", label: "Billing", icon: CreditCard },
  { href: "/help", label: "Help Center", icon: HelpCircle },
];

export default function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const isAdmin =
    (session?.user as any)?.role === "admin" ||
    (session?.user as any)?.isAdmin === true;

  // Load businesses + active business
  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/businesses")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.businesses) setBusinesses(d.businesses);
        if (d?.activeBusinessId) setActiveId(d.activeBusinessId);
        else if (d?.businesses?.[0]?.id) setActiveId(d.businesses[0].id);
      })
      .catch(() => {});
  }, [status]);

  // Close mobile sidebar on route change
  useEffect(() => {
    setSidebarOpen(false);
    setUserMenuOpen(false);
  }, [pathname]);

  async function switchBusiness(id: string) {
    setActiveId(id);
    try {
      await fetch("/api/businesses/active", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId: id }),
      });
      window.location.reload();
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 border-r border-border/60 bg-card transition-transform duration-200 lg:static lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-16 items-center gap-2 border-b border-border/60 px-5">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground">
            <Zap className="h-4 w-4" />
          </div>
          <span className="text-base font-semibold tracking-tight">Auto Traffic</span>
          <button
            onClick={() => setSidebarOpen(false)}
            className="ml-auto grid h-8 w-8 place-items-center rounded-lg hover:bg-muted lg:hidden"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex flex-col gap-1 overflow-y-auto p-3" style={{ maxHeight: "calc(100vh - 4rem)" }}>
          {NAV.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}

          {isAdmin && (
            <Link
              href="/admin"
              className={`mt-2 flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm font-semibold text-primary hover:bg-primary/10 ${
                pathname.startsWith("/admin") ? "ring-1 ring-primary/40" : ""
              }`}
            >
              <Shield className="h-4 w-4" /> Admin Panel
            </Link>
          )}
        </nav>
      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
        />
      )}

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Topbar */}
        <header className="sticky top-0 z-20 border-b border-border/60 bg-card/95 backdrop-blur">
          <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
            <button
              onClick={() => setSidebarOpen(true)}
              className="grid h-9 w-9 place-items-center rounded-lg hover:bg-muted lg:hidden"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>

            {/* Business selector */}
            <div className="min-w-0">
              <select
                value={activeId ?? ""}
                onChange={(e) => switchBusiness(e.target.value)}
                disabled={businesses.length === 0}
                className="h-9 max-w-[220px] rounded-lg border border-border bg-background px-3 text-sm font-medium focus:border-primary focus:outline-none disabled:opacity-60"
              >
                {businesses.length === 0 && <option>No business yet</option>}
                {businesses.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex-1" />

            {/* Plan / admin badge */}
            {isAdmin ? (
              <span className="hidden items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary sm:inline-flex">
                <Shield className="h-3 w-3" /> Admin
              </span>
            ) : (
              session &&
              (session.user as any)?.plan !== "premium" && (
                <Link
                  href="/billing"
                  className="hidden items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20 sm:inline-flex"
                >
                  <Sparkles className="h-3 w-3" /> Upgrade — $35/mo
                </Link>
              )
            )}

            {/* User menu */}
            <div className="relative">
              <button
                onClick={() => setUserMenuOpen((v) => !v)}
                className="flex items-center gap-2 rounded-lg p-1.5 text-sm hover:bg-muted"
                aria-label="User menu"
              >
                <div className="grid h-8 w-8 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                  {session?.user?.email?.charAt(0).toUpperCase() ?? "?"}
                </div>
                <ChevronDown className="h-3 w-3 text-muted-foreground" />
              </button>

              {userMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setUserMenuOpen(false)}
                  />
                  <div className="absolute right-0 top-full z-20 mt-1 w-56 overflow-hidden rounded-xl border border-border bg-card shadow-lg">
                    <div className="border-b border-border/60 p-3">
                      <div className="truncate text-sm font-medium">
                        {session?.user?.email}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {isAdmin
                          ? "Admin (unlimited)"
                          : (session?.user as any)?.plan === "premium"
                          ? "Premium"
                          : "Free plan"}
                      </div>
                    </div>
                    <Link href="/help" className="block px-3 py-2 text-sm hover:bg-muted">
                      Help Center
                    </Link>
                    <Link href="/billing" className="block px-3 py-2 text-sm hover:bg-muted">
                      Billing
                    </Link>
                    <button
                      onClick={() => signOut({ callbackUrl: "/" })}
                      className="flex w-full items-center gap-2 border-t border-border/60 px-3 py-2 text-sm text-rose-600 hover:bg-rose-500/5"
                    >
                      <LogOut className="h-3.5 w-3.5" /> Sign out
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 p-4 sm:p-6">
          {status === "loading" ? (
            <div className="grid place-items-center py-20">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            children
          )}
        </main>
      </div>

      <InstallPWAButton />
    </div>
  );
}