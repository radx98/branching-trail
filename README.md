# Branching Trail

Internal prototype for the branching ideation canvas outlined in `docs/spec.md`.

## Prerequisites

- [Bun](https://bun.sh/) ≥ 1.0

## Environment

Copy `.env.example` and fill in the OpenAI credentials:

```bash
cp .env.example .env.local
```

The app expects:

- `OPENAI_API_KEY`

Sessions are stored in the browser's local storage, so each browser keeps its
own history even if the dev server restarts.

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
