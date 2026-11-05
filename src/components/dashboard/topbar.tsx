"use client";

import { signOut } from "next-auth/react";
import { useTheme } from "next-themes";
import { LogOut, Moon, Sun, Menu } from "lucide-react";
import { BusinessSelector } from "./business-selector";

export function Topbar({
  user,
  onOpenMenu,
}: {
  user: any;
  onOpenMenu: () => void;
}) {
  const { theme, setTheme } = useTheme();

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-2 border-b border-border/60 bg-background/80 px-3 backdrop-blur-xl sm:px-4 lg:px-6">
      {/* Left */}
      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        <button
          onClick={onOpenMenu}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-border hover:bg-muted lg:hidden"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">
            Welcome back, {user.name?.split(" ")[0] ?? "there"}
          </div>
          <div className="truncate text-xs text-muted-foreground">
            {user.plan === "premium" ? (
              <span className="text-primary">Premium plan</span>
            ) : (
              <>Free plan · <a href="/billing" className="underline">upgrade</a></>
            )}
          </div>
        </div>
      </div>

      {/* Right */}
      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
        {/* Hide business selector below md (accessible via sidebar → Businesses) */}
        <div className="hidden md:block">
          <BusinessSelector />
        </div>
        <button
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="grid h-9 w-9 place-items-center rounded-lg border border-border hover:bg-muted"
          aria-label="Toggle theme"
        >
          <Sun className="h-4 w-4 dark:hidden" />
          <Moon className="hidden h-4 w-4 dark:block" />
        </button>
        <div className="hidden h-9 w-9 place-items-center rounded-full bg-primary/10 text-sm font-medium text-primary sm:grid">
          {user.email?.[0]?.toUpperCase()}
        </div>
        <button
          onClick={() => signOut({ callbackUrl: "/" })}
          className="grid h-9 w-9 place-items-center rounded-lg border border-border text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Sign out"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}