# Deep Research Agent – Warp Project Guide

## Purpose

This file defines project-specific conventions for how we work on this repo together in Warp.

Goals:
- Keep a clear mental model of how the AI layers fit together
- Make debugging easier with good runtime logs **and** code-change logs
- Avoid “mystery fixes” by recording why we changed things

## Core Stack Mental Model

### Runtime layers

- **SvelteKit app**
  - UI (`src/routes/+page.svelte`) calls `/api/chat`, `/api/config`, `/api/open-finder`.
- **Vercel AI SDK (`ai`)**
  - Primary interface for chat/streaming.
  - `streamText` is used in `src/routes/api/chat/+server.ts`.
- **OpenAI provider (`@ai-sdk/openai`)**
  - Exports `openai(modelId)`, which returns a **spec v2** `LanguageModel` compatible with AI SDK 6.
  - We should prefer this whenever we talk directly to OpenAI from SvelteKit routes.
- **Mastra (`@mastra/core`)**
  - Provides higher-level `Agent` and tooling abstractions.
  - Internally bundles its own AI SDK provider shim (historically based on spec v1 / older `ai`), which can conflict with our top-level `ai@6`.

### Important current decision: orchestrator model

- We use Mastra’s `Agent` for:
  - **Instructions** (system prompt for orchestration)
  - **Tools** (`tavilySearch`, `deepResearch`)
- We **do NOT** use `orchestratorAgent.model` with `streamText`.
  - Reason: that model is backed by Mastra’s internal provider (spec v1), which triggers `AI_UnsupportedModelVersionError` when passed to AI SDK 6.
- Instead, in `src/routes/api/chat/+server.ts` we call:
  - `model: openai('gpt-5.2-2025-12-11')`
- Mental model:
  - Mastra owns **orchestration logic and tools**.
  - The top-level app owns **which concrete OpenAI model** we use and talks to it via `@ai-sdk/openai`.

If/when Mastra’s 1.x line stabilizes around AI SDK 6 providers, we can reconsider delegating model selection back to Mastra.

## Runtime Dev Logging (already implemented)

- JSONL logs written to `research-output/logs/dev-YYYY-MM-DD.jsonl`.
- Logged categories include:
  - `chat.request`, `chat.response`, `chat.error`
  - `api.external.request` / `api.external.response`
  - `tool.start` / `tool.success` / `tool.error`
  - `system.config.check`, etc.
- We deliberately **do not** log full LLM-generated content, to preserve context window when pasting logs into AI assistants.

See `README.md` → "Dev Logging & Telemetry" for operational details.

## Code-Change Devlog Conventions

In addition to runtime logs, we want a lightweight way to remember **why** we changed code.

### 1. Session notes (human-authored)

For now, we’ll keep this simple and low-friction:
- When we make a non-trivial change, we add a short bullet to this section summarizing:
  - **Symptom** – what we observed (error message, behavior, log snippet)
  - **Diagnosis** – what we believe was actually wrong
  - **Change** – what we changed in the code
  - **Validation** – how we verified the fix (or what is still uncertain)
  - **Risk/Follow-ups** – anything we are deferring

#### Recommended template

```text
YYYY-MM-DD – Short title
- Symptom: ...
- Diagnosis: ...
- Change: ...
- Validation: ...
- Risk/Follow-ups: ...
```

#### Devlog entries

- 2025-12-27 – Chat route model wiring
  - Symptom: Chat requests to `/api/chat` failed with `AI_UnsupportedModelVersionError` complaining that model `gpt-5.2-2025-12-11` on provider `openai.chat` only supported spec version `v1`, but AI SDK 5+ requires `v2`.
  - Diagnosis: `orchestratorAgent.model` is backed by Mastra's internal AI SDK v4 provider (spec v1). Passing that into `streamText` from our top-level `ai@6` caused the spec-version mismatch.
  - Change: In `src/routes/api/chat/+server.ts`, stopped using `orchestratorAgent.model` and instead passed `openai('gpt-5.2-2025-12-11')` from `@ai-sdk/openai`. Kept using `orchestratorAgent.instructions` and `orchestratorAgent.tools`.
  - Validation: Confirmed dev server booted and that the error in the logs pointed to the old code path. Further end-to-end validation is pending while we resolve separate "Load failed" network behavior.
  - Risk/Follow-ups: Mastra still depends on an older AI SDK internally; longer term we may want to upgrade to Mastra 1.x once its AI SDK 6 integration is stable and revisit delegating model selection back to Mastra.

- 2025-12-27 – "Load failed" network behavior
  - Symptom: UI shows "Sorry, there was an error processing your request: Load failed" for some chat attempts; Safari dev tools show repeated socket entries, but the server-side dev logs do **not** contain new `chat.request` / `chat.error` events for these attempts.
  - Diagnosis: Requests are sometimes failing at the network/transport layer before reaching `/api/chat`. Root cause is not yet known; at minimum, it is distinct from the earlier `AI_UnsupportedModelVersionError` (because no new server logs are produced).
  - Change: No functional fix yet. We clarified this as a separate class of failure and rely on JSONL logs + browser network panel to distinguish it from server-side errors.
  - Validation: Verified via `dev-YYYY-MM-DD.jsonl` that the last recorded `chat.request` is from an earlier run; subsequent "Load failed" attempts leave no new server log entries.
  - Risk/Follow-ups: Need a structured investigation procedure (check dev-server console output, curl `/api/config` and `/api/chat`, confirm SvelteKit dev server process state). Future fixes should add a dedicated client-side error state for pure network failures.

Feel free to append more entries like this as we iterate.

### 2. Git discipline (once things stabilize)

When changes start working reliably, we’ll:
- Commit smaller, focused diffs.
- Use commit messages that mirror the devlog entries ("chat route: use @ai-sdk/openai model directly", etc.).
- Optionally keep a higher-level `CHANGELOG.md` if the project grows, but for now `WARP.md` + git history should be enough.

## Collaboration Notes

- Use Vercel AI SDK as the **source of truth** for how streaming and data parts work.
- Treat Mastra as an orchestration layer; be cautious when Mastra’s internals depend on a different AI SDK major version than the app.
- When we see confusing behavior ("Load failed", hanging, etc.), we should:
  1. Check dev JSONL logs for `chat.request`/`chat.error`.
  2. Capture the stack trace and add a devlog bullet here when we implement a fix.
