"use client";

import { createContext, useContext, useEffect, useState } from "react";

type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type InstallContextType = {
  canInstall: boolean;
  isInstalled: boolean;
  isIOS: boolean;
  promptInstall: () => Promise<"accepted" | "dismissed" | "unavailable">;
};

const InstallContext = createContext<InstallContextType>({
  canInstall: false,
  isInstalled: false,
  isIOS: false,
  promptInstall: async () => "unavailable",
});

export function useInstallPrompt() {
  return useContext(InstallContext);
}

export function InstallPWAProvider({ children }: { children: React.ReactNode }) {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Detect installed / standalone
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;
    setIsInstalled(standalone);

    // Detect iOS (Safari doesn't fire beforeinstallprompt — we need a manual guide)
    const ua = window.navigator.userAgent;
    setIsIOS(/iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream);

    // Capture the install event once
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BIPEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);

    const onInstalled = () => {
      setIsInstalled(true);
      setDeferred(null);
    };
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function promptInstall(): Promise<"accepted" | "dismissed" | "unavailable"> {
    if (!deferred) return "unavailable";
    try {
      await deferred.prompt();
      const choice = await deferred.userChoice;
      setDeferred(null);
      return choice.outcome;
    } catch {
      return "unavailable";
    }
  }

  return (
    <InstallContext.Provider
      value={{
        canInstall: !!deferred,
        isInstalled,
        isIOS,
        promptInstall,
      }}
    >
      {children}
    </InstallContext.Provider>
  );
}