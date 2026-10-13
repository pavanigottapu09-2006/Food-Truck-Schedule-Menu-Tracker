# 🚚 Food Truck Schedule & Menu Tracker

Modern, responsive web app to manage food trucks, live schedules, menus, AI specials and exports.

**Stack:** Next.js 16 (App Router) + Tailwind CSS 4 · API Route Handlers · Supabase (PostgreSQL + Realtime) · Built-in AI copilot (offline heuristic, upgrades to LLM) · Vercel-ready

## Milestones
- [x] 1. Understand requirements & architecture
- [x] 2. Setup Next.js & Tailwind frontend UI
- [x] 3. Connect Supabase database persistence
- [x] 4. Include AI model for automated generation
- [x] 5. Deploy application to Vercel

## Features
- **Dashboard & overview:** stats (trucks / open now / stops / dishes / rating)
- **Interactive cards + data table:** search, cuisine + status filters, view toggle
- **Real-time status updates:** 30s live clock, one-click status cycling, Supabase Realtime subscription when configured, localStorage persistence
- **Schedule tracker:** per-truck weekly stops with locations, CSV export
- **Menu manager:** per-truck dishes, availability toggle, add dish, CSV export
- **AI copilot (`/api/ai/generate`):** menu descriptions, daily specials, schedule optimizer, marketing blurbs. Works offline; uses OpenAI-compatible LLM when `OPENAI_API_KEY` is set
- **Export & reporting:** Trucks / Schedule / Menu CSV downloads + printable operations report

## Run locally
```bash
cd food-truck-tracker
npm install
npm run dev
# open http://localhost:3000
```

## Supabase setup (optional — app runs in local mode without it)
1. Create a project at https://supabase.com
2. In SQL Editor, run `supabase/schema.sql`
3. Copy `.env.example` to `.env.local` and fill in:
```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...   # server only
```
4. Restart dev server. The header shows `source: supabase · realtime on`.

## AI setup (optional)
```bash
OPENAI_API_KEY=sk-...
# optional: AI_BASE_URL=https://api.openai.com/v1  AI_MODEL=gpt-4o-mini
```
Without a key, the built-in generator is used (`source: "local"`).

## API
- `GET/POST /api/trucks` · `PATCH/DELETE /api/trucks/[id]`
- `GET/POST/DELETE /api/schedules`
- `GET/POST/DELETE /api/menu-items`
- `GET/POST /api/ai/generate` — `{ task: "menu-description"|"daily-special"|"schedule-optimizer"|"marketing-blurb", input: {...} }`

## Deploy to Vercel
```bash
npm i -g vercel
vercel
# add the env vars above in Vercel Dashboard → Settings → Environment Variables
vercel --prod
```
`vercel.json` is preconfigured for Next.js. See Next deploying docs for details.

## Project layout
```
src/app/page.tsx               → dashboard entry (server) + <DashboardClient/>
src/components/DashboardClient.tsx → full interactive UI ("use client")
src/app/api/...                → trucks, schedules, menu-items, ai/generate
src/lib/types.ts seed.ts store.ts supabaseClient.ts supabaseServer.ts ai.ts
supabase/schema.sql            → tables + realtime + RLS policies
```
