import Link from "next/link";
import { Sparkles, CheckCircle2 } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Marketing side */}
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-primary/15 via-purple-500/10 to-blue-500/15 lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-primary/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-32 h-96 w-96 rounded-full bg-purple-500/15 blur-3xl" />

        <Link href="/" className="relative flex items-center gap-2 font-semibold">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-primary-foreground">
            <Sparkles className="h-4 w-4" />
          </div>
          Auto Traffic Engine
        </Link>

        <div className="relative">
          <h2 className="max-w-md text-4xl font-semibold leading-tight tracking-tight">
            Six marketing engines. One dashboard. Real traffic in days.
          </h2>
          <p className="mt-4 max-w-md text-muted-foreground">
            Audit, answer, post, index, publish — every action tracked, every click captured.
          </p>
          <ul className="mt-8 space-y-3 text-sm">
            {[
              "Unlimited SEO audits with AI-powered fixes",
              "Q&A leads from Reddit, Lemmy, StackExchange and more",
              "Instant indexing to Bing, Yandex, Naver, Google",
              "15-second videos and one-click social publishing",
            ].map((item) => (
              <li key={item} className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative text-xs text-muted-foreground">
          © {new Date().getFullYear()} Auto Traffic Engine · Built for growth
        </div>
      </div>

      {/* Form side */}
      <div className="flex items-center justify-center p-6 md:p-12">
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </div>
  );
}