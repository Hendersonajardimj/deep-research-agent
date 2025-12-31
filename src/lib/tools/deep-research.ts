import { tool } from 'ai';
import { z } from 'zod';
import { saveMarkdownReport } from '$lib/utils/file-operations';
import { generatePDF } from '$lib/utils/pdf-generator';
import { logToolExecution, logExternalApiCall, serializeError } from '$lib/logging/server-logger';
import { createSectionStatus } from '$lib/utils/streaming-helpers';

// API key is now passed dynamically via closure
let _openaiApiKey: string | undefined;

export function setOpenAIApiKey(key: string) {
	_openaiApiKey = key;
}

interface DeepResearchResult {
	id: string;
	content: string;
	status: 'completed' | 'failed' | 'in_progress';
	error?: string;
	tokenUsage?: {
		prompt_tokens?: number;
		completion_tokens?: number;
		total_tokens?: number;
	};
}

/**
 * Execute a deep research query using OpenAI's Deep Research model via the Responses API
 * Uses background mode with polling since deep research can take 5-10+ minutes
 */
async function executeDeepResearch(
	query: string,
	toolId: string,
	maxRetries: number = 3
): Promise<DeepResearchResult> {
	const systemPrompt = 'You are a deep research assistant. Provide comprehensive, well-researched answers with citations and sources where applicable.';

	// Configuration for polling
	const POLL_INTERVAL_MS = 5000; // 5 seconds between polls
	const MAX_POLL_TIME_MS = 600000; // 10 minutes max wait time

	for (let attempt = 1; attempt <= maxRetries; attempt++) {
		// Log retry progress with backoff
		if (attempt > 1) {
			const backoffMs = Math.pow(2, attempt - 1) * 1000;
			await logToolExecution(toolId, {
				toolName: 'deepResearch',
				phase: 'progress',
				attempt,
				maxAttempts: maxRetries,
				parameters: { backoffMs, status: 'retrying' }
			});
			await new Promise(resolve => setTimeout(resolve, backoffMs));
		}

		try {
			const submitStartTime = Date.now();

			// Step 1: Submit the deep research request in background mode
			console.log(`[Deep Research] Submitting background request for: ${query.substring(0, 50)}...`);

			const submitResponse = await fetch('https://api.openai.com/v1/responses', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${_openaiApiKey}`
				},
				body: JSON.stringify({
					model: 'o4-mini-deep-research-2025-06-26',
					input: [
						{
							role: 'user',
							content: [
								{ type: 'input_text', text: `${systemPrompt}\n\n${query}` }
							]
						}
					],
					reasoning: { summary: 'auto' },
					tools: [{ type: 'web_search_preview' }],
					background: true
				})
			});

			if (!submitResponse.ok) {
				const errorData = await submitResponse.json().catch(() => ({}));
				const error = new Error(`OpenAI API error (${submitResponse.status}): ${JSON.stringify(errorData)}`);

				await logExternalApiCall(toolId, {
					service: 'openai',
					method: 'POST',
					url: 'https://api.openai.com/v1/responses',
					requestMeta: {
						model: 'o4-mini-deep-research-2025-06-26',
						inputLength: systemPrompt.length + query.length,
						attempt,
						backgroundMode: true
					},
					responseMeta: { errorData },
					durationMs: Date.now() - submitStartTime,
					status: submitResponse.status,
					error: serializeError(error)
				});

				throw error;
			}

			const submitData = await submitResponse.json();
			const responseId = submitData.id;

			console.log(`[Deep Research] Request submitted, ID: ${responseId}, Status: ${submitData.status}`);

			await logToolExecution(toolId, {
				toolName: 'deepResearch',
				phase: 'progress',
				parameters: {
					status: 'submitted',
					responseId,
					initialStatus: submitData.status
				}
			});

			// Step 2: Poll for completion
			const pollStartTime = Date.now();
			let pollData = submitData;
			let pollCount = 0;

			while (pollData.status === 'queued' || pollData.status === 'in_progress') {
				// Check timeout
				const elapsedMs = Date.now() - pollStartTime;
				if (elapsedMs > MAX_POLL_TIME_MS) {
					throw new Error(`Deep research timed out after ${MAX_POLL_TIME_MS / 1000} seconds`);
				}

				// Wait before polling
				await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
				pollCount++;

				// Poll for status
				const pollResponse = await fetch(`https://api.openai.com/v1/responses/${responseId}`, {
					method: 'GET',
					headers: {
						'Authorization': `Bearer ${_openaiApiKey}`
					}
				});

				if (!pollResponse.ok) {
					const errorData = await pollResponse.json().catch(() => ({}));
					throw new Error(`OpenAI poll error (${pollResponse.status}): ${JSON.stringify(errorData)}`);
				}

				pollData = await pollResponse.json();

				console.log(`[Deep Research] Poll #${pollCount}: Status=${pollData.status}, Elapsed=${Math.round(elapsedMs / 1000)}s`);

				// Log polling progress periodically (every 6th poll = ~30 seconds)
				if (pollCount % 6 === 0) {
					await logToolExecution(toolId, {
						toolName: 'deepResearch',
						phase: 'progress',
						parameters: {
							status: 'polling',
							responseId,
							currentStatus: pollData.status,
							pollCount,
							elapsedMs
						}
					});
				}
			}

			// Step 3: Handle completion status
			const totalDurationMs = Date.now() - submitStartTime;

			if (pollData.status === 'failed' || pollData.status === 'cancelled') {
				const errorMsg = pollData.error?.message || `Research ${pollData.status}`;
				throw new Error(errorMsg);
			}

			// Step 4: Extract content from the response
			// The Responses API can return content in different formats
			let content: string | undefined;

			// Try output_text first (convenience field)
			if (pollData.output_text) {
				content = pollData.output_text;
			}
			// Try output array
			else if (pollData.output && Array.isArray(pollData.output)) {
				for (const item of pollData.output) {
					if (item.type === 'message' && item.content) {
						for (const contentItem of item.content) {
							if (contentItem.type === 'output_text' || contentItem.type === 'text') {
								content = contentItem.text;
								break;
							}
						}
					}
					if (content) break;
				}
			}

			if (!content) {
				console.error('[Deep Research] Unexpected response format:', JSON.stringify(pollData, null, 2));
				throw new Error('No content returned from OpenAI deep research');
			}

			console.log(`[Deep Research] Completed successfully in ${Math.round(totalDurationMs / 1000)}s, content length: ${content.length}`);

			// Log success
			await logExternalApiCall(toolId, {
				service: 'openai',
				method: 'POST',
				url: 'https://api.openai.com/v1/responses',
				requestMeta: {
					model: 'o4-mini-deep-research-2025-06-26',
					inputLength: systemPrompt.length + query.length,
					attempt,
					backgroundMode: true
				},
				responseMeta: {
					responseId,
					model: pollData.model,
					status: pollData.status,
					contentLength: content.length,
					pollCount,
					totalPollTimeMs: totalDurationMs,
					input_tokens: pollData.usage?.input_tokens,
					output_tokens: pollData.usage?.output_tokens,
					total_tokens: pollData.usage?.total_tokens
				},
				durationMs: totalDurationMs,
				status: 200
			});

			return {
				id: responseId,
				content,
				status: 'completed',
				tokenUsage: pollData.usage ? {
					prompt_tokens: pollData.usage.input_tokens,
					completion_tokens: pollData.usage.output_tokens,
					total_tokens: pollData.usage.total_tokens
				} : undefined
			};

		} catch (error) {
			console.error(`[Deep Research] Attempt ${attempt}/${maxRetries} failed:`, error);

			await logExternalApiCall(toolId, {
				service: 'openai',
				method: 'POST',
				url: 'https://api.openai.com/v1/responses',
				requestMeta: {
					model: 'o4-mini-deep-research-2025-06-26',
					inputLength: systemPrompt.length + query.length,
					attempt,
					backgroundMode: true
				},
				responseMeta: {},
				durationMs: 0,
				status: 500,
				error: serializeError(error)
			});

			// Don't retry on the last attempt
			if (attempt === maxRetries) {
				return {
					id: 'failed',
					content: '',
					status: 'failed',
					error: (error as Error).message || 'Unknown error occurred'
				};
			}
		}
	}

	return {
		id: 'failed',
		content: '',
		status: 'failed',
		error: 'All retry attempts failed'
	};
}

