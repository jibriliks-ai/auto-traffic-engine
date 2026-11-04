import Link from "next/link";
import { Share2, Sparkles } from "lucide-react";

export default function SocialPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Social</h1>
        <p className="mt-1 text-muted-foreground">
          Publish to Facebook Pages and X (Twitter) with AI-written posts.
        </p>
      </div>
      <div className="rounded-xl border border-primary/30 bg-gradient-to-br from-primary/10 to-purple-500/5 p-12 text-center">
        <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-xl bg-primary/15 text-primary">
          <Sparkles className="h-7 w-7" />
        </div>
        <h2 className="text-xl font-semibold">Social OAuth setup required</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          This module needs Facebook Pages API and Twitter API credentials. Once
          configured, one-click posting to all connected pages will be enabled.
        </p>
        <Link
          href="/businesses"
          className="mt-6 inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          <Share2 className="h-4 w-4" /> Set up your business first
        </Link>
      </div>
    </div>
  );
}