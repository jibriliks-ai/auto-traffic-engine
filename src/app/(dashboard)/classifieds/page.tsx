import Link from "next/link";
import { Megaphone, Sparkles } from "lucide-react";

export default function ClassifiedsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Classifieds</h1>
        <p className="mt-1 text-muted-foreground">
          Submit AI-generated classified ads across 65 countries × 10 sites.
        </p>
      </div>
      <div className="rounded-xl border border-primary/30 bg-gradient-to-br from-primary/10 to-purple-500/5 p-12 text-center">
        <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-xl bg-primary/15 text-primary">
          <Sparkles className="h-7 w-7" />
        </div>
        <h2 className="text-xl font-semibold">Coming in the next update</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          The Classifieds module is being built. It will generate unique AI-written
          listings for each classifieds site, using your active business as the source.
        </p>
        <Link
          href="/businesses"
          className="mt-6 inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          <Megaphone className="h-4 w-4" /> Set up your business first
        </Link>
      </div>
    </div>
  );
}