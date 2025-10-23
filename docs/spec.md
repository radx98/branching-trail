# General Description
This project is a tool for exploring available options, creative search and brainstorming. It lets user add a single initial prompt and then iterate on it by choosing branching options from what it suggested. Let's say user wants to build a game but not shure what kind of game. They start new session by typing in "browser game" and get 4 options: "Strategy and Simulation Games, Action and Adventure Games, Puzzle and Logic Games, Role-Playing and Story-Driven Games". They choose one of them and it creates 4 new ones. Each of the 4 options on each step has "add prompt" button to specify whatever is needed. There's also 5th option - "specify" - that acts the same way as "add prompt" but is not added to an existing option and exists separately. Option titles are always generated and immutable. Prompts created by the user are editable; editing any prompt (including the initial one) refreshes its four options and removes its descendants before new ones are generated.

# User Experience
The project looks like a ChatGPT window but instead of the chat section there's a canvas for the tree-like structure created by user. Sidebar consists of a name of the app, "new" button, and a list of sessions/trees. When user clicks "new" button, a block for the initial prompt is created on the newly opened canvas. It contains an input field and a "send" button. After sending input field is replaced with the prompt text. On the right from it 5 new blocks are created. 4 for the options that had just been generated and the 5th is a "specify" button. All of them connected to the initial prompt block with arrows.

If user clicks one of the options the process is repeated, 4 options and "specify" button connected to the parent option by arrows are created. New sets of options appear only when all four titles are ready; the user sees a loading state while waiting.

If user clicks "add prompt" next to one of the options, an input field with a submit button appers under the title and on submission this prompt is added under the option name. Under the hood it added as the "prompt". getChildren is called to generate 4 new options. Editing an existing prompt triggers the same regeneration pathway.

If user chooses "specify", its the same but there's no option name, just this new prompt with 4 new options generated on the right. Under the hood, 5th child is added to the same parent with this prompt and with empty title. getChildren is called to generate 4 new options.

# Canvas Primitives
React Flow nodes expose a consistent structure that feeds both the canvas and sidebar components:
- `id`: global identifier for the node.
- `title`: immutable option or session label rendered in the block header.
- `prompt`: editable user-authored text displayed beneath the title when present.
- `variant`: `"prompt" | "option" | "specify"` to switch visual treatments and available actions.
- `status`: `"idle" | "loading" | "error"` used for badges or subtle state indicators in Phase 2.

Sidebar entries reuse the same data (id, title, status) so the Zustand store can keep both views synchronized.

# Visual
All blocks on the canvas have the same style. Soft, modern, rounded. Arrows are curved, start on the right of a block, end on the left of another block. Blocks rely on React Flow's default positioning and collision handling. They can be drag'n'dropped.

Sidebar is fully transparent, only the elements on it are visible. Tree/session names look like they're the same blocks as all the others but stay fixed in the sidebar. When new session is sceated new sidebar item with a placeholder title "New session" is added and canvas is opened. There's only one block on the canvas - initial prompt input. After submitting the initial prompt, session name is generated and added to the sidebar. Input field on the initial prompt block becomes a text and first set of options is generated.

Option names are titles same as session/tree name in the first block. Prompts added by user including initial prompt is plain text. Input field with a submit button is created under the title of a block and removed after submission replaced with the prompt text.

# Architecture Overview
The app runs on Next.js with React and TypeScript, leaning on React Flow for the canvas layout and interactions. A lightweight state store (e.g. Zustand) keeps the active tree in sync across sidebar, canvas, and edit forms. Supabase provides Postgres storage and user authentication. All OpenAI requests go through authenticated Next.js API routes that use a single server-managed API key with no fallback path or usage limits. Styling is built with Tailwind CSS. No realtime collaboration, linters, or formatters are included in this scope.

# Data & API
Each session is saved as a row in Supabase: `id`, `user_id`, `title`, `tree_json` (jsonb), `created_at`, `updated_at`, `token_usage`. `tree_json` stores the entire nested branch structure starting at the root: every node contains an `id`, immutable `title`, editable `prompt`, and a `children` array in tree order. The client mutates the in-memory tree and calls API routes only for operations that need generation: naming the session and expanding or refreshing a node. Key endpoints:
- `POST /api/sessions` create a tree, generate the session name, return the tree JSON.
- `POST /api/tree/{id}/expand` regenerate children for a node (option click, specify, or prompt edit).
Server handlers validate Supabase auth, verify session ownership, update prompts, prune descendants, call OpenAI, and persist the new snapshot. As OpenAI responses stream in, the backend forwards generated text to the client and writes it to the database immediately. Errors roll back mutations and return retryable failures.

