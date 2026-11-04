import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { MessageSquare, ArrowUpRight, Building2 } from "lucide-react";
import { timeAgo } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Q&A Community — Real questions, real answers",
  description:
    "Browse real questions from across the web answered by businesses using Auto Traffic Engine.",
};

export default async function QAFeedPage() {
  const posts = await prisma.qAPost.findMany({
  where: { status: "published" },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { business: true },
  });

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-5">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground">
              <MessageSquare className="h-4 w-4" />
            </div>
            Q&amp;A Community
          </Link>
          <Link
            href="/register"
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            Join free
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-semibold tracking-tight">
            Real questions, real answers
          </h1>
          <p className="mt-2 text-muted-foreground">
            Community-sourced Q&amp;A, answered by experts and businesses.
          </p>
        </div>

        {posts.length === 0 ? (
          <div className="rounded-xl border border-border/60 bg-card p-12 text-center">
            <MessageSquare className="mx-auto mb-4 h-10 w-10 text-muted-foreground/40" />
            <div className="text-lg font-medium">No questions yet</div>
            <p className="mt-1 text-sm text-muted-foreground">
              Publish your first answer from the Q&amp;A Finder to see it here.
            </p>
            <Link
              href="/qa"
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              <ArrowUpRight className="h-4 w-4" /> Go to Q&amp;A Finder
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {posts.map((post) => (
              <Link
                key={post.id}
                href={`/qa/${post.slug}`}
                className="block rounded-xl border border-border/60 bg-card p-5 transition hover:border-primary/40 hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                        {post.sourcePlatform}
                      </span>
                      {post.business && (
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <Building2 className="h-3 w-3" /> {post.business.name}
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {timeAgo(post.createdAt)}
                      </span>
                    </div>
                    <h2 className="mt-2 text-lg font-semibold leading-snug">
                      {post.title}
                    </h2>
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                      {post.body.slice(0, 200)}…
                    </p>
                  </div>
                  <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}