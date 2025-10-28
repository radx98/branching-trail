# Branching Trail

Internal prototype for the branching ideation canvas outlined in `docs/spec.md`.

## Prerequisites

- [Bun](https://bun.sh/) ≥ 1.0

## Environment

Copy `.env.example` and fill in Supabase and OpenAI credentials:

```bash
cp .env.example .env.local
```

The app expects:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`
- `BRANCHING_TRAIL_SESSION_USER_ID` (optional – overrides the shared session namespace when Supabase is configured)

When the service role credentials are not provided in development, the API
automatically falls back to an in-memory session store (shared for all users).
This keeps the Phase 3 flow usable without a full Supabase instance, though
data will reset whenever the server restarts.

## Scripts

Install dependencies (if you ever need to re-install):

```bash
bun install
```

Start the dev server:

```bash
bun run dev
```

Create a production build:

```bash
bun run build
```

> Turbopack may require network access during the build step. In restricted environments the build can fail; rerun once credentials are configured locally.
