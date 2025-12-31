# Customization Guide

This guide explains how to customize the Deep Research Agent to fit your specific needs.

## Changing the Number of Subtopics

Currently set to exactly 5 subtopics. To modify:

**File**: `src/lib/agents/orchestrator.ts`

```typescript
instructions: `
  // Change this line:
  3. Create a comprehensive research outline with EXACTLY 5 subtopics
  // To:
  3. Create a comprehensive research outline with EXACTLY 7 subtopics
`
```

Also update the guidelines section:
```typescript
- Always create exactly 7 subtopics (no more, no less)
```

## Changing AI Models

### Orchestrator Agent Model

**File**: `src/lib/agents/orchestrator.ts`

```typescript
export const orchestratorAgent = new Agent({
  name: 'orchestrator',
  model: openai('gpt-4o'), // Change to 'gpt-4o-mini', 'gpt-4-turbo', etc.
  // ...
});
```

### Deep Research Model

**File**: `src/lib/tools/deep-research.ts`

```typescript
body: JSON.stringify({
  model: 'o3-mini', // Change to 'gpt-4o', 'gpt-4-turbo', etc.
  // Also adjust these parameters:
  temperature: 0.7,    // Lower = more focused, Higher = more creative
  max_tokens: 4000,    // Adjust output length
  // ...
})
```

## Modifying Research Instructions

### Orchestrator System Prompt

**File**: `src/lib/agents/orchestrator.ts`

Edit the `instructions` field to change how the orchestrator behaves:

```typescript
instructions: `You are a research orchestration agent.

Your workflow:
1. [Customize this workflow]
2. [Add your own steps]
3. [Change research approach]

Guidelines for creating outlines:
- [Add your own guidelines]
- [Customize outline structure]
- [Define focus areas]
`
```

### Deep Research System Prompt

**File**: `src/lib/tools/deep-research.ts`

```typescript
messages: [
  {
    role: 'system',
    content: 'You are a deep research assistant. [Customize this prompt]'
  },
  // ...
]
```

## Adjusting Search Settings

**File**: `src/lib/tools/tavily-search.ts`

```typescript
parameters: z.object({
  query: z.string(),
  searchDepth: z.enum(['basic', 'advanced'])
    .default('basic'),  // Change to 'advanced' for deeper searches
  maxResults: z.number()
    .default(5)         // Increase for more search results
})
```

## Customizing File Output

### Markdown Frontmatter

**File**: `src/lib/utils/file-operations.ts`

```typescript
function generateFrontmatter(data) {
  return `---
title: "${data.subtopic}"
parent_topic: "${data.parentTopic}"
section: ${data.sectionNumber}
created_at: ${data.createdAt}
generated_by: deep-research-agent
// Add your custom fields:
author: "Your Name"
tags: ["tag1", "tag2"]
version: "1.0"
---
`;
}
```

### File Naming Convention

**File**: `src/lib/utils/file-operations.ts`

```typescript
// Current format: 01_subtopic-slug.md
const filename = `${String(data.sectionNumber).padStart(2, '0')}_${subtopicSlug}.md`;

// Alternative formats:
// Format 1: subtopic-slug_01.md
const filename = `${subtopicSlug}_${String(data.sectionNumber).padStart(2, '0')}.md`;

// Format 2: 2025-12-25_subtopic-slug.md
const timestamp = new Date().toISOString().split('T')[0];
const filename = `${timestamp}_${subtopicSlug}.md`;

// Format 3: topic_section_subtopic.md
const topicSlug = slugify(data.parentTopic);
const filename = `${topicSlug}_${String(data.sectionNumber).padStart(2, '0')}_${subtopicSlug}.md`;
```

### Output Directory Structure

**File**: `src/lib/utils/file-operations.ts`

```typescript
// Current: research-output/parent-topic/files.md
const topicDir = path.join(RESEARCH_OUTPUT_DIR, topicSlug);

// Alternative: research-output/YYYY-MM-DD/parent-topic/files.md
const date = new Date().toISOString().split('T')[0];
const topicDir = path.join(RESEARCH_OUTPUT_DIR, date, topicSlug);

// Alternative: research-output/category/parent-topic/files.md
const category = 'technology'; // or extract from topic
const topicDir = path.join(RESEARCH_OUTPUT_DIR, category, topicSlug);
```

## PDF Styling

**File**: `src/lib/utils/pdf-generator.ts`

Customize the CSS in the `styledHTML` template:

