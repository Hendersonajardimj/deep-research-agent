# Deep Research Agent

A powerful AI-powered deep research tool built with SvelteKit, Mastra, and AI SDK 6. This application orchestrates multiple AI agents to conduct comprehensive research on complex topics, breaking them down into manageable subtopics and generating detailed markdown reports.

## Features

- **Intelligent Research Orchestration**: Main agent breaks down complex topics into 5 focused subtopics
- **Deep Research**: Leverages OpenAI's Deep Research model for comprehensive analysis
- **Web Search Integration**: Uses Tavily API for gathering initial context
- **Human-in-the-Loop**: Approve research outlines before execution
- **Markdown Reports**: Auto-generates well-formatted markdown files with frontmatter metadata
- **PDF Export**: Optional PDF generation from markdown reports
- **Real-time Streaming**: See research progress as it happens with tool streaming
- **Automatic Retry Logic**: Resilient API calls with exponential backoff
- **Local File Management**: Easy access to research files via Finder integration

## Architecture

### Two-Level Agent Hierarchy

1. **Orchestrator Agent** (Mastra-powered)
   - Understands research requests
   - Performs web searches for context
   - Creates 5-subtopic research outlines
   - Coordinates deep research tasks
   - Manages parallel execution

2. **Deep Research Sub-Agents** (OpenAI Responses API)
   - One agent per subtopic
   - Comprehensive research execution
   - Markdown report generation
   - Optional PDF output

## Tech Stack

- **Frontend**: SvelteKit + Svelte 5
- **AI Framework**: Mastra
- **AI SDK**: Vercel AI SDK 6
- **LLM Provider**: OpenAI (GPT-5.2 for orchestration, o4-mini-deep-research for deep research)
- **Search**: Tavily API
- **PDF Generation**: Puppeteer + Marked
- **Language**: TypeScript

## Prerequisites

- Node.js 18+
- npm or pnpm
- OpenAI API key
- Tavily API key

## Setup

1. **Clone the repository**

```bash
cd deep-research-agent
```

2. **Install dependencies**

```bash
npm install --legacy-peer-deps
```

3. **Configure environment variables**

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Edit `.env` and add your API keys:

```env
OPENAI_API_KEY=sk-...
TAVILY_API_KEY=tvly-...
RESEARCH_OUTPUT_DIR=./research-output
```

4. **Run the development server**

```bash
npm run dev
```

5. **Open the app**

Navigate to `http://localhost:5173` in your browser.

## Usage

### Basic Research Flow

1. **Start a Research Query**
   - Enter your research topic in the chat interface
   - Example: "Deep dive into renewable energy storage technologies"

2. **Review the Outline**
   - The orchestrator will use web search to gather context
   - It will generate a 5-subtopic research outline
   - Review and approve the outline

3. **Execute Deep Research**
   - Once approved, the agent fires off 5 deep research tasks
   - Each subtopic is researched in parallel
   - Progress updates stream in real-time

4. **Access Your Reports**
   - Click "Open Research Folder" to view generated files
   - Each subtopic has its own markdown file
   - Files include metadata frontmatter
   - Optional PDF versions alongside markdown

### File Structure

Research outputs are organized as:

```
research-output/
└── renewable-energy-storage-technologies/
    ├── 01_battery-storage-technologies.md
    ├── 01_battery-storage-technologies.pdf
    ├── 02_hydrogen-energy-storage.md
    ├── 02_hydrogen-energy-storage.pdf
    ├── 03_thermal-energy-storage.md
    ├── 03_thermal-energy-storage.pdf
    ├── 04_grid-scale-solutions.md
    ├── 04_grid-scale-solutions.pdf
    ├── 05_future-innovations.md
    └── 05_future-innovations.pdf
```

### Markdown Frontmatter

Each generated markdown file includes metadata:

```yaml
---
title: "Battery Storage Technologies"
parent_topic: "Renewable Energy Storage Technologies"
section: 1
created_at: 2025-12-25T12:00:00.000Z
generated_by: deep-research-agent
---
```

## Project Structure

```
deep-research-agent/
├── src/
│   ├── lib/
│   │   ├── agents/
│   │   │   └── orchestrator.ts      # Main Mastra agent
│   │   ├── tools/
│   │   │   ├── tavily-search.ts     # Web search tool
│   │   │   └── deep-research.ts     # Deep research tool
│   │   └── utils/
│   │       ├── file-operations.ts   # Markdown file management
│   │       └── pdf-generator.ts     # PDF conversion
│   └── routes/
│       ├── api/
│       │   ├── chat/
│       │   │   └── +server.ts       # Chat API endpoint
│       │   └── open-finder/
│       │       └── +server.ts       # Finder integration
│       └── +page.svelte             # Main UI
├── .env                             # Environment variables
└── package.json
```

## Configuration

### Research Output Directory

Change the output directory in `.env`:

```env
RESEARCH_OUTPUT_DIR=/path/to/your/research
```

### PDF Generation

PDF generation is optional per research task. To enable:

- The orchestrator agent can set `generatePDF: true` when calling the deep research tool
- PDFs are generated alongside markdown files
- Uses Puppeteer for high-quality rendering

### Model Configuration

Edit `src/lib/agents/orchestrator.ts` to change models:

