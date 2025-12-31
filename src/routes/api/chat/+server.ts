import { streamText, stepCountIs } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { orchestratorAgent } from '$lib/agents/orchestrator';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { OPENAI_API_KEY, TAVILY_API_KEY } from '$env/static/private';
import { logInfo, logError, serializeError } from '$lib/logging/server-logger';
import { createRunStatus, createOutline, formatAsDataPart } from '$lib/utils/streaming-helpers';
import type { OutlinePart } from '$lib/types/streaming-events';
import { setTavilyApiKey } from '$lib/tools/tavily-search';
import { setOpenAIApiKey } from '$lib/tools/deep-research';

export const POST: RequestHandler = async ({ request }) => {
	// Parse request body
	const body = await request.json();
	const { messages, requestId } = body;

	// Use provided requestId or generate one for server-side logging
	const id = requestId || crypto.randomUUID();

	// Check if API keys are configured
	const openaiKey = OPENAI_API_KEY;
	const tavilyKey = TAVILY_API_KEY;

	// Set API keys for tools (SvelteKit doesn't expose .env to process.env)
	if (openaiKey) setOpenAIApiKey(openaiKey);
	if (tavilyKey) setTavilyApiKey(tavilyKey);

	if (!openaiKey || !tavilyKey) {
		const errorDetails = {
			openai: !openaiKey ? 'OPENAI_API_KEY not configured' : 'configured',
			tavily: !tavilyKey ? 'TAVILY_API_KEY not configured' : 'configured'
		};

		await logError(id, 'server', 'chat.error', 'Missing API keys', {
			errorDetails,
			messageCount: messages?.length ?? 0
		});

		return json(
			{
				error: 'Missing API keys',
				details: errorDetails
			},
			{ status: 500 }
		);
	}

	// Log the incoming request with full details
	await logInfo(id, 'server', 'chat.request', 'Chat request received', {
		messageCount: messages?.length ?? 0,
		messages, // Full messages array for debugging
		modelName: 'gpt-5.2-2025-12-11',
		toolNames: Object.keys(orchestratorAgent.tools || {}),
		systemPromptLength: orchestratorAgent.instructions?.length ?? 0,
		stopWhenSteps: 10
	});

	try {
		// Generate a unique run ID for this research session
		const runId = crypto.randomUUID();

		// Emit initial "Planning" phase immediately for fast feedback
		await logInfo(id, 'server', 'chat.phase', 'Starting research planning phase', {
			phase: 'planning',
			runId
		});

		// Track outline state to emit it when detected
		let outlineEmitted = false;

		// Create OpenAI provider with explicit API key (SvelteKit doesn't expose .env to process.env)
		const openai = createOpenAI({
			apiKey: openaiKey
		});

		// Use @ai-sdk/openai directly with GPT-5.2
		const result = streamText({
			model: openai('gpt-5.2-2025-12-11'),
			messages,
			tools: orchestratorAgent.tools as Parameters<typeof streamText>[0]['tools'],
			system: orchestratorAgent.instructions,
			stopWhen: stepCountIs(10),
			// Hook into the stream lifecycle to emit progress updates
			onChunk: async (chunk) => {
				// Log chunks for debugging (can be removed in production)
				if (chunk.chunk.type === 'tool-call') {
					await logInfo(id, 'server', 'chat.tool-call', `Tool called: ${chunk.chunk.toolName}`, {
						toolName: chunk.chunk.toolName,
						args: chunk.chunk.args,
						runId
					});

					// Detect when deep research tools are being called (dispatching phase)
					if (chunk.chunk.toolName === 'deepResearch' && !outlineEmitted) {
						// This means we're dispatching subagents
						const runStatusPart = createRunStatus(
							runId,
							'dispatching',
							'Dispatching research agents...',
							0,
							5 // assuming 5 sections
						);

						// Note: We can't directly append to stream here, but we log it
						await logInfo(id, 'server', 'chat.phase', 'Phase changed to dispatching', {
							phase: 'dispatching',
							runId
						});
					}
				}
			},
			onFinish: async (result) => {
				await logInfo(id, 'server', 'chat.complete', 'Stream completed', {
					finishReason: result.finishReason,
					usage: result.usage,
					runId
				});

				// Final phase: complete
				const finalRunStatus = createRunStatus(
					runId,
					'complete',
					'Research complete',
					5,
					5
				);

				await logInfo(id, 'server', 'chat.phase', 'Phase changed to complete', {
					phase: 'complete',
					runId
				});
			}
		});

		// Log successful stream start
		await logInfo(id, 'server', 'chat.response', 'Stream response started', {
			responseType: 'data-stream',
			runId
		});

		// Return the stream response using AI SDK v6 method
		return result.toUIMessageStreamResponse();
	} catch (error: unknown) {
		// Log the full error with stack trace and any provider info
		const serialized = serializeError(error);
		const errorObj = error as Record<string, unknown>;

		await logError(id, 'server', 'chat.error', `Chat route failed: ${serialized?.message ?? 'Unknown error'}`, {
			error: serialized,
			errorType: serialized?.name,
			// Include any AI SDK specific error properties
			providerInfo: errorObj?.provider ?? undefined,
			modelSpec: errorObj?.modelSpec ?? undefined,
			cause: errorObj?.cause ? serializeError(errorObj.cause) : undefined,
			messageCount: messages?.length ?? 0
		});

		console.error('Error in /api/chat:', error);
		return json(
			{
				error: 'Chat route failed',
				message: serialized?.message ?? 'Unknown error'
			},
			{ status: 500 }
		);
	}
};