```typescript
<style>
  body {
    font-family: 'Georgia', serif;  // Change font
    line-height: 1.8;                // Adjust line spacing
    color: #2c3e50;                  // Change text color
    max-width: 900px;                // Adjust page width
  }

  h1 {
    color: #2980b9;                  // Custom heading color
    font-size: 2.5rem;               // Heading size
  }

  // Add your own styles
</style>
```

Adjust PDF settings:

```typescript
await page.pdf({
  path: pdfPath,
  format: 'Letter',      // Change from 'A4' to 'Letter', 'Legal', etc.
  margin: {
    top: '2cm',          // Adjust margins
    right: '2cm',
    bottom: '2cm',
    left: '2cm'
  },
  printBackground: true,
  displayHeaderFooter: true,  // Enable headers/footers
  headerTemplate: '<div>Custom Header</div>',
  footerTemplate: '<div>Page <span class="pageNumber"></span></div>'
});
```

## Adding Custom Tools

Create a new tool file:

**File**: `src/lib/tools/my-custom-tool.ts`

```typescript
import { tool } from 'ai';
import { z } from 'zod';

export const myCustomTool = tool({
  description: 'Description of what this tool does',
  parameters: z.object({
    param1: z.string().describe('Parameter description'),
    param2: z.number().optional()
  }),
  execute: async ({ param1, param2 }) => {
    // Your tool logic here
    return {
      result: 'Tool output'
    };
  }
});
```

Add it to the orchestrator:

**File**: `src/lib/agents/orchestrator.ts`

```typescript
import { myCustomTool } from '$lib/tools/my-custom-tool';

export const orchestratorAgent = new Agent({
  // ...
  tools: {
    tavilySearch: tavilySearchTool,
    deepResearch: deepResearchTool,
    myCustomTool: myCustomTool  // Add your tool
  }
});
```

## Retry Logic Configuration

**File**: `src/lib/tools/deep-research.ts`

```typescript
// Change max retries
async function executeDeepResearch(
  query: string,
  maxRetries: number = 5  // Increase from 3 to 5
)

// Adjust backoff strategy
if (attempt < maxRetries) {
  // Current: exponential backoff (2s, 4s, 8s)
  const backoffMs = Math.pow(2, attempt) * 1000;

  // Alternative: linear backoff (5s, 10s, 15s)
  const backoffMs = attempt * 5000;

  // Alternative: fixed delay (3s each time)
  const backoffMs = 3000;

  await new Promise(resolve => setTimeout(resolve, backoffMs));
}
```

## UI Customization

### Colors and Styling

**File**: `src/routes/+page.svelte`

Customize the theme in the `<style>` section:

```css
/* Primary color */
.send-btn {
  background: #10b981;  /* Change from #007aff to green */
}

/* Background colors */
.app-container {
  background: #1a1a1a;  /* Dark mode */
}

/* Message bubbles */
.message.user .message-content {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}
```

### Example Prompts

**File**: `src/routes/+page.svelte`

```svelte
<div class="example-prompts">
  <button class="example-prompt">Your custom prompt 1</button>
  <button class="example-prompt">Your custom prompt 2</button>
  <button class="example-prompt">Your custom prompt 3</button>
</div>
```

## Environment Variables

Add custom configuration:

**File**: `.env`

```env
# Add custom settings
MAX_SUBTOPICS=5
DEFAULT_MODEL=gpt-4o
ENABLE_PDF_GENERATION=true
RESEARCH_DEPTH=advanced
```

Access in code:

```typescript
const maxSubtopics = process.env.MAX_SUBTOPICS || 5;
const defaultModel = process.env.DEFAULT_MODEL || 'gpt-4o';
```

## Advanced: Adding Reference Document Support

To support reference document uploads (planned feature):

1. Add file upload UI component
2. Create document processing tool
3. Extract text from PDFs/markdown
4. Pass context to orchestrator agent

This is left as an exercise for future development!

## Testing Your Changes

After making changes:

```bash
# Restart the dev server
npm run dev

# Or build for production
npm run build
npm run preview
```

## Best Practices

1. **Start small**: Make one change at a time
2. **Test thoroughly**: Try different research queries
3. **Monitor costs**: Watch your API usage with new configurations
4. **Version control**: Commit working changes before experimenting
5. **Document changes**: Update this file with your customizations

## Getting Help

If you need assistance with customization:
- Check the Mastra docs: https://mastra.ai/docs
- Review AI SDK docs: https://sdk.vercel.ai/docs
- Open an issue with your customization question
