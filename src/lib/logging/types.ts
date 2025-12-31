/**
 * Dev Logging Types
 *
 * Shared type definitions for the dev logging system.
 * These types are used by both server-side and client-side logging utilities.
 */

/**
 * Log severity levels
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Log event categories - describes what kind of event occurred
 */
export type LogCategory =
	// Chat flow
	| 'chat.request'
	| 'chat.response'
	| 'chat.stream.stats'
	| 'chat.error'
	// Network (client-side fetch details)
	| 'network.request'
	| 'network.response'
	// Browser console intercepts
	| 'console.log'
	| 'console.info'
	| 'console.warn'
	| 'console.error'
	| 'console.debug'
	// Tool lifecycle
	| 'tool.start'
	| 'tool.progress'
	| 'tool.success'
	| 'tool.error'
	// External API calls (OpenAI, Tavily, etc.)
	| 'api.external.request'
	| 'api.external.response'
	// System events (config checks, file I/O, etc.)
	| 'system'
	| 'system.config.check'
	| 'system.file.write'
	| 'system.file.read'
	// Client-side errors and summary
	| 'client.error'
	| 'client.summary';

/**
 * Log event source - where the event originated
 */
export type LogSource =
	| 'client'
	| 'server'
	| 'tool:tavily'
	| 'tool:deep-research'
	| 'tool:pdf-generator'
	| 'ai-sdk'
	| 'network'
	| 'system';

/**
 * Core log event structure
 *
 * All log events follow this shape. The `data` field is intentionally
 * loosely typed to accommodate various payloads while maintaining
 * a consistent overall structure.
 */
export interface LogEvent {
	/**
	 * Correlation ID - ties together all events from a single chat request.
	 * Generated client-side and passed through to server.
	 */
	id: string;

	/**
	 * ISO 8601 timestamp of when the event occurred.
	 */
	timestamp: string;

	/**
	 * Where the event originated (client, server, specific tool, etc.)
	 */
	source: LogSource;

	/**
	 * Severity level of the event.
	 */
	level: LogLevel;

	/**
	 * Category describing what kind of event this is.
	 */
	category: LogCategory;

	/**
	 * Human-readable summary of the event.
	 */
	message: string;

	/**
	 * Verbose diagnostic payload.
	 *
	 * Contains complete error objects, stack traces, timing info, token counts,
	 * request parameters, headers, file paths, etc.
	 *
	 * EXCLUDES: LLM-generated content (streamed tokens, full completions,
	 * deep research output) to preserve context window for debugging.
	 */
	data?: Record<string, unknown>;
}

/**
 * Payload for client-side log batch POST to /api/dev-log
 */
export interface DevLogPayload {
	/**
	 * Correlation ID for this batch of events
	 */
	id: string;

	/**
	 * Array of log events to persist
	 */
	events: LogEvent[];
}

/**
 * Helper type for external API call logging
 */
export interface ExternalApiCallData {
	service: 'openai' | 'tavily' | string;
	method: string;
	url?: string;
	requestMeta: Record<string, unknown>;
	responseMeta: Record<string, unknown>;
	durationMs: number;
	status?: number;
	error?: {
		name: string;
		message: string;
		stack?: string;
	};
}

/**
 * Helper type for tool execution logging
 */
export interface ToolExecutionData {
	toolName: string;
	phase: 'start' | 'progress' | 'success' | 'error';
	parameters?: Record<string, unknown>;
	result?: Record<string, unknown>;
	error?: {
		name: string;
		message: string;
		stack?: string;
	};
	durationMs?: number;
	attempt?: number;
	maxAttempts?: number;
}

/**
 * Helper type for network request logging (client-side)
 */
export interface NetworkRequestData {
	url: string;
	method: string;
	headers: Record<string, string>;
	bodySize?: number;
	userPrompt?: string;
}

/**
 * Helper type for network response logging (client-side)
 */
export interface NetworkResponseData {
	status: number;
	statusText: string;
	headers: Record<string, string>;
	contentLength?: number;
	durationMs: number;
}

/**
 * Helper type for stream stats logging
 */
export interface StreamStatsData {
	totalChunks: number;
	totalBytes: number;
	durationMs: number;
	success: boolean;
}

/**
 * Helper type for client summary logging
 */
export interface ClientSummaryData {
	requestId: string;
	durationMs: number;
	success: boolean;
	consoleCounts: {
		debug: number;
		log: number;
		info: number;
		warn: number;
		error: number;
	};
	streamStats?: StreamStatsData;
	errorMessage?: string;
}
