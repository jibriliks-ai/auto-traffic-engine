# Auto Traffic Engine — Project Handoff

**Last updated:** Billing module complete (Flutterwave working in test mode)
**Paste this entire file at the start of any new chat to restore full context.**

---

## 1. What this project is

A production SaaS "4-in-1 marketing bot" (originally spec'd as "SAARS"). Next.js 14 App Router + Tailwind v4 + Prisma + NextAuth + Python FastAPI microservice for video. Six modules: SEO Audit, Q&A Finder, Classifieds, Indexer, Video Creator, Social Poster. Plus Admin panel, Flutterwave billing, click tracking, dark/light mode.

- **Project path:** `C:\Projects\auto-traffic-engine`
- **Local dev URL:** `http://localhost:3000`
- **GitHub repo:** not pushed yet
- **Render:** not deployed yet
- **Production target:** Render (Web Service + PostgreSQL + optional Docker microservice for video)

---

## 2. Environment status (verified working)

- **Node version:** v20.x LTS — downgraded from v24 because NextAuth v4 fails on Node 24
- **Database (local):** SQLite at `prisma/dev.db`
- **Database (production):** PostgreSQL on Render
- **Schema compatibility:** written to work identically on SQLite and PostgreSQL (no `@db.Text`, no `Json` types)
- **Auth:** NextAuth v4, credentials + optional Google OAuth (disabled by default)
- **Test user created:** yes, via `/register`, password hashed with bcryptjs

---

## 3. Directory structure (current, all files exist)
