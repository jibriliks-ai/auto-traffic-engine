"use client";

import { useEffect, useRef } from "react";
import { signOut } from "next-auth/react";

const DEFAULT_TIMEOUT_MS = 20 * 60 * 1000;
const STORAGE_KEY = "ate-last-activity-at";
const LOGOUT_REASON_KEY = "ate-logout-reason";
const ACTIVITY_THROTTLE_MS = 1_000;

/**
 * Signs the user out after `timeoutMs` of inactivity.
 *
 * Works on both mobile and desktop. Handles:
 *   ✓ Touch taps + drags (pointerdown, pointermove, touchstart, touchmove)
 *   ✓ Mouse moves + clicks (mousedown, mousemove)
 *   ✓ Keyboard + scroll + trackpad (keydown, scroll, wheel)
 *   ✓ Backgrounded tabs (setTimeout frozen) — checks elapsed on resume
 *   ✓ PWA resume from app switcher — visibilitychange
 *   ✓ bfcache page restore — pageshow with persisted:true
 *   ✓ Mobile Safari page hide — pagehide
 *   ✓ Desktop tab switch back — window focus
 *   ✓ Multi-tab activity sync — storage event
 */
export function useIdleTimeout(timeoutMs: number = DEFAULT_TIMEOUT_MS) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastActivityRef = useRef<number>(Date.now());
  const firedRef = useRef(false);
  const lastWriteRef = useRef<number>(0);

  useEffect(() => {
    // Restore activity from storage (bfcache restore or fresh reload)
    try {
      const stored = Number(localStorage.getItem(STORAGE_KEY) ?? "0");
      if (stored > 0 && stored <= Date.now()) {
        lastActivityRef.current = Math.max(lastActivityRef.current, stored);
        lastWriteRef.current = lastActivityRef.current;
      }
    } catch {
      /* private mode or storage disabled */
    }

    function persistActivity() {
      try {
        localStorage.setItem(STORAGE_KEY, String(lastActivityRef.current));
      } catch {}
    }

    function logout(reason: string) {
      if (firedRef.current) return;
      firedRef.current = true;

      try {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.setItem(LOGOUT_REASON_KEY, reason);
      } catch {}

      // signOut + hard-nav — best-effort, but always navigate
      signOut({ redirect: false })
        .catch(() => {})
        .finally(() => {
          window.location.href = "/login?reason=idle";
        });
    }

    function checkElapsed(): boolean {
      if (firedRef.current) return true;
      const elapsed = Date.now() - lastActivityRef.current;
      if (elapsed >= timeoutMs) {
        logout("elapsed");
        return true;
      }
      return false;
    }

    function scheduleTimer() {
      if (timerRef.current) clearTimeout(timerRef.current);
      const remaining = Math.max(
        0,
        timeoutMs - (Date.now() - lastActivityRef.current)
      );
      timerRef.current = setTimeout(() => {
        checkElapsed();
      }, remaining);
    }

    function recordActivity() {
      if (firedRef.current) return;
      const now = Date.now();
      // Throttle: pointermove fires ~60×/s, we only need 1/s precision
      if (now - lastWriteRef.current < ACTIVITY_THROTTLE_MS) return;
      lastWriteRef.current = now;
      lastActivityRef.current = now;
      persistActivity();
      scheduleTimer();
    }

    // ── Activity events — covers every input device ──
    const activityEvents: (keyof WindowEventMap)[] = [
      "pointerdown", // touch + mouse + pen taps (modern browsers)
      "pointermove", // touch drags + mouse moves
      "touchstart",  // legacy mobile Safari
      "touchmove",   // legacy mobile Safari
      "mousedown",   // desktop
      "mousemove",   // desktop
      "keydown",     // physical + mobile keyboard
      "scroll",      // any scroll
      "wheel",       // trackpad / mouse wheel
    ];
    activityEvents.forEach((ev) =>
      window.addEventListener(ev, recordActivity, { passive: true })
    );

    // ── Visibility: the critical mobile fix ──
    // setTimeout is throttled/frozen in backgrounded tabs on iOS + Android.
    // On resume, we check elapsed time and log out if > 20 min.
    function onVisibilityChange() {
      if (document.visibilityState === "visible") {
        if (!checkElapsed()) scheduleTimer();
      } else {
        persistActivity();
      }
    }
    document.addEventListener("visibilitychange", onVisibilityChange);

    // ── pageshow: bfcache restore (Back button) ──
    function onPageShow(e: PageTransitionEvent) {
      if (e.persisted && !checkElapsed()) scheduleTimer();
    }
    window.addEventListener("pageshow", onPageShow);

    // ── pagehide: iOS Safari specific hide ──
    function onPageHide() {
      persistActivity();
    }
    window.addEventListener("pagehide", onPageHide);

    // ── focus: desktop tab switch back ──
    function onFocus() {
      if (!checkElapsed()) scheduleTimer();
    }
    window.addEventListener("focus", onFocus);

    // ── storage: multi-tab sync ──
    function onStorage(e: StorageEvent) {
      if (e.key === STORAGE_KEY && e.newValue) {
        const other = Number(e.newValue);
        if (other > lastActivityRef.current) {
          lastActivityRef.current = other;
          lastWriteRef.current = other;
          scheduleTimer();
        }
      }
      // If another tab already logged out, follow suit
      if (e.key === LOGOUT_REASON_KEY) {
        firedRef.current = true;
        window.location.href = "/login?reason=idle";
      }
    }
    window.addEventListener("storage", onStorage);

    // Start the timer
    recordActivity();

    return () => {
      activityEvents.forEach((ev) =>
        window.removeEventListener(ev, recordActivity)
      );
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pageshow", onPageShow);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("storage", onStorage);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [timeoutMs]);
}