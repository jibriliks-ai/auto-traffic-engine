"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { AlertTriangle } from "lucide-react";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { useIdleTimeout } from "@/hooks/use-idle-timeout";
import { InstallPWAButton } from "@/components/install-pwa-button";

export function DashboardShell({
  user,
  children,
}: {
  user: any;
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const { showWarning, remainingSeconds } = useIdleTimeout();

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  return (
    <div className="flex min-h-screen bg-muted/30">
      <Sidebar
        user={user}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar user={user} onOpenMenu={() => setMobileOpen(true)} />

        {/* Idle warning banner */}
        {showWarning && (
          <div className="border-b border-amber-500/40 bg-amber-500/10 px-4 py-2.5">
            <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 text-sm">
              <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                <AlertTriangle className="h-4 w-4" />
                <span>
                  You'll be signed out in{" "}
                  <strong>{remainingSeconds}s</strong> due to inactivity.
                </span>
              </div>
              <button
                onClick={() => {
                  // Trigger activity — the idle hook will reset on the click
                  window.dispatchEvent(new Event("mousemove"));
                }}
                className="rounded-lg bg-amber-500 px-3 py-1 text-xs font-medium text-white hover:bg-amber-600"
              >
                Stay signed in
              </button>
            </div>
          </div>
        )}

        <main className="flex-1 overflow-x-hidden p-4 sm:p-6 lg:p-8">
          <div className="mx-auto w-full max-w-7xl">{children}</div>
        </main>
      </div>

      {/* PWA install prompt — bottom-right on desktop, bottom on mobile */}
      <InstallPWAButton />
    </div>
  );
}