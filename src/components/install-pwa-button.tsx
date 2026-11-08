"use client";

import { useEffect, useState } from "react";
import { Download, X, Smartphone, Loader2, Share } from "lucide-react";
import { useInstallPrompt } from "./install-pwa-provider";

const DISMISS_KEY = "ate-pwa-dismissed-until";
const DISMISS_DAYS = 7;

export default function InstallPWAButton() {
  const { canInstall, isInstalled, isIOS, promptInstall } = useInstallPrompt();
  const [show, setShow] = useState(false);
  const [showIOSHelp, setShowIOSHelp] = useState(false);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    if (isInstalled) {
      setShow(false);
      return;
    }

    const until = Number(localStorage.getItem(DISMISS_KEY) ?? "0");
    if (until > Date.now()) return;

    if (canInstall || isIOS) {
      const t = setTimeout(() => setShow(true), 1000);
      return () => clearTimeout(t);
    }
  }, [canInstall, isInstalled, isIOS]);

  async function handleInstall() {
    if (canInstall) {
      setInstalling(true);
      try {
        const outcome = await promptInstall();
        if (outcome === "accepted") {
          setShow(false);
          localStorage.removeItem(DISMISS_KEY);
        } else if (outcome === "dismissed") {
          dismiss();
        }
      } finally {
        setInstalling(false);
      }
    } else if (isIOS) {
      setShowIOSHelp(true);
    }
  }

  function dismiss() {
    const until = Date.now() + DISMISS_DAYS * 24 * 60 * 60 * 1000;
    localStorage.setItem(DISMISS_KEY, String(until));
    setShow(false);
  }

  if (!show || isInstalled) return null;

  return (
    <>
      <div className="fixed bottom-4 left-1/2 z-40 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 sm:bottom-6 sm:left-auto sm:right-6 sm:translate-x-0">
        <div className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card/95 p-3 shadow-xl backdrop-blur-lg">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
            <Download className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold">Install Auto Traffic Engine</div>
            <div className="truncate text-xs text-muted-foreground">
              Add to your home screen for faster access
            </div>
          </div>
          <button
            onClick={handleInstall}
            disabled={installing}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {installing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
            <span className="hidden sm:inline">Install</span>
          </button>
          <button
            onClick={dismiss}
            aria-label="Dismiss install prompt"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-muted"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {showIOSHelp && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Smartphone className="h-5 w-5 text-primary" />
                <h3 className="text-base font-semibold">Install on iPhone / iPad</h3>
              </div>
              <button
                onClick={() => setShowIOSHelp(false)}
                aria-label="Close"
                className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <ol className="space-y-3 text-sm text-muted-foreground">
              <li className="flex gap-3">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary">1</span>
                <span>Tap the <Share className="mx-0.5 inline h-3.5 w-3.5" /> <strong>Share</strong> button in Safari</span>
              </li>
              <li className="flex gap-3">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary">2</span>
                <span>Scroll and tap <strong>Add to Home Screen</strong></span>
              </li>
              <li className="flex gap-3">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary">3</span>
                <span>Tap <strong>Add</strong> in the top-right</span>
              </li>
            </ol>
            <button
              onClick={() => {
                setShowIOSHelp(false);
                dismiss();
              }}
              className="mt-5 w-full rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
}