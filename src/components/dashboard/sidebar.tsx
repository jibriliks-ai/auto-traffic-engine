"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, BarChart3, MessageSquare, Megaphone,
  Globe2, Video, Share2, Shield, HelpCircle, Sparkles, Crown,
  Building2, X,
} from "lucide-react";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/businesses", label: "Businesses", icon: Building2 },
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/seo", label: "SEO Audit", icon: BarChart3 },
  { href: "/qa", label: "Q&A Finder", icon: MessageSquare },
  { href: "/classifieds", label: "Classifieds", icon: Megaphone },
  { href: "/indexer", label: "Indexer", icon: Globe2 },
  { href: "/video", label: "Video Creator", icon: Video },
  { href: "/social", label: "Social", icon: Share2 },
];

const secondary = [
  { href: "/billing", label: "Billing", icon: Crown },
  { href: "/help", label: "Help", icon: HelpCircle },
];

function NavContent({
  user,
  pathname,
  onLinkClick,
}: {
  user: any;
  pathname: string;
  onLinkClick?: () => void;
}) {
  return (
    <>
      <div className="flex h-16 items-center gap-2 border-b border-border/60 px-6 font-semibold">
        <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground">
          <Sparkles className="h-4 w-4" />
        </div>
        <span className="truncate">Auto Traffic</span>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-4">
        <div className="px-3 pb-2 pt-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Modules
        </div>
        {nav.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onLinkClick}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition",
                active
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
        {user.role === "admin" && (
          <Link
            href="/admin"
            onClick={onLinkClick}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition",
              pathname.startsWith("/admin")
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <Shield className="h-4 w-4" />
            Admin
          </Link>
        )}

        <div className="pt-6 px-3 pb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Account
        </div>
        {secondary.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            onClick={onLinkClick}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition",
              pathname === item.href
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </Link>
        ))}
      </nav>

      {user.plan === "free" && (
        <div className="m-4 rounded-xl border border-primary/20 bg-gradient-to-br from-primary/10 to-purple-500/10 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Crown className="h-4 w-4 text-primary" /> Go Premium
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Unlock unlimited indexer, videos, and social posts.
          </p>
          <Link
            href="/billing"
            onClick={onLinkClick}
            className="mt-3 block rounded-lg bg-primary py-2 text-center text-xs font-medium text-primary-foreground hover:opacity-90"
          >
            Upgrade — ₦25,000/mo
          </Link>
        </div>
      )}
    </>
  );
}

export function Sidebar({
  user,
  mobileOpen,
  onMobileClose,
}: {
  user: any;
  mobileOpen: boolean;
  onMobileClose: () => void;
}) {
  const pathname = usePathname();

  return (
    <>
      {/* Desktop sidebar — hidden on mobile */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-border/60 bg-background lg:flex">
        <NavContent user={user} pathname={pathname} />
      </aside>

      {/* Mobile drawer — hidden on desktop */}
      <div
        className={cn(
          "fixed inset-0 z-50 lg:hidden",
          mobileOpen ? "pointer-events-auto" : "pointer-events-none"
        )}
        aria-hidden={!mobileOpen}
      >
        {/* Backdrop */}
        <div
          onClick={onMobileClose}
          className={cn(
            "absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-200",
            mobileOpen ? "opacity-100" : "opacity-0"
          )}
        />
        {/* Drawer panel */}
        <aside
          className={cn(
            "absolute left-0 top-0 flex h-full w-72 max-w-[80vw] flex-col border-r border-border bg-background shadow-2xl transition-transform duration-200 ease-out",
            mobileOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          {/* Close button */}
          <button
            onClick={onMobileClose}
            className="absolute right-2 top-3 z-10 grid h-9 w-9 place-items-center rounded-lg text-muted-foreground hover:bg-muted"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
          <NavContent user={user} pathname={pathname} onLinkClick={onMobileClose} />
        </aside>
      </div>
    </>
  );
}