# Under the Hood
The whole tree is described by a JSON and is updated as soon as the JSON is updated. It looks like this (example):
```json
{
  "id": "root-uuid",
  "title": "Browser game", // generated after receiving the initial prompt by getSessionName() and used on the sidebar as a session name
  "prompt": "", // initial prompt, user input; added at the moment of creation of the json and the tree
  "children": [ // first 4 children generated right away by getChildren()
    {
      "id": "opt-1",
      "title": "Strategy and Simulation Games",
      "prompt": "", // added when Add prompt button next to the option name is used; same for all other children and subchildren
      "children": [] // generated by getChildren() when this option is clicked; same; same for all other children and subchildren
    },
    {
      "id": "opt-2",
      "title": "Action and Adventure Games",
      "prompt": "",
      "children": []
    },
    {
      "id": "opt-3",
      "title": "Puzzle and Logic Games",
      "prompt": "",
      "children": [
        {
          "id": "opt-3-1",
          "title": "Physics-Based Puzzles",
          "prompt": "",
          "children": []
        },
        {
          "id": "opt-3-2",
          "title": "Word and Language Games",
          "prompt": "",
          "children": [
            { "id": "opt-3-2-1", "title": "Crossword and Anagram Games", "prompt": "", "children": [] },
            { "id": "opt-3-2-2", "title": "Typing Speed and Accuracy Games", "prompt": "", "children": [] },
            { "id": "opt-3-2-3", "title": "Vocabulary and Definition Challenges", "prompt": "", "children": [] },
            {
              "id": "opt-3-2-4",
              "title": "Word Association and Chain Games",
              "prompt": "",
              "children": [
                { "id": "opt-3-2-4-1", "title": "Classic Word Chain (last-letter linking)", "prompt": "", "children": [] },
                { "id": "opt-3-2-4-2", "title": "Thematic Association (connect by meaning or topic)", "prompt": "", "children": [] },
                { "id": "opt-3-2-4-3", "title": "Opposites and Antonyms Chain", "prompt": "", "children": [] },
                { "id": "opt-3-2-4-4", "title": "Synonym Relay", "prompt": "", "children": [] }
              ]
            }
          ]
        },
        { "id": "opt-3-3", "title": "Match-Three and Tile-Matching Games", "prompt": "", "children": [] },
        { "id": "opt-3-4", "title": "Logic and Riddle Challenges", "prompt": "", "children": [] }
      ]
    },
    {
      "id": "opt-4",
      "title": "Role-Playing and Story-Driven Games",
      "prompt": "",
      "children": []
    }
  ]
}
```
"Specify" button exists in UI only until used. If user does so, a new child is added to the same parent the button comes from. The block is updated then to become a new option with a newly added prompt but without a name/title. New "specify" button is added automatically by the UI because (no addidional functions or rules, it's created always in addition to the existing options/children). Once converted, the specify node keeps an empty title, displays the user prompt as the body text, and supports further branching exactly like a titled option.

# Implementation Plan

## Phase 1 — Project Foundation
- Scaffold the Next.js + TypeScript app and install dependencies: React Flow, Zustand, Tailwind CSS, Supabase client, OpenAI SDK, Zod.
- Configure Tailwind (global styles, typography, basic theme tokens) and establish shared UI primitives for blocks, buttons, and sidebar items.
- Set up basic Supabase client integration (auth context, fetch helper) and environment variable wiring for Supabase and OpenAI keys.

## Phase 2 — Canvas & Sidebar UX
- Implement session list sidebar with create-new flow, placeholder naming, and in-memory session switching.
- Build the React Flow canvas with node/edge types for prompts, options, and specify buttons using default layout behavior.
- Add drag/drop, loading placeholders, and prompt editing UI on nodes; ensure descendant pruning visuals and state synchronization with sidebar.

## Phase 3 — API & Persistence
- Create Supabase tables and SQL helpers for session CRUD; wire state store to persist `tree_json` snapshots.
- Implement Next.js API routes for session creation and node expansion, including payload validation with Zod.
- Integrate OpenAI calls with streamed responses forwarded to the client while persisting debounced partial updates in Supabase so the tree stays close to real time.

## Phase 4 — Polish & Hardening
- Refine error handling: rollback UI state on failures, surface retry controls, and gate inputs while requests are in flight. Unauthenticated local usage is fine during early development, but production flows must enforce Supabase auth.
- Add token usage tracking, session title generation, and empty states for new users.
- Tighten security (auth guards on API routes, per-user ownership checks) and clean up UI details (responsive tweaks, loading animations, specify button lifecycle).
