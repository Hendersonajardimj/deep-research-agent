# AGENTS.md – Deep Research Agent

Project-specific guidance for automated agents working in this repository. This file **specializes** your global orchestration / telemetry rule for the `deep-research-agent` app.

## 1. Project overview (for agents)

- **Framework:** SvelteKit + Svelte 5 (TypeScript)
- **AI layer:**
  - Mastra `Agent` for orchestration and tools (`tavilySearch`, `deepResearch`)
  - Vercel AI SDK 6 (`ai`) for chat streaming
  - OpenAI models via `@ai-sdk/openai` and the Responses API
- **Key runtime paths:**
  - `src/lib/agents/orchestrator.ts` – main Mastra agent configuration
  - `src/lib/tools/tavily-search.ts` – Tavily web search tool
  - `src/lib/tools/deep-research.ts` – deep research tool using OpenAI
  - `src/lib/utils/file-operations.ts` – markdown file + frontmatter logic
  - `src/lib/utils/pdf-generator.ts` – PDF generation
  - `src/routes/api/chat/+server.ts` – main chat API endpoint
  - `src/routes/api/open-finder/+server.ts` – Finder integration
  - `src/routes/+page.svelte` – main UI
- **Runtime artifacts:**
  - Research reports: `research-output/<topic-slug>/*.md` (+ optional `*.pdf`)
  - Dev logs: `research-output/logs/dev-YYYY-MM-DD.jsonl`

Agents should treat `WARP.md`, `PROJECT_SUMMARY.md`, and `CUSTOMIZATION.md` as **authoritative context** about architecture and customization.

---

## 2. Telemetry & sessions in this repo

Follow the global rule, with these project-specific defaults:

- Always prefer to work **inside a session**:
  - If `AGENT_SESSION_ID` is unset and you are doing more than a trivial edit, propose and set it.
  - Example export (to propose once and then assume):
    - `export AGENT_SESSION_ID=deep-research-<short-slug>-$(date +%Y%m%d-%H%M%S)`
- Assume a telemetry wrapper `tt` exists on PATH with the contract described in the global rule.
  - Canonical location: `~/agent-tools/telemetry/tt` (agents may call this directly if PATH is misconfigured).
- In this repo, any non-trivial command should go through `tt`:
  - `tt npm run dev`
  - `tt npm run build`
  - `tt npm run preview`
  - `tt codex exec --full-auto "..."`

> When you need to understand failures or unexpected behavior, prefer using `research-output/logs/dev-*.jsonl` (via `tt`-captured commands or manual `jq` filters) instead of blindly re-running expensive commands. You can also inspect per-command telemetry in `~/.agent-telemetry/$AGENT_SESSION_ID/` (one `.meta.json` + `.out.log` + `.err.log` per `tt` run).

---

## 3. Commands and environment for agents

### 3.1. Environment variables

Agents should expect these env vars (see `.env.example` and `README.md`):

- `OPENAI_API_KEY` – required for all OpenAI calls
- `TAVILY_API_KEY` – required for web search
- `RESEARCH_OUTPUT_DIR` – default `./research-output`
- Optional logging controls:
  - `ENABLE_DEV_LOGGING` (default true in dev)
  - `DEV_LOG_ECHO` (echo logs to console)

Do **not** hard-code secrets in committed files. Assume they are already present in `.env` when running commands.

### 3.2. Core commands (wrap with `tt` for telemetry)

- Start dev server:
  - `tt npm run dev`
- Build production bundle:
  - `tt npm run build`
- Preview production build:
  - `tt npm run preview`

There is currently **no dedicated automated test suite** beyond build/startup and behavioral checks. When asked to "run tests" in this repo, default to:

1. `tt npm run build` (compilation sanity)
2. `tt npm run dev` + manual / browser-based flows

If you introduce automated tests in the future (e.g., Vitest, Playwright), update this file with the canonical test commands and prefer those.

---

## 4. Codex delegation guidelines for this repo

Use Codex CLI for non-trivial, multi-file changes, following the global rule with these repo-specific constraints.

### 4.1. Default allowed areas for Codex

By default, when preparing `codex exec` prompts, treat these paths as **safe for edits** (unless the human narrows it further):

- `src/lib/agents/**`
- `src/lib/tools/**`
- `src/lib/utils/**`
- `src/routes/api/**`
- `src/routes/+page.svelte`
- `CUSTOMIZATION.md` (when updating docs to match behavior)

Treat these as **write-with-care**:

- `WARP.md` – project guide and devlog; only edit if explicitly asked.
- `PROJECT_SUMMARY.md` – high-level overview; keep consistent with actual architecture.
- Logging internals in `src/lib/utils/**` – changes here affect debuggability; prefer minimal, well-justified edits.

Treat these as **data / runtime artifacts**, not code:

