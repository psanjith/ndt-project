# NDT Inspection Portal

A multi-tenant marketplace web app for non-destructive testing (NDT) inspections,
with three roles whose data is separated **server-side** via Postgres Row-Level Security:

- **Client** (construction firm) — posts inspection requests
- **Dispatcher** (inspection company) — claims open jobs, assigns inspectors
- **Inspector** — performs the inspection, records Pass/Fail

## Stack

- Front end: Vite + React + Tailwind CSS v4
- Backend: [Supabase](https://supabase.com) — Postgres, Auth, Row-Level Security, Realtime

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Create a free Supabase project at [supabase.com](https://supabase.com).
3. In the Supabase **SQL Editor**, run the contents of [`supabase/schema.sql`](supabase/schema.sql)
   to create the tables and access-control policies.
4. Copy `.env.example` to `.env` and fill in your values from
   **Project Settings → API**:
   ```
   VITE_SUPABASE_URL=https://your-ref.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-public-key
   ```
   The anon key is safe to expose — access is enforced by Row-Level Security, not by hiding it.
5. Start the dev server:
   ```bash
   npm run dev
   ```
   Open http://localhost:5173

## How roles connect

Sign up separate accounts and pick a role during onboarding:

- A **dispatcher** creates an inspection company and gets a **join code** (shown top-right).
- **Inspectors** join that company with the code.
- **Clients** create their own construction firm and post requests, which appear as
  open jobs to every inspection company's dispatchers.
