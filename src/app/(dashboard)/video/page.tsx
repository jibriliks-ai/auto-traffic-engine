import Link from "next/link";
import { Video, Sparkles } from "lucide-react";

export default function VideoPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Video Creator</h1>
        <p className="mt-1 text-muted-foreground">
          Turn a product image into a 15–20 second vertical video with AI voiceover.
        </p>
      </div>
      <div className="rounded-xl border border-primary/30 bg-gradient-to-br from-primary/10 to-purple-500/5 p-12 text-center">
        <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-xl bg-primary/15 text-primary">
          <Sparkles className="h-7 w-7" />
        </div>
        <h2 className="text-xl font-semibold">Video rendering microservice needed</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          The Video module requires a separate Python FastAPI service (moviepy + ElevenLabs).
          Deploy it on Render and link it — this page will be ready.
        </p>
        <Link
          href="/businesses"
          className="mt-6 inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          <Video className="h-4 w-4" /> Set up your business first
        </Link>
      </div>
    </div>
  );
}