```typescript
export const orchestratorAgent = new Agent({
  model: openai('gpt-5.2-2025-12-11'), // Change model here
  // ...
});
```

Edit `src/lib/tools/deep-research.ts` for deep research model:

```typescript
body: JSON.stringify({
  model: 'o4-mini-deep-research-2025-06-26', // Change model here
  // ...
})
```

## Development

### Dev Logging & Telemetry

The project includes a comprehensive logging system designed for AI-assisted debugging. All logs are written as JSONL (one JSON object per line) to `research-output/logs/dev-YYYY-MM-DD.jsonl`.

#### Enabling Dev Logging

Dev logging is enabled by default in development mode. To enable in production or disable entirely, set these environment variables:

```env
ENABLE_DEV_LOGGING=true    # Enable logging (defaults to true in dev mode)
DEV_LOG_ECHO=true          # Also print logs to server console
```

#### What Gets Logged

- **Client events**: Console output (all levels), network request/response timing, stream statistics
- **API calls**: Full request bodies, headers, response status, timing
- **Tool executions**: Start/success/error phases with parameters and results
- **External API calls**: Tavily searches, OpenAI Deep Research requests (metadata only, not generated content)
- **System events**: Config checks, file operations, errors with full stack traces

**Note**: LLM-generated content (streamed tokens, research output) is intentionally excluded to preserve context window when feeding logs to AI assistants.

#### Log Event Structure

Each log event includes:

```json
{
  "id": "uuid",
  "timestamp": "ISO-8601",
  "source": "server|client",
  "level": "debug|info|warn|error",
  "category": "chat.request|api.external.request|tool.start|etc",
  "message": "Human-readable description",
  "data": { /* structured payload */ },
  "requestId": "correlation-uuid"
}
```

#### Inspecting Logs

Use `jq` to parse and filter JSONL logs:

```bash
# View all logs from today
cat research-output/logs/dev-$(date +%Y-%m-%d).jsonl | jq .

# Filter by correlation ID (requestId)
cat research-output/logs/dev-*.jsonl | jq 'select(.requestId == "abc-123")'

# Show only errors
cat research-output/logs/dev-*.jsonl | jq 'select(.level == "error")'

# Filter by category
cat research-output/logs/dev-*.jsonl | jq 'select(.category | startswith("api.external"))'

# Show tool executions with timing
cat research-output/logs/dev-*.jsonl | jq 'select(.category | startswith("tool.")) | {tool: .data.toolName, phase: .data.phase, duration: .data.durationMs}'
```

#### Providing Logs to AI for Debugging

When debugging issues with AI assistance:

1. **Find the relevant request ID** from the browser console or server logs
2. **Extract correlated events**:
   ```bash
   cat research-output/logs/dev-*.jsonl | jq -s '[.[] | select(.requestId == "YOUR-REQUEST-ID")]'
   ```
3. **Copy the JSON array** and paste it into your AI assistant prompt
4. The AI can trace the full request lifecycle across client and server

#### Log Categories Reference

| Category | Description |
|----------|-------------|
| `chat.request` | Incoming chat API request with messages and tools |
| `chat.response` | Chat stream started |
| `chat.stream.stats` | Stream completion statistics |
| `chat.error` | Chat API error |
| `api.external.request` | Outgoing request to external API (Tavily, OpenAI) |
| `api.external.response` | Response from external API |
| `tool.start` | Tool execution started |
| `tool.progress` | Tool progress update (e.g., retry attempt) |
| `tool.success` | Tool completed successfully |
| `tool.error` | Tool execution failed |
| `network.request` | Client-side fetch request initiated |
| `network.response` | Client-side fetch response received |
| `system.*` | System events (config, finder, etc.) |

### Build for Production

```bash
npm run build
```

### Preview Production Build

```bash
npm run preview
```

## Deployment

### Railway (Planned)

Future versions will support deployment to Railway with database integration for:
- Persistent research history
- Browse/search past research
- Share research reports

### Current Limitations

- macOS only (Finder integration)
- Local file storage only
- No authentication
- Personal use tool

## Roadmap

- [ ] Database integration (PostgreSQL via Railway)
- [ ] Research history browsing UI
- [ ] Multi-user support with authentication
- [ ] Reference document upload (PDF, Markdown)
- [ ] Adjustable subtopic count (currently fixed at 5)
- [ ] Export to other formats (Notion, Google Docs)
- [ ] Research template system
- [ ] Cross-platform file opening (Windows, Linux)

## API Keys

### OpenAI API Key

Get your API key from [OpenAI Platform](https://platform.openai.com/api-keys)

### Tavily API Key

Get your API key from [Tavily](https://tavily.com/)

## Troubleshooting

### Port already in use

```bash
# Kill the process using port 5173
lsof -ti:5173 | xargs kill -9
```

### Dependency conflicts

```bash
# Use legacy peer deps flag
npm install --legacy-peer-deps
```

### PDF generation fails

Ensure Puppeteer dependencies are installed:

```bash
# macOS
brew install chromium

# Ubuntu/Debian
apt-get install chromium-browser
```

## License

MIT

## Contributing

This is currently a personal tool, but contributions are welcome! Please open an issue to discuss proposed changes.

## Support

For issues or questions, please open a GitHub issue.
