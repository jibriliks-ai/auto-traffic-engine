"use client";

import { useEffect, useState } from "react";
import { Download, X, Share } from "lucide-react";

export function InstallPWAButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [show, setShow] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    // Skip if already installed (running in standalone mode)
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(display-mode: standalone)").matches
    ) {
      setInstalled(true);
      return;
    }

    // Skip if dismissed within the last 7 days
    const dismissedAt = localStorage.getItem("pwa-dismissed-at");
    if (dismissedAt) {
      const days = (Date.now() - parseInt(dismissedAt)) / (1000 * 60 * 60 * 24);
      if (days < 7) return;
    }

    const ios =
      /iPad|iPhone|iPod/.test(navigator.userAgent) &&
      !(window as any).MSStream;
    setIsIOS(ios);

    if (ios) {
      // iOS doesn't fire beforeinstallprompt — show manual instructions
      setTimeout(() => setShow(true), 3000); // delay so it doesn't distract on page load
      return;
    }

    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShow(true);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  async function install() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setShow(false);
      setInstalled(true);
    }
    setDeferredPrompt(null);
  }

  function dismiss() {
    setShow(false);
    localStorage.setItem("pwa-dismissed-at", Date.now().toString());
  }

  if (!show || installed) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-40 rounded-xl border border-primary/30 bg-card p-4 shadow-2xl sm:left-auto sm:right-4 sm:max-w-sm">
      <button
        onClick={dismiss}
        className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-muted"
        aria-label="Dismiss"
      >
        <X className="h-3.5 w-3.5" />
      </button>

      <div className="flex items-start gap-3 pr-6">
        <img
          src="/icons/icon-192.png"
          alt="Auto Traffic Engine"
          className="h-12 w-12 shrink-0 rounded-lg"
        />
        <div className="min-w-0 flex-1">
          <div className="font-semibold">Install Auto Traffic Engine</div>
          {isIOS ? (
            <div className="mt-1 text-xs text-muted-foreground">
              Tap <Share className="inline h-3 w-3" /> Share, then{" "}
              <strong>Add to Home Screen</strong>
            </div>
          ) : (
            <div className="mt-1 text-xs text-muted-foreground">
              Faster access, works offline, looks like a native app.
            </div>
          )}
        </div>
      </div>

      {!isIOS && (
        <button
          onClick={install}
          className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          <Download className="h-4 w-4" />
          Add to Home Screen
        </button>
      )}
    </div>
  );
}