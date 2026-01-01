# Changelog

## 2025-12-31 - AI SDK v6 Compatibility & Deep Research Background Mode

### Fixed

#### AI SDK v6 Streaming Compatibility
- **Server streaming method**: Changed from `toDataStreamResponse()` to `toUIMessageStreamResponse()`
  - The v6 SDK renamed this method; old code caused "not a function" errors
  - Location: `src/routes/api/chat/+server.ts:143`

- **Multi-step execution**: Changed from `maxSteps: 10` to `stopWhen: stepCountIs(10)`
  - AI SDK v6 replaced `maxSteps` with `stopWhen` condition
  - Default was `stepCountIs(1)` which stopped after first tool call
  - Location: `src/routes/api/chat/+server.ts:83`

#### Deep Research API Endpoint
- **API endpoint**: Changed from `/v1/chat/completions` to `/v1/responses`
  - The `o4-mini-deep-research` model only works with the Responses API
  - Location: `src/lib/tools/deep-research.ts:62`

- **Request format**: Updated to match Responses API schema
  - Changed `messages` array to `input` array with role/content structure
  - Added `reasoning: { summary: 'auto' }` parameter
  - Added `background: true` for async execution
  - Location: `src/lib/tools/deep-research.ts:68-81`

#### SvelteKit Environment Variables
- **API key handling**: Added setter functions for tools
  - SvelteKit doesn't expose `.env` to `process.env`
  - Tools now receive API keys via `setOpenAIApiKey()` and `setTavilyApiKey()`
  - Server passes keys from `$env/static/private` at request time
  - Locations: `src/lib/tools/deep-research.ts:11-13`, `src/lib/tools/tavily-search.ts`

### Added

#### Background Mode with Polling
- **Async deep research**: Implemented proper background mode workflow
  - Submit request with `background: true`, receive response ID
  - Poll `GET /v1/responses/{id}` every 5 seconds until completion
  - 10-minute timeout safeguard
  - Detailed progress logging during polling
  - Location: `src/lib/tools/deep-research.ts:31-282`

#### Client-Side Chat Class
- **@ai-sdk/svelte Chat class**: Refactored frontend to use official Chat class
  - Replaces manual stream parsing that was incompatible with v6 SSE format
  - Uses `DefaultChatTransport` for API communication
  - Handles `text-delta`, `tool-invocation`, and other v6 event types automatically
  - Location: `src/routes/+page.svelte:3-4, 24-73`

### Changed

#### Deep Research Workflow
**Before** (broken):
```
POST /v1/chat/completions → Wait for response → Timeout/fail
```

**After** (working):
```
POST /v1/responses (background: true) → Get response ID
Poll GET /v1/responses/{id} every 5s → Status: queued/in_progress
Continue polling → Status: completed → Extract content
```

- Typical completion time: 2-5 minutes per subtopic
- All 5 subtopics run in parallel
- Progress logged to `research-output/logs/dev-YYYY-MM-DD.jsonl`

### Performance

Tested with "quantum computing basics" research:
| Section | Duration | Content Length |
|---------|----------|----------------|
| 01 - Core concepts | 177s | 8,870 chars |
| 02 - Qubits and gates | 333s | 16,681 chars |
| 03 - Quantum algorithms | 251s | 20,527 chars |
| 04 - Error correction | 250s | 21,854 chars |
| 05 - Ecosystem & apps | 329s | 16,341 chars |

Total output: ~86 KB of comprehensive research with citations.

---

## 2025-12-25 - Model Updates & UX Improvements

### Changed

#### Model Updates
- **Orchestrator Agent**: Updated from `gpt-4o` to `gpt-5.2-2025-12-11`
  - Location: `src/lib/agents/orchestrator.ts:40`

- **Deep Research Tool**: Updated from `o3-mini` to `o4-mini-deep-research-2025-06-26`
  - Location: `src/lib/tools/deep-research.ts:34`

#### API Key Validation
- Added server-side API key validation in chat endpoint
  - Returns 500 error with detailed message when keys are missing
  - Location: `src/routes/api/chat/+server.ts`

- Added new config endpoint to check API key status
  - Endpoint: `GET /api/config`
  - Returns: `{ openaiConfigured, tavilyConfigured, allConfigured }`
  - Location: `src/routes/api/config/+server.ts`

- Added client-side configuration check with UI feedback
  - Yellow warning banner displays when API keys are missing
  - Shows which specific keys need to be configured
  - Banner appears on page load before any errors occur
  - Location: `src/routes/+page.svelte:71-93`

#### Favicon
- Replaced Vite default favicon with custom research icon
  - SVG format for crisp display at all sizes
  - Blue brain/lightbulb design matching app theme
  - Location: `static/favicon.svg`
  - Updated reference in `src/app.html:5`

#### Bug Fixes
- Fixed `useChat` import to use `chat` from `@ai-sdk/svelte`
  - Resolves "useChat is not a function" error
  - Location: `src/routes/+page.svelte:2,5`

### Added

#### New Files
- `src/routes/api/config/+server.ts` - API key validation endpoint
- `static/favicon.svg` - Custom favicon icon

#### New Styles
- `.config-warning` - Warning banner container
- `.warning-content` - Warning message layout
- `.warning-details` - Individual warning items
- Location: `src/routes/+page.svelte:211-245`

### User Experience Improvements

**Before**:
- Page would crash with 500 error if API keys missing
- No clear indication of what was wrong
- Vite logo in browser tab

**After**:
- Page loads successfully even without API keys
- Clear, friendly warning banner explains what's needed
- Custom research icon in browser tab
- Better error messages guide user to fix configuration

### Breaking Changes
None - all changes are backward compatible

### Migration Notes
If you have an existing `.env` file, no changes are needed. The new models will be used automatically.

### Testing
1. Test with missing API keys - should show warning banner
2. Test with valid API keys - should work normally
3. Check browser tab for new favicon
4. Verify models are using gpt-5.2 and o4-mini-deep-research

### Documentation Updates
- Updated README.md with new model names
- Updated configuration examples in README.md
