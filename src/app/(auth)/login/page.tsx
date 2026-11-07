"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import {
  Loader2,
  Eye,
  EyeOff,
  CheckCircle2,
  ExternalLink,
  ShieldCheck,
} from "lucide-react";

// Shown when the login page is rendered inside an iframe (e.g. blog widget).
// Iframe authentication is unreliable due to browser third-party cookie blocking,
// so we navigate the PARENT tab (same browser tab, no new tab) to the login page
// at top level where cookies work normally.
function IframeSignInPrompt() {
  const [url, setUrl] = useState("");
  const [navigating, setNavigating] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setUrl(window.location.href);
    }
  }, []);

  function navigateTopLevel() {
    if (!url) return;
    setNavigating(true);

    // Try to navigate the parent/top frame — this is a WRITE operation
    // to `location` and is allowed cross-origin per the Same-Origin Policy.
    // Result: the whole browser tab navigates, no new tab opens.
    try {
      if (window.top && window.top !== window) {
        window.top.location.href = url;
        return;
      }
    } catch (e) {
      // Fall through to same-frame navigation
      console.warn("[ATE] Top-level navigation blocked:", e);
    }

    // Fallback: navigate this frame (still same tab from user's perspective)
    window.location.href = url;
  }

  return (
    <div className="space-y-6 text-center">
      <Link
        href="/"
        className="mx-auto flex items-center justify-center gap-2 font-semibold"
      >
        <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary text-primary-foreground">
          <ShieldCheck className="h-5 w-5" />
        </div>
        Auto Traffic Engine
      </Link>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Sign in to continue
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          To sign in securely, we'll load the sign-in page at full size. Your
          current browser tab will update — no new tab opens.
        </p>
      </div>

      <button
        onClick={navigateTopLevel}
        disabled={navigating}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-3 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
      >
        {navigating ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <ExternalLink className="h-4 w-4" />
        )}
        {navigating ? "Loading…" : "Continue to sign in"}
      </button>

      <div className="rounded-lg border border-border/60 bg-muted/30 p-3 text-xs text-muted-foreground">
        After signing in, use your browser's{" "}
        <strong>Back button</strong> to return to the blog.
      </div>
    </div>
  );
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const callbackUrl = params.get("callbackUrl") ?? "/dashboard";
  const justReset = params.get("reset") === "1";
  const justExpired = params.get("expired") === "1";

  const [isInIframe, setIsInIframe] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");

  // Detect iframe on mount
  useEffect(() => {
    if (typeof window !== "undefined" && window.self !== window.top) {
      setIsInIframe(true);
    }
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await signIn("credentials", {
        email: email.trim().toLowerCase(),
        password,
        redirect: false,
      });
      if (res?.error) {
        setError("Incorrect email or password.");
      } else {
        router.push(callbackUrl);
        router.refresh();
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setGoogleLoading(true);
    await signIn("google", { callbackUrl });
  }

  const googleEnabled = process.env.NEXT_PUBLIC_GOOGLE_ENABLED === "true";

  // If inside an iframe → show the "Continue to sign in" prompt
  // (button navigates the PARENT tab, no new tab opens)
  if (isInIframe) {
    return <IframeSignInPrompt />;
  }

  return (
    <div className="space-y-6">
      {/* Mobile brand */}
      <Link
        href="/"
        className="mb-8 flex items-center gap-2 font-semibold lg:hidden"
      >
        <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground">
          <span className="text-xs">AT</span>
        </div>
        Auto Traffic Engine
      </Link>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Welcome back
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Sign in to keep your traffic flowing.
        </p>
      </div>

      {justReset && (
        <div className="flex items-start gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
          <span className="text-emerald-700 dark:text-emerald-400">
            Password reset successfully. Sign in with your new password.
          </span>
        </div>
      )}

      {justExpired && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
          You were signed out due to inactivity. Please sign in again.
        </div>
      )}

      {googleEnabled && (
        <>
          <button
            onClick={handleGoogle}
            disabled={googleLoading || loading}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-border bg-background text-sm font-medium hover:bg-muted disabled:opacity-50"
          >
            {googleLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <svg className="h-4 w-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.56c2.08-1.92 3.28-4.74 3.28-8.1z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.77c-.98.66-2.23 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.1a7.03 7.03 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"
                />
              </svg>
            )}
            Continue with Google
          </button>
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-background px-2 text-muted-foreground">
                OR
              </span>
            </div>
          </div>
        </>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className="mb-1.5 block text-sm font-medium">
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm focus:border-primary focus:outline-none"
          />
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label htmlFor="password" className="block text-sm font-medium">
              Password
            </label>
            <Link
              href="/forgot-password"
              className="text-xs text-primary hover:underline"
            >
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="h-11 w-full rounded-lg border border-border bg-background px-3 pr-10 text-sm focus:border-primary focus:outline-none"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded text-muted-foreground hover:text-foreground"
              tabIndex={-1}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-600 dark:text-rose-400">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || googleLoading}
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        Don&apos;t have an account?{" "}
        <Link
          href="/register"
          className="font-medium text-primary hover:underline"
        >
          Create one
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-96 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}