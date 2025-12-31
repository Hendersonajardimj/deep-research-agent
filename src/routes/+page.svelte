<script lang="ts">
	import { onMount } from 'svelte';
	import { Chat } from '@ai-sdk/svelte';
	import { DefaultChatTransport } from 'ai';
	import ResearchProgress from '$lib/components/ResearchProgress.svelte';
	import type { RunStatusPart, OutlinePart, SectionStatusPart } from '$lib/types/streaming-events';

	let input = $state('');
	let sidebarOpen = $state(false);
	let showInfo = $state(false);

	// Research progress state
	let runStatus = $state<RunStatusPart | undefined>(undefined);
	let outline = $state<OutlinePart | undefined>(undefined);
	let sections = $state<Map<string, SectionStatusPart>>(new Map());

	let configStatus = $state<{
		openaiConfigured: boolean;
		tavilyConfigured: boolean;
		allConfigured: boolean;
	} | null>(null);

	// Create the Chat instance with transport configured for our API
	const chat = new Chat({
		transport: new DefaultChatTransport({
			api: '/api/chat'
		}),
		onError: (error) => {
			console.error('Chat error:', error);
		},
		onToolCall: ({ toolCall }) => {
			console.log('Tool call received:', toolCall);

			// Track deep research progress
			if (toolCall.toolName === 'deepResearch') {
				// Update phase to researching
				if (runStatus && runStatus.phase !== 'researching') {
					runStatus = {
						...runStatus,
						phase: 'researching',
						phaseMessage: 'Deep research in progress...'
					};
				}

				// Create section status for this research
				const args = toolCall.args as { sectionNumber?: number; subtopic?: string } | undefined;
				const sectionId = `section-${args?.sectionNumber || sections.size + 1}`;
				const newSection: SectionStatusPart = {
					type: 'section-status',
					runId: runStatus?.runId || 'unknown',
					sectionId,
					sectionTitle: args?.subtopic || 'Research Section',
					status: 'running',
					timestamp: new Date().toISOString()
				};
				sections.set(sectionId, newSection);
				sections = new Map(sections);
			}
		},
		onFinish: ({ messages }) => {
			console.log('Chat finished, messages:', messages.length);

			// Mark research as complete
			if (runStatus) {
				runStatus = {
					...runStatus,
					phase: 'complete',
					phaseMessage: 'Research complete!',
					completedSections: runStatus.totalSections
				};
			}
		}
	});

	// Reactive status helpers
	const isLoading = $derived(chat.status === 'submitted' || chat.status === 'streaming');
	const messages = $derived(chat.messages);

	onMount(async () => {
		try {
			const response = await fetch('/api/config');
			configStatus = await response.json();
		} catch (error) {
			console.error('Failed to check config:', error);
		}
	});

	async function openResearchFolder() {
		try {
			const response = await fetch('/api/open-finder', {
				method: 'POST'
			});
			const data = await response.json();
			if (data.success) {
				console.log('Opened research folder:', data.path);
			}
		} catch (error) {
			console.error('Failed to open research folder:', error);
		}
	}

	async function handleSubmit(e: Event) {
		e.preventDefault();
		if (!input.trim() || isLoading) return;

		const userMessage = input;
		input = '';

		// Initialize research progress when starting a new request
		const currentRunId = crypto.randomUUID();
		runStatus = {
			type: 'run-status',
			runId: currentRunId,
			phase: 'planning',
			phaseMessage: 'Planning research outline...',
			completedSections: 0,
			totalSections: 5,
			timestamp: new Date().toISOString()
		};
		sections = new Map();

		// Send the message using the Chat class
		await chat.sendMessage({ content: userMessage });
	}

	// Helper to extract text content from message parts
	function getMessageText(message: typeof messages[number]): string {
		if (!message.parts) return '';

		return message.parts
			.filter((part): part is { type: 'text'; text: string } => part.type === 'text')
			.map(part => part.text)
			.join('');
	}

	// Helper to check if message has tool invocations
	function hasToolCalls(message: typeof messages[number]): boolean {
		if (!message.parts) return false;
		return message.parts.some(part => part.type === 'tool-invocation');
	}
</script>

<svelte:head>
	<title>Deep Research Agent</title>
</svelte:head>

