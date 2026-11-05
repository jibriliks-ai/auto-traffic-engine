"use client";

import { useEffect, useState } from "react";
import { signOut } from "next-auth/react";

const IDLE_MS = 20 * 60 * 1000;        // 20 minutes
const WARN_MS = 60 * 1000;             // warn 1 min before logout
const CHECK_INTERVAL = 10 * 1000;      // check every 10s

export function useIdleTimeout() {
  const [showWarning, setShowWarning] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(0);

  useEffect(() => {
    let lastActivity = Date.now();
    let warned = false;

    function reset() {
      lastActivity = Date.now();
      if (warned) {
        warned = false;
        setShowWarning(false);
      }
    }

    const events = ["mousedown", "keydown", "touchstart", "scroll", "mousemove", "focus"];
    events.forEach((e) =>
      window.addEventListener(e, reset, { passive: true })
    );

    const interval = setInterval(() => {
      const idle = Date.now() - lastActivity;
      if (idle >= IDLE_MS) {
        clearInterval(interval);
        signOut({ callbackUrl: "/login?expired=1" });
      } else if (!warned && idle >= IDLE_MS - WARN_MS) {
        warned = true;
        setShowWarning(true);
        setRemainingSeconds(Math.ceil((IDLE_MS - idle) / 1000));
      } else if (warned) {
        setRemainingSeconds(Math.max(0, Math.ceil((IDLE_MS - idle) / 1000)));
      }
    }, CHECK_INTERVAL);

    return () => {
      events.forEach((e) => window.removeEventListener(e, reset));
      clearInterval(interval);
    };
  }, []);

  return { showWarning, remainingSeconds };
}