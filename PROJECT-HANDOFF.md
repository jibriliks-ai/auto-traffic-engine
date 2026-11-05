# Auto Traffic Engine — Project Handoff

**Last updated:** $35 pricing deployed, 5/day Q&A limit active, admin panel + help center + PWA + 20-min idle logout all shipped. **All 6 core modules + admin + help are live.**

**Paste this entire file at the start of a new chat to restore full context.**

---

## 1. Project summary

Multi-tenant marketing SaaS. Six core modules: SEO Audit, Q&A Finder (11 sources, strict keyword filtering), Q&A Clone (public Reddit-style feed with FAQ schema), Website Indexer, Classifieds (65 countries × 10 sites + free translation to 18 languages), Video Creator (pending), Social Poster (pending). Plus Business management (multi-tenant), Flutterwave billing in **USD ($35/mo)**, click tracking, admin panel, help center, PWA, 20-min idle logout, mobile-responsive dashboard.

**Stack:** Next.js 14 App Router + Tailwind v4 + Prisma + Neon PostgreSQL + NextAuth v4 + Flutterwave (billing) + optional Python FastAPI microservice (video, pending).

- **Local path:** `C:\Projects\auto-traffic-engine`
- **GitHub:** https://github.com/jibriliks-ai/auto-traffic-engine (branch: `main`)
- **Live URL:** `https://auto-traffic-engine.onrender.com`
- **Database:** Neon PostgreSQL — project `neondb` at `ep-still-frost-bdaqs46c.c-8.us-east-2.aws.neon.tech`

---

## 2. Deployment state — GREEN ✅

- **Latest working commit:** "Update to $35 pricing, add 5/day Q&A limit UI, admin docs"
- **Node:** 20.x on Render (pinned via `"engines": {"node": "20.x"}`)
- **Prisma:** 5.22.0 with `provider = "postgresql"` + `directUrl = env("DATABASE_URL_UNPOOLED")`
- **Build command:** `npm install && npx prisma generate && npx prisma db push && npm run build`
- **Start command:** `npm start`
- **All 10 DB tables pushed:** User, Account, Session, VerificationToken, Business, Submission, Video, SocialAccount, QAPost, Payment
- **Extra `Submission.type` value in use:** `"qa_activity"` — tracks Q&A usage (search + draft) for daily limit enforcement

---

## 3. Environment variables (both local `.env` and Render Environment)

```bash
# APP
NEXT_PUBLIC_APP_NAME="Auto Traffic Engine"
NEXT_PUBLIC_GOOGLE_ENABLED=false
NEXT_PUBLIC_PREMIUM_PRICE_DISPLAY="$35"

# DATABASE (Neon — pooled for runtime, unpooled for migrations)
DATABASE_URL="postgresql://...@ep-still-frost-bdaqs46c-pooler.c-8.us-east-2.aws.neon.tech/neondb?sslmode=require"
DATABASE_URL_UNPOOLED="postgresql://...@ep-still-frost-bdaqs46c.c-8.us-east-2.aws.neon.tech/neondb?sslmode=require"

# AUTH
NEXTAUTH_SECRET=<64 hex chars>
NEXTAUTH_URL=https://auto-traffic-engine.onrender.com    # local: http://localhost:3000

# AI (at least ONE must be set — SEO Fix, Q&A Draft, Classifieds all depend on this)
OPENAI_API_KEY=<key>       # OR
DEEPSEEK_API_KEY=<key>

# INDEXNOW
INDEXNOW_KEY=<32 hex chars>

# FLUTTERWAVE BILLING (USD pricing — $35/mo)
FLUTTERWAVE_SECRET_KEY=FLWSECK_TEST-<real test key>
FLUTTERWAVE_SECRET_HASH=<random string matching Flutterwave dashboard webhook>
FLUTTERWAVE_PREMIUM_AMOUNT=35
FLUTTERWAVE_CURRENCY=USD
# Fallback if Flutterwave rejects USD (some accounts only support NGN):
#   FLUTTERWAVE_PREMIUM_AMOUNT=52500
#   FLUTTERWAVE_CURRENCY=NGN
#   NEXT_PUBLIC_PREMIUM_PRICE_DISPLAY="$35 (≈ ₦52,500)"

# OPTIONAL
MYMEMORY_EMAIL=<email>              # raises MyMemory translation limit from 5k to 50k chars/day
GOOGLE_SERVICE_ACCOUNT_JSON=
LEADS_WEBHOOK_URL=
PAGESPEED_API_KEY=
VIDEO_SERVICE_URL=
VIDEO_SERVICE_TOKEN=
ELEVENLABS_API_KEY=
UPLOADTHING_TOKEN=
FACEBOOK_APP_ID=
FACEBOOK_APP_SECRET=
TWITTER_CLIENT_ID=
TWITTER_CLIENT_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=