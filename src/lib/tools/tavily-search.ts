import { tool } from 'ai';
import { z } from 'zod';
import { logToolExecution, logExternalApiCall, serializeError } from '$lib/logging/server-logger';

// API key is now passed dynamically via closure
let _tavilyApiKey: string | undefined;

export function setTavilyApiKey(key: string) {
	_tavilyApiKey = key;
}

export const tavilySearchTool = tool({
	description: 'Search the web for information using Tavily API. Use this to gather context and information for research topics.',
	parameters: z.object({
		query: z.string().describe('The search query to execute'),
		searchDepth: z.enum(['basic', 'advanced']).default('basic').describe('The depth of the search'),
		maxResults: z.number().default(5).describe('Maximum number of results to return')
	}),
	execute: async ({ query, searchDepth, maxResults }) => {
		// Generate a tool-level ID (ideally would be passed from parent context)
		const toolId = crypto.randomUUID();
		const startTime = performance.now();

		// Log tool start
		await logToolExecution(toolId, {
			toolName: 'tavilySearch',
			phase: 'start',
			parameters: { query, searchDepth, maxResults }
		});

		if (!_tavilyApiKey) {
			const error = new Error('TAVILY_API_KEY is not set. Call setTavilyApiKey first.');
			await logToolExecution(toolId, {
				toolName: 'tavilySearch',
				phase: 'error',
				error: serializeError(error),
				durationMs: Math.round(performance.now() - startTime)
			});
			throw error;
		}

		try {
			const apiStartTime = performance.now();

			const response = await fetch('https://api.tavily.com/search', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					api_key: _tavilyApiKey,
					query,
					search_depth: searchDepth,
					max_results: maxResults,
					include_answer: true,
					include_raw_content: false
				})
			});

			const apiDurationMs = Math.round(performance.now() - apiStartTime);

			if (!response.ok) {
				const error = new Error(`Tavily API error: ${response.statusText}`);
				
				await logExternalApiCall(toolId, {
					service: 'tavily',
					method: 'POST',
					url: 'https://api.tavily.com/search',
					requestMeta: { query, searchDepth, maxResults },
					responseMeta: { statusText: response.statusText },
					durationMs: apiDurationMs,
					status: response.status,
					error: serializeError(error)
				});

				await logToolExecution(toolId, {
					toolName: 'tavilySearch',
					phase: 'error',
					error: serializeError(error),
					durationMs: Math.round(performance.now() - startTime)
				});

				throw error;
			}

			const data = await response.json();

			// Log the API response with full details (Tavily is search, not LLM output)
			await logExternalApiCall(toolId, {
				service: 'tavily',
				method: 'POST',
				url: 'https://api.tavily.com/search',
				requestMeta: { query, searchDepth, maxResults },
				responseMeta: {
					resultCount: data.results?.length ?? 0,
					hasAnswer: !!data.answer,
					answerLength: data.answer?.length ?? 0,
					resultUrls: data.results?.map((r: any) => r.url) ?? [],
					resultTitles: data.results?.map((r: any) => r.title) ?? []
				},
				durationMs: apiDurationMs,
				status: response.status
			});

			const result = {
				answer: data.answer,
				results: data.results.map((result: any) => ({
					title: result.title,
					url: result.url,
					content: result.content,
					score: result.score
				}))
			};

			// Log tool success
			await logToolExecution(toolId, {
				toolName: 'tavilySearch',
				phase: 'success',
				result: {
					resultCount: result.results.length,
					hasAnswer: !!result.answer,
					resultUrls: result.results.map((r: any) => r.url)
				},
				durationMs: Math.round(performance.now() - startTime)
			});

			return result;
		} catch (error) {
			console.error('Tavily search error:', error);

			// Log tool error if not already logged
			await logToolExecution(toolId, {
				toolName: 'tavilySearch',
				phase: 'error',
				error: serializeError(error),
				durationMs: Math.round(performance.now() - startTime)
			});

			throw error;
		}
	}
});
