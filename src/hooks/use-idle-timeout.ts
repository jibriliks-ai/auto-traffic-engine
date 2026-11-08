"use client";

import { useEffect, useRef } from "react";
import { signOut } from "next-auth/react";

const DEFAULT_TIMEOUT_MS = 20 * 60 * 1000; // 20 minutes

/**
 * Signs the user out after a period of inactivity.
 *
 * Activity = mouse movement, click, keyboard, touch, scroll, or tab
 * becoming visible again (user switched back to the tab).
 *
 * On timeout: clears the NextAuth cookie, then hard-navigates to /login
 * so the browser reloads session state from the server.
 */
export function useIdleTimeout(timeoutMs: number = DEFAULT_TIMEOUT_MS) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firedRef = useRef(false);

  useEffect(() => {
    function logout() {
      if (firedRef.current) return;
      firedRef.current = true;
      // Fire-and-forget signOut, then hard-nav regardless.
      signOut({ redirect: false })
        .catch(() => {})
        .finally(() => {
          window.location.href = "/login?reason=idle";
        });
    }

    function reset() {
      if (firedRef.current) return;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(logout, timeoutMs);
    }

    // Activity events — passive so they don't hurt scroll performance
    const events: (keyof WindowEventMap)[] = [
      "mousemove",
      "mousedown",
      "keydown",
      "touchstart",
      "scroll",
      "wheel",
    ];

    events.forEach((ev) => window.addEventListener(ev, reset, { passive: true }));

    // Reset when the tab becomes visible again (user was away, came back)
    const onVisibility = () => {
      if (document.visibilityState === "visible") reset();
    };
    document.addEventListener("visibilitychange", onVisibility);

    // Kick off the first timer
    reset();

    return () => {
      events.forEach((ev) => window.removeEventListener(ev, reset));
      document.removeEventListener("visibilitychange", onVisibility);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [timeoutMs]);
}