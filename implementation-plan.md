<!-- ABOUTME: Outlines implementation phases for the branching prompt tree app -->
<!-- ABOUTME: Tracks tasks from environment setup through deployment handoff -->

# Implementation Plan

## Phase 0 – Foundations
1. **Repository Hygiene**
   - Confirm git status, branch from `main`, capture existing spec/plan snapshots.
2. **Environment Setup**
   - Configure Node version, install dependencies, set up Next.js workspace with TypeScript, ESLint, Prettier.
   - Integrate React Flow, Zustand, Supabase client; stub .env values (OpenAI key placeholder, Supabase config).
3. **Supabase Project Preparation**
   - Provision project, enable Auth (email/password).
   - Create `trees` table with RLS policies; set up migration scripts.

## Phase 1 – Authentication & Session Shell
1. **Auth Plumbing**
   - Implement Supabase Auth UI (sign up, login, logout) using server components + client hooks.
   - Protect app routes, redirect unauthenticated users to auth screen.
2. **Session List Skeleton**
   - Build sidebar layout with New Session button and placeholder tree list pulling from Supabase.
   - Implement `/api/sessions` POST and GET; wire optimistic creation with “New session” placeholder title.

## Phase 2 – Core Tree Rendering
1. **State Management**
   - Establish Zustand store for active tree (nested JSON, selection, loading flags).
   - Build selectors that flatten the nested tree into React Flow node/edge arrays and keep them recomputed on updates.
2. **Canvas UI**
   - Configure React Flow with custom node/edge components matching visual spec.
   - Implement drag, pan, zoom, and collision spacing behaviors.
3. **Sidebar ↔ Canvas Sync**
   - Link session tiles to set active tree; render connecting arrow from sidebar block to root node when active.

## Phase 3 – Generation Workflow
1. **API Routes**
   - `/api/tree/{id}/expand`: validate auth, accept node ID + prompt text, prune descendants, call OpenAI, return four titles.
   - `/api/session-name`: generate title for root prompt.
   - Add shared utilities for OpenAI prompts, rate limiting, error handling, and Supabase persistence.
2. **Client Actions**
   - New prompt submission triggers loading state, calls expand endpoint, merges returned subtree.
   - Implement Specify flow injecting empty-title child before generation.
   - Handle errors with inline retry and toast notifications.

## Phase 4 – Editing & Regeneration
1. **Prompt Editing**
   - Enable inline edit for prompts with auto-save on blur/submit.
   - Regenerate children via expand API and reset downstream state.
2. **Session Title Update**
   - Allow sidebar title rename post-generation; persist to Supabase.
3. **Loading & UX Polish**
   - Ensure spinners, disabled states, and animations (option appearance, node spacing) match spec.

## Phase 5 – Persistence & Performance
1. **Sync Strategy**
   - Confirm full nested snapshot writes keep client/server in sync; add debounce/throttle where needed when persisting the JSON blob.
2. **Caching & Prefetch**
   - Prefetch recent sessions for quick switching; implement stale-while-revalidate pattern.
3. **Token & Rate Monitoring**
   - Store token usage metrics, surface warnings via UI.

## Phase 6 – QA & Deployment
1. **Testing**
   - Add unit tests for API utilities, integration tests for expand route, component tests for tree interactions.
   - Exercise Supabase RLS via automated test suite.
2. **Manual QA**
   - Run end-to-end flow: auth, session creation, prompt edits, regeneration, persistence.
3. **Deployment Prep**
   - Configure environment secrets, set up CI for lint/test, deploy to Vercel (Next.js) and align Supabase env.
4. **Launch Checklist**
   - Verify telemetry/logging, document incident response basics, hand off operations notes.