export const deepResearchTool = tool({
	description: 'Execute a deep research query using OpenAI Deep Research model. This will perform comprehensive research on the given topic and save the results as a markdown file.',
	parameters: z.object({
		subtopic: z.string().describe('The specific subtopic to research in depth'),
		parentTopic: z.string().describe('The parent research topic this subtopic belongs to'),
		sectionNumber: z.number().describe('The section number in the outline (for file naming)'),
		sectionId: z.string().optional().describe('Optional section ID for progress tracking'),
		runId: z.string().optional().describe('Optional run ID for this research session'),
		generatePDF: z.boolean().default(false).describe('Whether to also generate a PDF version of the markdown report')
	}),
	execute: async ({ subtopic, parentTopic, sectionNumber, sectionId, runId, generatePDF: shouldGeneratePDF }) => {
		// Generate a tool-level ID for logging
		const toolId = crypto.randomUUID();
		const startTime = performance.now();

		// Use provided IDs or generate defaults
		const effectiveSectionId = sectionId || `section-${sectionNumber}`;
		const effectiveRunId = runId || 'unknown';

		// Log tool start with full parameters
		await logToolExecution(toolId, {
			toolName: 'deepResearch',
			phase: 'start',
			parameters: { subtopic, parentTopic, sectionNumber, sectionId: effectiveSectionId, runId: effectiveRunId, generatePDF: shouldGeneratePDF }
		});

		// Emit section status: queued -> running
		const runningStatus = createSectionStatus(
			effectiveRunId,
			effectiveSectionId,
			subtopic,
			'running'
		);
		await logToolExecution(toolId, {
			toolName: 'deepResearch',
			phase: 'section-status',
			sectionStatus: runningStatus
		});

		if (!_openaiApiKey) {
			const error = new Error('OPENAI_API_KEY is not set. Call setOpenAIApiKey first.');
			await logToolExecution(toolId, {
				toolName: 'deepResearch',
				phase: 'error',
				error: serializeError(error),
				durationMs: Math.round(performance.now() - startTime)
			});
			throw error;
		}

		console.log(`Starting deep research for: ${subtopic}`);

		// Execute deep research with retry logic
		const result = await executeDeepResearch(subtopic, toolId);

		if (result.status === 'failed') {
			// Emit section status: error
			const errorStatus = createSectionStatus(
				effectiveRunId,
				effectiveSectionId,
				subtopic,
				'error',
				undefined,
				result.error
			);
			await logToolExecution(toolId, {
				toolName: 'deepResearch',
				phase: 'section-status',
				sectionStatus: errorStatus
			});

			await logToolExecution(toolId, {
				toolName: 'deepResearch',
				phase: 'error',
				error: { name: 'DeepResearchError', message: result.error || 'Unknown error' },
				durationMs: Math.round(performance.now() - startTime)
			});

			return {
				success: false,
				error: result.error,
				subtopic
			};
		}

		// Save markdown report
		const filePath = await saveMarkdownReport({
			content: result.content,
			subtopic,
			parentTopic,
			sectionNumber
		});

		// Generate PDF if requested
		let pdfPath: string | undefined;
		if (shouldGeneratePDF) {
			try {
				pdfPath = await generatePDF(filePath);
				console.log(`PDF generated: ${pdfPath}`);
			} catch (error) {
				console.error('PDF generation failed:', error);
				// Don't fail the whole operation if PDF generation fails
			}
		}

		// Emit section status: done with preview
		const doneStatus = createSectionStatus(
			effectiveRunId,
			effectiveSectionId,
			subtopic,
			'done',
			{
				preview: result.content.substring(0, 200) + '...'
			}
		);
		await logToolExecution(toolId, {
			toolName: 'deepResearch',
			phase: 'section-status',
			sectionStatus: doneStatus
		});

		// Log tool success (metadata only, not full content)
		await logToolExecution(toolId, {
			toolName: 'deepResearch',
			phase: 'success',
			result: {
				markdownPath: filePath,
				pdfPath,
				contentLength: result.content.length,
				contentPreview: result.content.substring(0, 200) + '...',
				tokenUsage: result.tokenUsage
			},
			durationMs: Math.round(performance.now() - startTime)
		});

		return {
			success: true,
			subtopic,
			markdownPath: filePath,
			pdfPath,
			contentPreview: result.content.substring(0, 200) + '...'
		};
	}
});
