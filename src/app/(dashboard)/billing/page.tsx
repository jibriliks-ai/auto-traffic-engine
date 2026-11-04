"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  CheckCircle2, Crown, Loader2, Receipt, CreditCard,
  XCircle, Sparkles, Calendar,
} from "lucide-react";
import { timeAgo } from "@/lib/utils";

const PREMIUM_PRICE_DISPLAY = "₦25,000";

type Payment = {
  id: string;
  reference: string;
  amount: number;
  currency: string;
  status: string;
  paidAt: string | null;
  createdAt: string;
};

export default function BillingPage() {
  const router = useRouter();
  const params = useSearchParams();
  const { data: session, update: updateSession } = useSession();

  const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
  const [debugInfo, setDebugInfo] = useState<string[]>([]);
  const [verifying, setVerifying] = useState(false);
  const [verifySuccess, setVerifySuccess] = useState(false);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(true);

  const plan = (session?.user as any)?.plan ?? "free";
  const isPremium = plan === "premium";

  // Flutterwave redirects back with ?status=successful&tx_ref=...&transaction_id=...
  useEffect(() => {
    const transactionId = params.get("transaction_id");
    const txRef = params.get("tx_ref");
    const status = params.get("status");

    // Only verify if we actually came back from a Flutterwave redirect
    if (!transactionId && !txRef) return;
    if (status && status !== "successful" && status !== "completed") {
      setError("Payment was not completed.");
      window.history.replaceState({}, "", "/billing");
      return;
    }

    setVerifying(true);
    setError("");
    fetch("/api/billing/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transaction_id: transactionId, tx_ref: txRef }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Verification failed");
        setVerifySuccess(true);
        await updateSession();
        router.replace("/billing");
        router.refresh();
      })
      .catch((e) => setError(e.message))
      .finally(() => {
        setVerifying(false);
        window.history.replaceState({}, "", "/billing");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetch("/api/billing/payments")
      .then((r) => (r.ok ? r.json() : { payments: [] }))
      .then((d) => setPayments(d.payments ?? []))
      .catch(() => {})
      .finally(() => setLoadingPayments(false));
  }, [verifySuccess]);

   function addDebug(msg: string) {
    setDebugInfo((prev) => [...prev, msg]);
  }

  async function upgrade() {
    setError("");
    setDebugInfo([]);
    setLoading(true);

    addDebug("1. Sending POST /api/billing/checkout...");

    try {
      const res = await fetch("/api/billing/checkout", { method: "POST" });
      addDebug(`2. Response: HTTP ${res.status}`);

      let data: any;
      try {
        data = await res.json();
      } catch {
        throw new Error(
          `Server returned HTTP ${res.status} but not JSON. Check the terminal running npm run dev.`
        );
      }

      addDebug(`3. Body: ${JSON.stringify(data).slice(0, 120)}`);

      if (!res.ok) {
        throw new Error(`[HTTP ${res.status}] ${data.error ?? "Unknown server error"}`);
      }

      if (!data.checkout_url) {
        throw new Error(`Server OK but no checkout_url. Response: ${JSON.stringify(data)}`);
      }

      addDebug(`4. Checkout URL: ${data.checkout_url.slice(0, 70)}`);
      addDebug("5. Redirecting...");

      try {
        window.location.assign(data.checkout_url);
      } catch (e: any) {
        addDebug(`window.location.assign failed: ${e.message}`);
        const win = window.open(data.checkout_url, "_blank");
        if (!win) {
          throw new Error(`Popup blocked. Manually open: ${data.checkout_url}`);
        }
      }
    } catch (e: any) {
      addDebug(`ERROR: ${e.message}`);
      setError(e.message);
    } finally {
      setTimeout(() => setLoading(false), 3000);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Billing</h1>
        <p className="mt-1 text-muted-foreground">
          Manage your plan, view payment history, and unlock unlimited usage.
        </p>
      </div>

      {verifying && (
        <div className="flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <div>
            <div className="text-sm font-medium">Verifying payment…</div>
            <div className="text-xs text-muted-foreground">This takes a few seconds.</div>
          </div>
        </div>
      )}
      {verifySuccess && !verifying && (
        <div className="flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
          <CheckCircle2 className="h-5 w-5 text-emerald-500" />
          <div>
            <div className="text-sm font-medium">Premium activated!</div>
            <div className="text-xs text-muted-foreground">
              Unlimited indexer, videos, and social posts unlocked.
            </div>
          </div>
        </div>
      )}
      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4">
          <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-500" />
          <div>
            <div className="text-sm font-medium">Something went wrong</div>
            <div className="text-xs text-muted-foreground">{error}</div>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-border/60 bg-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm text-muted-foreground">Current plan</div>
            <div className="mt-1 flex items-center gap-2 text-2xl font-semibold">
              {isPremium ? (
                <><Crown className="h-5 w-5 text-primary" /> Premium</>
              ) : (
                "Free"
              )}
            </div>
            {isPremium && (
              <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Calendar className="h-3 w-3" /> Renews in 30 days
              </div>
            )}
          </div>
          {!isPremium && (
            <div className="text-sm text-muted-foreground">
              Upgrade to unlock unlimited everything.
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className={`rounded-2xl border bg-card p-6 ${!isPremium ? "border-primary/40 ring-1 ring-primary/20" : "border-border/60"}`}>
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-muted-foreground">Free</div>
            {!isPremium && (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">Current</span>
            )}
          </div>
          <div className="mt-2 text-4xl font-semibold">₦0</div>
          <p className="mt-1 text-sm text-muted-foreground">Perfect for trying it out.</p>
          <ul className="mt-6 space-y-3 text-sm">
            {[
              "Unlimited SEO audits",
              "Unlimited Q&A search",
              "Unlimited classifieds",
              "2 indexer submissions / day",
              "1 video total",
              "5 social posts / platform / day",
            ].map((f) => (
              <li key={f} className="flex gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <span>{f}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className={`rounded-2xl border p-6 ${isPremium ? "border-primary/40 bg-primary/5 ring-1 ring-primary/20" : "border-primary bg-card shadow-xl"}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-sm font-medium text-primary">
              <Crown className="h-3.5 w-3.5" /> Premium
            </div>
            {isPremium && (
              <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary">Active</span>
            )}
          </div>
          <div className="mt-2 text-4xl font-semibold">
            {PREMIUM_PRICE_DISPLAY}
            <span className="text-lg font-normal text-muted-foreground">/mo</span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">For serious operators.</p>
          <ul className="mt-6 space-y-3 text-sm">
            {[
              "Everything in Free",
              "Unlimited indexer submissions",
              "Unlimited videos",
              "Unlimited social posts",
              "Priority AI generation",
              "Lead webhook + CRM sync",
            ].map((f) => (
              <li key={f} className="flex gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span>{f}</span>
              </li>
            ))}
          </ul>
                {!isPremium ? (
            <>
              <button
                onClick={upgrade}
                disabled={loading}
                className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-3 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {loading ? "Redirecting to Flutterwave…" : "Upgrade now"}
              </button>
              {debugInfo.length > 0 && (
                <pre className="mt-3 max-h-56 overflow-auto rounded-lg border border-border bg-muted/40 p-3 text-[11px] leading-relaxed whitespace-pre-wrap break-all text-muted-foreground">
                  {debugInfo.join("\n")}
                </pre>
              )}
            </>
          ) : (
            <div className="mt-8 rounded-lg bg-muted/50 py-3 text-center text-sm text-muted-foreground">
              You're on the best plan 🎉
            </div>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-border/60 bg-card">
        <div className="flex items-center justify-between border-b border-border/60 p-5">
          <div className="flex items-center gap-2 font-semibold">
            <Receipt className="h-4 w-4 text-muted-foreground" /> Payment history
          </div>
        </div>
        <div className="divide-y divide-border/60">
          {loadingPayments && (
            <div className="p-8 text-center text-sm text-muted-foreground">
              <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" /> Loading…
            </div>
          )}
          {!loadingPayments && payments.length === 0 && (
            <div className="p-8 text-center text-sm text-muted-foreground">
              <CreditCard className="mx-auto mb-2 h-8 w-8 opacity-40" />
              No payments yet. Upgrade to Premium to start.
            </div>
          )}
          {payments.map((p) => (
            <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">
                  {p.amount.toLocaleString()} {p.currency}
                </div>
                <div className="truncate text-xs text-muted-foreground">
                  {p.reference} · {p.paidAt ? timeAgo(new Date(p.paidAt)) : timeAgo(new Date(p.createdAt))}
                </div>
              </div>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  p.status === "success"
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                    : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                }`}
              >
                {p.status}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-border/60 bg-muted/30 p-5 text-sm text-muted-foreground">
        Questions about billing?{" "}
        <Link href="/help" className="text-primary hover:underline">Read the help docs</Link>{" "}
        or contact support@auto-traffic-engine.com
      </div>
    </div>
  );
}