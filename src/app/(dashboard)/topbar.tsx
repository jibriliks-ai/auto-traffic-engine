"use client";

import { signOut } from "next-auth/react";
import { useTheme } from "next-themes";
import { LogOut, Moon, Sun, Menu } from "lucide-react";

export function Topbar({ user }: { user: any }) {
  const { theme, setTheme } = useTheme();
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border/60 bg-background/80 px-6 backdrop-blur-xl">
      <div className="flex items-center gap-3">
        <button className="lg:hidden">
          <Menu className="h-5 w-5" />
        </button>
        <div>
          <div className="text-sm font-medium">Welcome back, {user.name?.split(" ")[0] ?? "there"}</div>
          <div className="text-xs text-muted-foreground">
            {user.plan === "premium" ? (
              <span className="text-primary">Premium plan</span>
            ) : (
              <>Free plan · <a href="/billing" className="underline">upgrade</a></>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="grid h-9 w-9 place-items-center rounded-lg border border-border hover:bg-muted"
          aria-label="Toggle theme"
        >
          <Sun className="h-4 w-4 dark:hidden" />
          <Moon className="hidden h-4 w-4 dark:block" />
        </button>
        <div className="grid h-9 w-9 place-items-center rounded-full bg-primary/10 text-sm font-medium text-primary">
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