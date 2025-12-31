# Getting Started with Deep Research Agent

## Quick Start

1. **Add your API keys to `.env`**:
   ```bash
   OPENAI_API_KEY=sk-your-key-here
   TAVILY_API_KEY=tvly-your-key-here
   ```

2. **The dev server is already running at**: http://localhost:5173

3. **Try a research query**:
   - "Research the impact of AI on healthcare diagnostics"
   - "Explore quantum computing applications in cryptography"
   - "Analyze sustainable agriculture innovations"

## How It Works

### Step 1: Ask Your Research Question
Type your research topic in the chat interface. Be as specific or broad as you'd like.

### Step 2: Orchestrator Gathers Context
The agent will:
- Use Tavily to search the web for current information
- Analyze the landscape of your topic
- Generate a research outline with 5 subtopics

### Step 3: Review & Approve
You'll see an outline like:

```
Research Topic: AI in Healthcare Diagnostics

Subtopics:
1. Medical Imaging and Computer Vision
2. Clinical Decision Support Systems
3. Predictive Analytics and Early Detection
4. Integration with Electronic Health Records
5. Regulatory and Ethical Considerations
```

Approve it or ask for modifications.

### Step 4: Deep Research Execution
Once approved, the agent:
- Spawns 5 deep research tasks (one per subtopic)
- Executes them in parallel
- Generates comprehensive markdown reports
- Saves files to `research-output/` folder

### Step 5: Access Your Research
Click "Open Research Folder" to view your reports in Finder.

## Understanding the Output

### Markdown Files
Each subtopic gets its own file with:
- **Frontmatter**: Metadata about the research
- **Content**: Comprehensive analysis
- **Structure**: Headings, lists, code blocks, etc.

Example structure:
```
research-output/
└── ai-in-healthcare-diagnostics/
    ├── 01_medical-imaging-and-computer-vision.md
    ├── 02_clinical-decision-support-systems.md
    ├── 03_predictive-analytics-and-early-detection.md
    ├── 04_integration-with-electronic-health-records.md
    └── 05_regulatory-and-ethical-considerations.md
```

### PDF Generation
To enable PDF generation, you'll need to modify the orchestrator agent to pass `generatePDF: true` to the deep research tool.

## Tips for Best Results

1. **Be Specific**: Instead of "AI", try "AI applications in medical diagnostics"
2. **Provide Context**: Include time frames, geographic focus, or specific aspects
3. **Use Follow-ups**: Ask the agent to explore specific subtopics in more depth
4. **Review Outlines Carefully**: The outline determines what research will be conducted

## Common Use Cases

### Academic Research
- Literature reviews
- Topic exploration
- Background research for papers

### Market Analysis
- Industry trends
- Competitive landscape
- Technology adoption

### Personal Learning
- Deep dives into topics of interest
- Understanding complex subjects
- Building knowledge bases

## Next Steps

1. **Try your first research query**
2. **Explore the generated markdown files**
3. **Customize the orchestrator agent** (see `src/lib/agents/orchestrator.ts`)
4. **Adjust the deep research model** (see `src/lib/tools/deep-research.ts`)

## Need Help?

- Check the main README.md for detailed documentation
- Review the code in `src/lib/` for implementation details
- Open an issue if you encounter problems
