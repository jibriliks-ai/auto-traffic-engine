"use client";

import { useState, useMemo } from "react";
import {
  Search, BookOpen, Building2, BarChart3, MessageSquare, Globe2,
  Megaphone, CreditCard, ChevronRight, X,
} from "lucide-react";

type Article = {
  id: string;
  category: string;
  title: string;
  content: string;
};

const CATEGORIES = [
  { id: "getting-started", label: "Getting Started", icon: BookOpen },
  { id: "businesses", label: "Businesses", icon: Building2 },
  { id: "seo", label: "SEO Audit", icon: BarChart3 },
  { id: "qa", label: "Q&A Finder", icon: MessageSquare },
  { id: "classifieds", label: "Classifieds", icon: Megaphone },
  { id: "indexer", label: "Indexer", icon: Globe2 },
  { id: "billing", label: "Billing", icon: CreditCard },
];

const ARTICLES: Article[] = [
  {
    id: "first-business",
    category: "getting-started",
    title: "Create your first business",
    content: `Every module targets a "business" — it holds your name, website, keywords, and description. AI uses this to tailor every output.

Steps:
1. Click **Businesses** in the sidebar
2. Click **Add business**
3. Fill in all four fields — name, website, keywords, description
4. Save — it becomes your "active business" automatically

**Free plan = 1 business. Premium = unlimited.** Upgrade from /billing to add more.

All modules (SEO, Q&A, Classifieds, Indexer) auto-pull your active business's website and keywords so you don't retype them every time.`,
  },
  {
    id: "switch-business",
    category: "getting-started",
    title: "Switch between businesses",
    content: `If you have multiple businesses (Premium plan), you control which one the modules use.

How:
1. Click the business dropdown in the **topbar** (next to theme toggle)
2. Pick another business
3. All modules instantly re-target that business

Or click **Manage businesses** in the dropdown to edit/delete.`,
  },
  {
    id: "free-limits",
    category: "getting-started",
    title: "What does Free plan include?",
    content: `**Free plan limits:**
- 1 business
- 2 indexer submissions per day
- 1 video total
- 5 social posts per platform per day
- Unlimited SEO audits
- Unlimited Q&A searches
- Unlimited classifieds generation

**Premium plan (₦25,000/mo):**
- Unlimited businesses
- Unlimited indexer
- Unlimited videos
- Unlimited social posts
- Priority AI

Upgrade from **/billing**. Test card: 5531 8866 5214 2950 · CVV 564 · exp 09/32 · PIN 3310 · OTP 12345.`,
  },
  {
    id: "add-business",
    category: "businesses",
    title: "Add a business",
    content: `Click **Businesses** in the sidebar → **Add business**.

Required fields:
- **Name** (min 2 chars) — displayed in UI + used by AI
- **Website** — with or without https, we normalize it
- **Keywords** — comma-separated, e.g. "email marketing, automation, small business"
- **Description** (min 20 chars) — what you do, who you serve, what makes you different

The description is the most important field — the AI reads it when drafting Q&A replies, SEO fixes, and classified ads. Be specific.`,
  },
  {
    id: "edit-business",
    category: "businesses",
    title: "Edit or delete a business",
    content: `On the **Businesses** page, each card has:
- **Set active** — makes it the target for all modules
- **Edit** — opens the form with current values
- **Delete** — removes it permanently

Deleting a business does NOT delete submissions, Q&A posts, or payments linked to it — those get orphaned (businessId → null) but stay in your records.`,
  },
  {
    id: "seo-how",
    category: "seo",
    title: "How SEO Audit works",
    content: `Enter any URL → we fetch it → score it 0-100 across 8 checks:

1. **Title length** (50-60 chars optimal)
2. **Meta description** (120-155 chars)
3. **H1 count** (exactly 1)
4. **H2 count** (2+)
5. **Image alt text** (% with alt)
6. **Schema.org** (JSON-LD present)
7. **Internal links** (2+)
8. **Content depth** (500+ words)

Green tick = pass. Amber = warning. Red = critical.

Limitations: sites behind Cloudflare or blocking bots will return 403. Try a different URL.`,
  },
  {
    id: "seo-fix",
    category: "seo",
    title: "Fix with AI",
    content: `After running an audit, enter a **target keyword** in the fix panel and click **Fix with AI**.

We send the original page to GPT-4o-mini (or DeepSeek) with strict instructions:
- 50-60 char title with keyword
- 120-155 char meta with CTA
- One H1, three+ H2s with keyword
- 600-900 words of helpful body
- FAQPage + Article JSON-LD schema
- Two+ internal links

You get back a complete HTML document. **Download .html** → replace your page → done.

Requires an AI key in Render env — set either **OPENAI_API_KEY** or **DEEPSEEK_API_KEY** as an environment variable.`,
  },
  {
    id: "qa-search",
    category: "qa",
    title: "How Q&A Finder searches",
    content: `We query **11 sources in parallel**: Reddit, Lemmy.world, Lemmy.ml, Mbin, PieFed, StackExchange, Hacker News, Dev.to, Discourse, DuckDuckGo, and Quora.

**Strict relevance:** only results whose title OR body contains your keyword (exact phrase or all words) are returned. If you search "email marketing for small business", results missing any of those words are filtered out.

If a source is rate-limited or offline, the other 10 still fill the table.`,
  },
  {
    id: "qa-draft",
    category: "qa",
    title: "Draft and publish AI replies",
    content: `Click **Draft** on any result → AI writes a reply using your active business context.

The draft opens in an editable textarea. You can:
- **Edit** — fix anything the AI got wrong
- **Copy** — paste into the original platform
- **Publish to Q&A Clone** — adds it to your public feed at /qa/clone

Each published post gets a unique URL with FAQPage + Article JSON-LD schema, making it Google-friendly.`,
  },
  {
    id: "classifieds-how",
    category: "classifieds",
    title: "Generate classified ads",
    content: `Steps:
1. Pick a country (65 available)
2. Select up to 10 sites (checkbox per site)
3. Enter target keywords (pre-filled from your business)
4. Click **Generate**

One AI call creates **all 10 unique listings** — each tailored to the site's category (vehicles vs general vs jobs vs real estate). Takes 20-45 seconds.

Each listing shows Copy title, Copy body, Open site, and Mark submitted.

**Mark submitted** records it in your dashboard so you can track progress.`,
  },
  {
    id: "classifieds-translate",
    category: "classifieds",
    title: "Translate ads to any language",
    content: `After generating listings:
1. Pick a target language from the dropdown (18 options including Yoruba, Igbo, Hausa, Swahili)
2. Click **Translate** on any listing
3. Title and body translate in 2-5 seconds

Cards show a blue badge with the current language. Click **Reset to original** to revert.

Translation uses SimplyTranslate (primary) with MyMemory as fallback — both free, no API key required.`,
  },
  {
    id: "indexer-how",
    category: "indexer",
    title: "Submit URLs to search engines",
    content: `Enter URLs (one per line) → select engines → click Submit.

**IndexNow** broadcasts to Bing, Yandex, Naver, Seznam, Yep. Requires a key file at https://yourdomain.com/KEY.txt — download yours from the panel and upload it to your site's root.

**Google Indexing API** submits directly to Google. Requires a service-account JSON configured in your env + the service account email added as Owner in Search Console.

**Free plan: 2 submissions/day.** Premium: unlimited.

Works on your public domain — localhost will return 403 because the key file isn't publicly reachable.`,
  },
  {
    id: "billing-upgrade",
    category: "billing",
    title: "Upgrade to Premium",
    content: `1. Go to **/billing**
2. Click **Upgrade now**
3. You're redirected to Flutterwave's secure checkout
4. Pay with card, bank transfer, or USSD
5. Return to /billing → Premium activates instantly

Test card (sandbox): 5531 8866 5214 2950 · CVV 564 · exp 09/32 · PIN 3310 · OTP 12345

Premium renews monthly. Cancel by contacting support — no automatic renewal.`,
  },
  {
    id: "billing-failed",
    category: "billing",
    title: "Payment failed or didn't activate",
    content: `If the payment page didn't load: refresh /billing and try again.

If you paid but Premium didn't activate:
1. Check that you returned to /billing after payment — the verify step needs the redirect
2. If the verify failed, contact support with your Flutterwave transaction ID

If you got "Invalid authorization key" repeatedly: your Flutterwave test keys were rolled. Go to dashboard.flutterwave.com → Settings → API Keys → copy a fresh test secret key into Render's **FLUTTERWAVE_SECRET_KEY** environment variable, redeploy.`,
  },
];

