import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ArrowLeft, ExternalLink, Building2 } from "lucide-react";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}) {
  const post = await prisma.qaPost.findUnique({
    where: { slug: params.slug },
    include: { business: true },
  });
  if (!post) return { title: "Question not found" };
  return {
    title: post.title,
    description: post.body.slice(0, 155),
    openGraph: {
      title: post.title,
      description: post.body.slice(0, 155),
      type: "article",
    },
  };
}

export default async function QAPostPage({
  params,
}: {
  params: { slug: string };
}) {
  const post = await prisma.qaPost.findUnique({
    where: { slug: params.slug },
    include: { business: true },
  });
  if (!post) notFound();

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: post.title,
        acceptedAnswer: {
          "@type": "Answer",
          text: post.body,
        },
      },
    ],
  };

  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    datePublished: post.createdAt.toISOString(),
    author: {
      "@type": "Organization",
      name: post.business?.name ?? "Auto Traffic Engine",
    },
  };

  return (
    <div className="min-h-screen bg-background">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
      />

      <div className="mx-auto max-w-3xl px-6 py-12">
        <Link
          href="/qa/clone"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Q&amp;A
        </Link>

        <article className="mt-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
              {post.sourcePlatform}
            </span>
            {post.business && (
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                <Building2 className="h-3 w-3" /> {post.business.name}
              </span>
            )}
            <span className="text-xs text-muted-foreground">
              {new Date(post.createdAt).toLocaleDateString()}
            </span>
          </div>

          <h1 className="mt-4 text-3xl font-semibold tracking-tight leading-tight">
            {post.title}
          </h1>

          <div className="mt-6">
            {post.body.split("\n\n").map((para, i) => (
              <p key={i} className="mb-4 text-base leading-relaxed text-foreground/90">
                {para}
              </p>
            ))}
          </div>

          <div className="mt-8 border-t border-border/60 pt-6">
            <a
              href={post.sourceUrl}
              target="_blank"
              rel="noreferrer nofollow"
              className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm hover:bg-muted"
            >
              <ExternalLink className="h-4 w-4" />
              View original discussion on {post.sourcePlatform}
            </a>
          </div>

          {post.business && (
            <div className="mt-10 rounded-xl border border-primary/20 bg-gradient-to-br from-primary/5 to-purple-500/5 p-6">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Building2 className="h-4 w-4 text-primary" /> About{" "}
                {post.business.name}
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                {post.business.description}
              </p>
              <a
                href={post.business.website}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
              >
                Visit {post.business.name}{" "}
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          )}
        </article>
      </div>
    </div>
  );
}