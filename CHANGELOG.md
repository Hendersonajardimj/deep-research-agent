# Changelog

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