- `research-output/**` – generated content and logs. Do **not** ask Codex to edit these files directly; they should be produced/consumed by the app and tooling.

### 4.2. Branch & session naming

When you need a feature/fix branch for Codex work, propose names like:

- Branch: `codex/deep-research-<slug>-<yyyy-mm-dd>`
- Session: `deep-research-<slug>-<yyyy-mm-dd>`

Example:

- Branch: `codex/deep-research-load-failed-2025-12-28`
- Session: `deep-research-load-failed-2025-12-28`

### 4.3. Prompt content hints for this repo

When you build `codex exec` prompts in this repo, your **Context** section should usually mention:

- SvelteKit front-end in `src/routes/+page.svelte`
- API layer in `src/routes/api/chat/+server.ts` and `open-finder/+server.ts`
- Mastra orchestrator in `src/lib/agents/orchestrator.ts`
- Tools in `src/lib/tools/tavily-search.ts` and `src/lib/tools/deep-research.ts`
- File system utilities in `src/lib/utils/file-operations.ts` and `pdf-generator.ts`
- JSONL dev logging in `research-output/logs/dev-YYYY-MM-DD.jsonl`

For **Tests** in prompts, since no formal tests exist yet, instruct Codex to:

- Ensure `npm run build` succeeds.
- Ensure `npm run dev` starts without runtime errors in the console.
- Optionally describe manual acceptance steps (e.g., start dev server, open `http://localhost:5173`, run a deep research flow, confirm outputs in `research-output/`).

---

## 5. Logs & debugging workflow for agents

When debugging issues in this repo, agents should:

1. **Check dev JSONL logs** in `research-output/logs/dev-YYYY-MM-DD.jsonl`.
2. Filter by:
   - `category` (e.g., `chat.request`, `chat.error`, `tool.error`, `api.external.*`).
   - `requestId` to correlate client/server/tool events.
3. Use `jq`-style filters (run via `tt` when scripting) to pull a minimal, relevant slice of events that can be pasted into AI context if needed.

If asked to "summarize what happened" for a given failure, build your explanation from these logs plus any telemetry from `tt` (command metadata + exit codes).

---

## 6. Browser & manual flows

This project already has strong server-side logging; for front-end and network issues:

- Prefer using the existing SvelteKit dev server (`npm run dev`) plus the browser network/console panels.
- If local browser CLI tools (e.g., `browser-start`, `browser-nav`, `browser-eval`, `browser-screenshot`, `browser-pick`) are available (for example under `~/agent-tools/browser-tools` and placed on PATH), you may plan to use them as described in the global rule, wrapped with `tt`.
- For now, do **not** assume any project-specific browser CLI scripts live inside this repo; treat them as external tools.

### 6.1. End-to-end deep research verification loop (for agents)

When asked to verify that a change to this codebase still produces correct deep-research behavior, a reasonable automated plan is:

1. Start or restart the dev server under telemetry:
   - `tt npm run dev`
2. Start a browser session via CLI tools (if available):
   - `tt browser-start --profile`
3. Navigate to the app:
   - `tt browser-nav http://localhost:5173 --new`
4. Use browser tools to drive the UI (if configured):
   - Use `browser-eval` to set a research query in the input and trigger the send button, or
   - Ask the human to use `browser-pick` to select key DOM elements and then derive stable selectors.
5. Wait for the deep research run to complete, then verify:
   - New markdown/PDF files appear under `research-output/<topic-slug>/`.
   - Corresponding dev log entries exist in `research-output/logs/dev-YYYY-MM-DD.jsonl` for the request.

When investigating UI problems:

- Use logs (`chat.request`, `chat.error`, `network.*`) to distinguish server-side failures from pure network/transport issues.
- Keep `WARP.md` devlog entries up to date only when explicitly asked.

---

## 7. Default end-to-end flow for agents in this repo

When the human asks you to modify or debug this project, your default behavior should be:

1. **Restate the task** in terms of Deep Research Agent components (UI, chat route, orchestrator, tools, file ops, logs).
2. **Ensure a session** (`AGENT_SESSION_ID`) and, if Codex work is involved, a suitable `codex/deep-research-...` branch.
3. **Plan the loop**, referencing this file for:
   - Which files are in scope
   - Which commands to run (all via `tt`)
   - How to use dev logs and `research-output/` artifacts as evidence
4. **Execute** the smallest viable number of Codex delegations, interleaved with builds / dev runs.
5. **Verify** behavior using:
   - `tt npm run build`
   - `tt npm run dev` + manual/browser-based deep research runs
   - Inspection of `research-output/` and JSONL logs
6. **Summarize** conceptually what changed and which evidence supports that it works.

If any step would require ignoring telemetry, altering global behavior outside this repo, or rewriting core logging/orchestration patterns in a risky way, **stop and ask the human before proceeding.**