<div class="flex flex-col h-screen max-w-7xl mx-auto bg-white">
	<!-- Sidebar -->
	{#if sidebarOpen}
		<aside class="fixed top-0 left-0 w-80 h-screen bg-white shadow-2xl z-50 overflow-y-auto">
			<div class="flex justify-between items-center p-6 border-b border-gray-200">
				<h2 class="text-xl font-semibold text-gray-900">Deep Research Agent</h2>
				<button
					class="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-600 text-3xl leading-none"
					onclick={() => sidebarOpen = false}
				>×</button>
			</div>
			<div class="p-4 space-y-6">
				<div>
					<h3 class="text-xs font-semibold uppercase tracking-wider text-gray-600 mb-3">About</h3>
					<p class="text-sm text-gray-700 leading-relaxed">AI-powered research assistant that breaks down complex topics into comprehensive reports.</p>
				</div>
				<div>
					<h3 class="text-xs font-semibold uppercase tracking-wider text-gray-600 mb-3">Models</h3>
					<ul class="space-y-2 text-sm text-gray-700">
						<li>GPT-5.2 (Orchestrator)</li>
						<li>o4-mini-deep-research</li>
					</ul>
				</div>
				<div>
					<h3 class="text-xs font-semibold uppercase tracking-wider text-gray-600 mb-3">Quick Actions</h3>
					<button
						class="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 hover:border-blue-500 transition-all text-left"
						onclick={openResearchFolder}
					>
						📁 Open Research Folder
					</button>
				</div>
			</div>
		</aside>
		<button class="fixed inset-0 bg-black/30 z-40" onclick={() => sidebarOpen = false}></button>
	{/if}

	<!-- Header -->
	<header class="border-b border-gray-200 px-6 py-4">
		<div class="flex justify-between items-center">
			<div class="flex items-center gap-4">
				<button
					class="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-600"
					aria-label="Toggle sidebar"
					onclick={() => sidebarOpen = !sidebarOpen}
				>
					<svg width="20" height="20" viewBox="0 0 20 20" fill="none">
						<rect x="2" y="3" width="16" height="2" rx="1" fill="currentColor"/>
						<rect x="2" y="9" width="16" height="2" rx="1" fill="currentColor"/>
						<rect x="2" y="15" width="16" height="2" rx="1" fill="currentColor"/>
					</svg>
				</button>
				<h1 class="text-xl font-semibold text-gray-900">Chat</h1>
				<button
					class="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-600"
					aria-label="Information"
					onclick={() => showInfo = !showInfo}
				>
					<svg width="20" height="20" viewBox="0 0 20 20" fill="none">
						<circle cx="10" cy="10" r="8" stroke="currentColor" stroke-width="1.5"/>
						<path d="M10 6V6.01M10 9V14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
					</svg>
				</button>
				<!-- Status indicator -->
				{#if chat.status === 'streaming'}
					<span class="text-xs text-blue-500 animate-pulse">Streaming...</span>
				{:else if chat.status === 'submitted'}
					<span class="text-xs text-gray-500">Waiting...</span>
				{:else if chat.status === 'error'}
					<span class="text-xs text-red-500">Error</span>
				{/if}
			</div>
			<button
				class="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors"
				onclick={openResearchFolder}
			>
				Open Research Folder
			</button>
		</div>
	</header>

	<!-- API Key Warning -->
	{#if configStatus && !configStatus.allConfigured}
		<div class="bg-amber-50 border-b border-amber-200 px-6 py-4">
			<div class="flex gap-3 items-start max-w-7xl mx-auto text-amber-900">
				<svg width="20" height="20" viewBox="0 0 20 20" fill="none" class="flex-shrink-0 mt-0.5">
					<path d="M10 2L2 17h16L10 2z" fill="#f59e0b" opacity="0.2"/>
					<path d="M10 2L2 17h16L10 2z" stroke="#f59e0b" stroke-width="1.5" stroke-linejoin="round"/>
					<path d="M10 8v4M10 14v.01" stroke="#f59e0b" stroke-width="1.5" stroke-linecap="round"/>
				</svg>
				<div>
					<strong class="block mb-1 text-base">Missing API Keys</strong>
					<div class="flex flex-col gap-1 text-sm">
						{#if !configStatus.openaiConfigured}
							<span>• OPENAI_API_KEY not configured</span>
						{/if}
						{#if !configStatus.tavilyConfigured}
							<span>• TAVILY_API_KEY not configured</span>
						{/if}
						<span>Please add your API keys to the <code class="bg-amber-100 px-1.5 py-0.5 rounded font-mono text-xs">.env</code> file and restart the server.</span>
					</div>
				</div>
			</div>
		</div>
	{/if}

	<!-- Error Display -->
	{#if chat.error}
		<div class="bg-red-50 border-b border-red-200 px-6 py-4">
			<div class="flex gap-3 items-start max-w-7xl mx-auto text-red-900">
				<strong>Error:</strong> {chat.error.message}
			</div>
		</div>
	{/if}

	<!-- Main Content -->
	<main class="flex-1 overflow-y-auto p-8">
		{#if messages.length === 0}
			<div class="flex flex-col items-center justify-center h-full max-w-4xl mx-auto">
				<h2 class="text-3xl font-semibold mb-8 text-center text-gray-900">Deep Research Agent</h2>
				<div class="flex gap-4 flex-wrap justify-center">
					<button
						class="px-5 py-3 bg-white border border-gray-200 rounded-full text-sm hover:border-blue-500 hover:text-blue-500 transition-all shadow-sm"
						onclick={() => { input = 'Tell me about Spirited Away'; }}
					>
						Tell me about Spirited Away
					</button>
					<button
						class="px-5 py-3 bg-white border border-gray-200 rounded-full text-sm hover:border-blue-500 hover:text-blue-500 transition-all shadow-sm"
						onclick={() => { input = 'Teach me about end to end testing using Playwright'; }}
					>
						Teach me about Playwright testing
					</button>
				</div>
			</div>
		{:else}
			<div class="max-w-4xl mx-auto space-y-6">
				<!-- Research Progress Panel -->
				{#if runStatus || outline}
					<ResearchProgress {runStatus} {outline} {sections} />
				{/if}

				{#each messages as message}
					{#if message.role === 'user'}
						<div class="flex justify-end">
							<div class="max-w-[80%] bg-blue-500 text-white rounded-2xl px-5 py-3">
								{getMessageText(message)}
							</div>
						</div>
					{:else}
						<div class="flex justify-start">
							<div class="max-w-[80%] bg-gray-100 text-gray-900 rounded-2xl px-5 py-3 leading-relaxed">
								{#if getMessageText(message)}
									{getMessageText(message)}
								{:else if hasToolCalls(message)}
									<span class="text-gray-500 italic">Processing tool calls...</span>
								{:else}
									<span class="text-gray-400">...</span>
								{/if}
							</div>
						</div>
					{/if}
				{/each}

				{#if isLoading}
					<div class="flex justify-start">
						<div class="bg-gray-100 rounded-2xl px-5 py-4">
							<div class="flex gap-1">
								<span class="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 0s"></span>
								<span class="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 0.2s"></span>
								<span class="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 0.4s"></span>
							</div>
						</div>
					</div>
				{/if}
			</div>
		{/if}
	</main>

	<!-- Chat Input -->
	<footer class="border-t border-gray-200 p-6 bg-white">
		<form onsubmit={handleSubmit} class="max-w-4xl mx-auto">
			<div class="flex items-center gap-3 bg-gray-100 rounded-3xl px-4 py-2 mb-2">
				<input
					type="text"
					bind:value={input}
					placeholder="What would you like to know?"
					class="flex-1 bg-transparent outline-none text-base px-2 py-2 text-gray-900 placeholder-gray-500"
					disabled={isLoading}
				/>
				<button
					type="submit"
					class="p-2 bg-blue-500 text-white rounded-full hover:bg-blue-600 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
					disabled={isLoading || !input.trim()}
					aria-label="Send message"
				>
					<svg width="20" height="20" viewBox="0 0 20 20" fill="none">
						<path d="M18 10L3 3L6 10L3 17L18 10Z" fill="currentColor"/>
					</svg>
				</button>
			</div>
			<div class="text-xs text-gray-500 text-center" title="Using GPT-5.2 for orchestration and o4-mini-deep-research for deep research">
				Deep Research Agent
			</div>
		</form>
	</footer>

	<!-- Info Modal -->
	{#if showInfo}
		<div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
			<div class="bg-white rounded-xl max-w-lg w-full max-h-[80vh] overflow-y-auto shadow-2xl mx-4">
				<div class="flex justify-between items-center p-6 border-b border-gray-200">
					<h2 class="text-xl font-semibold text-gray-900">About Deep Research Agent</h2>
					<button
						class="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-600 text-2xl leading-none"
						onclick={() => showInfo = false}
					>×</button>
				</div>
				<div class="p-6 space-y-4 text-sm text-gray-700">
					<div>
						<p class="font-semibold mb-2">Models:</p>
						<ul class="list-disc list-inside space-y-1 ml-2">
							<li>Orchestrator: GPT-5.2 (2025-12-11)</li>
							<li>Deep Research: o4-mini-deep-research (2025-06-26)</li>
						</ul>
					</div>
					<div>
						<p class="font-semibold mb-2">How it works:</p>
						<ol class="list-decimal list-inside space-y-1 ml-2">
							<li>Describe your research topic</li>
							<li>Agent creates a 5-subtopic outline</li>
							<li>Approve the outline</li>
							<li>Agent executes deep research on each subtopic</li>
							<li>Markdown reports saved to <code class="bg-gray-100 px-1.5 py-0.5 rounded font-mono text-xs">research-output/</code></li>
						</ol>
					</div>
					<div>
						<p class="font-semibold mb-2">Features:</p>
						<ul class="list-disc list-inside space-y-1 ml-2">
							<li>Web search integration (Tavily)</li>
							<li>Parallel research execution</li>
							<li>Automatic retry logic</li>
							<li>Optional PDF generation</li>
						</ul>
					</div>
				</div>
			</div>
		</div>
		<button class="fixed inset-0 z-40" onclick={() => showInfo = false}></button>
	{/if}
</div>