export default function HelpPage() {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [activeArticle, setActiveArticle] = useState<Article | null>(null);

  const filtered = useMemo(() => {
    let list = ARTICLES;
    if (activeCategory) list = list.filter((a) => a.category === activeCategory);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (a) =>
          a.title.toLowerCase().includes(q) ||
          a.content.toLowerCase().includes(q)
      );
    }
    return list;
  }, [search, activeCategory]);

  function categoryLabel(id: string) {
    return CATEGORIES.find((c) => c.id === id)?.label ?? id;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Help Center</h1>
        <p className="mt-1 text-muted-foreground">
          Guides, tutorials, and answers to common questions.
        </p>
      </div>

      <div className="rounded-xl border border-border/60 bg-card p-4 sm:p-6">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search help articles…"
            className="h-11 w-full rounded-lg border border-border bg-background pl-10 pr-4 text-sm focus:border-primary focus:outline-none"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setActiveCategory(null)}
          className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
            !activeCategory
              ? "border-primary bg-primary/10 text-primary"
              : "border-border hover:bg-muted"
          }`}
        >
          All
        </button>
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            onClick={() => setActiveCategory(c.id)}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
              activeCategory === c.id
                ? "border-primary bg-primary/10 text-primary"
                : "border-border hover:bg-muted"
            }`}
          >
            <c.icon className="h-3.5 w-3.5" />
            {c.label}
          </button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {filtered.length === 0 && (
          <div className="col-span-full rounded-xl border border-border/60 bg-card p-8 text-center text-muted-foreground">
            No articles match "{search}"
          </div>
        )}
        {filtered.map((article) => (
          <button
            key={article.id}
            onClick={() => setActiveArticle(article)}
            className="flex items-start gap-3 rounded-xl border border-border/60 bg-card p-4 text-left transition hover:border-primary/40 hover:shadow-sm"
          >
            <div className="min-w-0 flex-1">
              <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {categoryLabel(article.category)}
              </div>
              <div className="mt-1 font-medium">{article.title}</div>
              <div className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                {article.content.replace(/[#*`]/g, "").slice(0, 120)}…
              </div>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          </button>
        ))}
      </div>

      {activeArticle && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setActiveArticle(null)}
          />
          <div className="relative z-10 flex max-h-[90vh] w-full max-w-2xl flex-col rounded-t-2xl border border-border bg-card shadow-2xl sm:rounded-2xl">
            <div className="flex items-start justify-between gap-2 border-b border-border/60 p-4 sm:p-5">
              <div>
                <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {categoryLabel(activeArticle.category)}
                </div>
                <div className="mt-1 text-xl font-semibold">{activeArticle.title}</div>
              </div>
              <button
                onClick={() => setActiveArticle(null)}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-lg hover:bg-muted"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 sm:p-5">
              <div className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
                {activeArticle.content}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}