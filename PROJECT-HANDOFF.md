# Auto Traffic Engine — Project Handoff

**Last updated:** Deployed to Render successfully after fixing `qaPost → qAPost` casing across all files.
**Paste this entire file at the start of a new chat to restore full context.**

---

## 1. Project summary

Multi-tenant marketing SaaS: SEO Audit, Q&A Finder (9 sources), Q&A Clone (public Reddit/Lemmy-style feed), Website Indexer, Classifieds, Video Creator, Social Poster. Plus Business management system, Flutterwave billing, click tracking, admin panel (pending), dark/light mode.

**Stack:** Next.js 14 App Router + Tailwind v4 + Prisma + Neon PostgreSQL + NextAuth v4 + Flutterwave (billing) + optional Python FastAPI microservice (video, pending).

- **Local path:** `C:\Projects\auto-traffic-engine`
- **GitHub:** https://github.com/jibriliks-ai/auto-traffic-engine (branch: `main`)
- **Live URL:** `https://auto-traffic-engine.onrender.com` (or whatever Render assigned)
- **Database:** Neon PostgreSQL — project `neondb` at `ep-still-frost-bdaqs46c.c-8.us-east-2.aws.neon.tech`

---

## 2. Deployment state — GREEN ✅

- **Node:** 20.x on Render (pinned via `"engines": {"node": "20.x"}` in `package.json`)
- **Prisma:** 5.22.0 with `provider = "postgresql"` and `directUrl = env("DATABASE_URL_UNPOOLED")`
- **Latest commit on main:** `cf1ec9f` (or newer — the `qaPost → qAPost` fix commit)
- **Build command:** `npm install && npx prisma generate && npx prisma db push && npm run build`
- **Start command:** `npm start`
- **All 10 DB tables pushed to Neon:** User, Account, Session, VerificationToken, Business, Submission, Video, SocialAccount, QAPost, Payment

---

## 3. Environment variables (both local `.env` and Render Environment)

```bash
# APP
NEXT_PUBLIC_APP_NAME="Auto Traffic Engine"
NEXT_PUBLIC_GOOGLE_ENABLED=false

# DATABASE (local: file:./dev.db — but we switched to Neon)
DATABASE_URL="postgresql://...@ep-still-frost-bdaqs46c-pooler.c-8.us-east-2.aws.neon.tech/neondb?sslmode=require"
DATABASE_URL_UNPOOLED="postgresql://...@ep-still-frost-bdaqs46c.c-8.us-east-2.aws.neon.tech/neondb?sslmode=require"

# AUTH
NEXTAUTH_SECRET=<64 hex chars>
NEXTAUTH_URL=https://auto-traffic-engine.onrender.com    # local: http://localhost:3000

# AI (at least ONE must be set, or SEO Fix / Q&A Draft fail)
OPENAI_API_KEY=<key>       # OR
DEEPSEEK_API_KEY=<key>

# INDEXNOW
INDEXNOW_KEY=<32 hex chars>

# FLUTTERWAVE BILLING
FLUTTERWAVE_SECRET_KEY=FLWSECK_TEST-<real test key>
FLUTTERWAVE_SECRET_HASH=<random string matching Flutterwave dashboard webhook>
FLUTTERWAVE_PREMIUM_AMOUNT=25000    # in NGN (major units, NOT kobo)

# OPTIONAL
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