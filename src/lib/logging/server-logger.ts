/**
 * Server-side Dev Logger
 *
 * Provides structured logging to JSONL files for dev debugging.
 * This module is server-only and must not be imported from client code.
 */

import fs from 'fs/promises';
import path from 'path';
import type {
	LogEvent,
	LogLevel,
	LogCategory,
	LogSource,
	ExternalApiCallData,
	ToolExecutionData
} from './types';

// Log output directory (sibling to research markdown folders)
const LOGS_DIR = path.join(process.cwd(), 'research-output', 'logs');

// Regex pattern for keys that should have their values redacted
const SECRET_KEY_PATTERN = /api[_-]?key|auth(orization)?|token|password|secret|bearer/i;

/**
 * Check if dev logging is enabled.
 * Enabled by default in dev, can be controlled via ENABLE_DEV_LOGGING env.
 */
function isLoggingEnabled(): boolean {
	const envFlag = process.env.ENABLE_DEV_LOGGING;
	if (envFlag !== undefined) {
		return envFlag === 'true' || envFlag === '1';
	}
	// Default to enabled (assume dev environment)
	return true;
}

/**
 * Check if console echo is enabled.
 * Controlled via DEV_LOG_ECHO env.
 */
function isConsoleEchoEnabled(): boolean {
	const envFlag = process.env.DEV_LOG_ECHO;
	return envFlag === 'true' || envFlag === '1';
}

/**
 * Ensure the logs directory exists
 */
async function ensureLogsDir(): Promise<void> {
	await fs.mkdir(LOGS_DIR, { recursive: true });
}

/**
 * Get the log file path for today
 */
function getLogFilePath(): string {
	const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
	return path.join(LOGS_DIR, `dev-${today}.jsonl`);
}

/**
 * Recursively redact secret values from an object.
 * Only redacts values for keys matching SECRET_KEY_PATTERN.
 * Does not truncate or modify any other data.
 */
export function redactSecrets<T>(obj: T): T {
	if (obj === null || obj === undefined) {
		return obj;
	}

	if (typeof obj !== 'object') {
		return obj;
	}

	if (Array.isArray(obj)) {
		return obj.map((item) => redactSecrets(item)) as T;
	}

	const result: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
		if (SECRET_KEY_PATTERN.test(key) && typeof value === 'string') {
			// Redact the value but indicate it was present
			result[key] = '[REDACTED]';
		} else if (typeof value === 'object' && value !== null) {
			result[key] = redactSecrets(value);
		} else {
			result[key] = value;
		}
	}

	return result as T;
}

/**
 * Serialize an error object to a loggable format
 */
export function serializeError(
	error: unknown
): { name: string; message: string; stack?: string; cause?: unknown } | undefined {
	if (!error) return undefined;

	if (error instanceof Error) {
		return {
			name: error.name,
			message: error.message,
			stack: error.stack,
			cause: error.cause ? serializeError(error.cause) : undefined
		};
	}

	if (typeof error === 'string') {
		return { name: 'Error', message: error };
	}

	if (typeof error === 'object') {
		const obj = error as Record<string, unknown>;
		return {
			name: String(obj.name ?? 'Error'),
			message: String(obj.message ?? JSON.stringify(error)),
			stack: obj.stack ? String(obj.stack) : undefined
		};
	}

	return { name: 'Error', message: String(error) };
}

/**
 * Core function to log an event.
 * Appends the event as a JSON line to the daily log file.
 */
export async function logEvent(event: LogEvent): Promise<void> {
	if (!isLoggingEnabled()) {
		return;
	}

	try {
		await ensureLogsDir();

		// Redact secrets from the data payload
		const safeEvent: LogEvent = {
			...event,
			data: event.data ? redactSecrets(event.data) : undefined
		};

		const logLine = JSON.stringify(safeEvent) + '\n';
		const logPath = getLogFilePath();

		await fs.appendFile(logPath, logLine, 'utf-8');

		// Optional console echo for quick visibility
		if (isConsoleEchoEnabled()) {
			const levelColors: Record<LogLevel, string> = {
				debug: '\x1b[90m', // gray
				info: '\x1b[36m', // cyan
				warn: '\x1b[33m', // yellow
				error: '\x1b[31m' // red
			};
			const reset = '\x1b[0m';
			const color = levelColors[event.level] || '';
			console.log(
				`${color}[${event.level.toUpperCase()}]${reset} [${event.source}] ${event.category}: ${event.message}`
			);
		}
	} catch (err) {
		// Don't let logging failures break the application
		console.error('Failed to write log event:', err);
	}
}

/**
 * Create a log event with common fields pre-filled
 */
function createEvent(
	id: string,
	source: LogSource,
	level: LogLevel,
	category: LogCategory,
	message: string,
	data?: Record<string, unknown>
): LogEvent {
	return {
		id,
		timestamp: new Date().toISOString(),
		source,
		level,
		category,
		message,
		data
	};
}

// ============================================================================
// Convenience helpers for different log levels
// ============================================================================

export async function logDebug(
	id: string,
	source: LogSource,
	category: LogCategory,
	message: string,
	data?: Record<string, unknown>
): Promise<void> {
	await logEvent(createEvent(id, source, 'debug', category, message, data));
}

export async function logInfo(
	id: string,
	source: LogSource,
	category: LogCategory,
	message: string,
	data?: Record<string, unknown>
): Promise<void> {
	await logEvent(createEvent(id, source, 'info', category, message, data));
}

export async function logWarn(
	id: string,
	source: LogSource,
	category: LogCategory,
	message: string,
	data?: Record<string, unknown>
): Promise<void> {
	await logEvent(createEvent(id, source, 'warn', category, message, data));
}

export async function logError(
	id: string,
	source: LogSource,
	category: LogCategory,
	message: string,
	data?: Record<string, unknown>
): Promise<void> {
	await logEvent(createEvent(id, source, 'error', category, message, data));
}

// ============================================================================
// Structured helpers for common logging patterns
// ============================================================================

/**
 * Log an external API call (OpenAI, Tavily, etc.)
 *
 * Logs both the request and response in a single structured event.
 * For LLM calls, requestMeta should include model/params but NOT full prompt content.
 * For LLM responses, responseMeta should include status/token usage but NOT completion content.
 */
export async function logExternalApiCall(
	id: string,
	data: ExternalApiCallData
): Promise<void> {
	const source: LogSource = data.service === 'tavily' ? 'tool:tavily' : 'tool:deep-research';
	const category: LogCategory = data.error ? 'api.external.response' : 'api.external.response';
	const level: LogLevel = data.error ? 'error' : 'info';

	const message = data.error
		? `${data.service} API call failed: ${data.error.message}`
		: `${data.service} API call completed (${data.durationMs}ms, status ${data.status})`;

	await logEvent(
		createEvent(id, source, level, category, message, {
			service: data.service,
			method: data.method,
			url: data.url,
			requestMeta: data.requestMeta,
			responseMeta: data.responseMeta,
			durationMs: data.durationMs,
			status: data.status,
			error: data.error
		})
	);
}

/**
 * Log a tool execution phase
 *
 * Use this to track the lifecycle of tool invocations:
 * - start: when tool begins execution
 * - progress: for retry attempts or intermediate states
 * - success: when tool completes successfully
 * - error: when tool fails
 */
export async function logToolExecution(
	id: string,
	data: ToolExecutionData
): Promise<void> {
	const sourceMap: Record<string, LogSource> = {
		tavilySearch: 'tool:tavily',
		deepResearch: 'tool:deep-research',
		pdfGenerator: 'tool:pdf-generator'
	};
	const source = sourceMap[data.toolName] || 'server';

	const categoryMap: Record<string, LogCategory> = {
		start: 'tool.start',
		progress: 'tool.progress',
		success: 'tool.success',
		error: 'tool.error'
	};
	const category = categoryMap[data.phase];

	const level: LogLevel = data.phase === 'error' ? 'error' : 'info';

	let message: string;
	switch (data.phase) {
		case 'start':
			message = `Tool ${data.toolName} started`;
			break;
		case 'progress':
			message = `Tool ${data.toolName} progress: attempt ${data.attempt}/${data.maxAttempts}`;
			break;
		case 'success':
			message = `Tool ${data.toolName} completed successfully${data.durationMs ? ` (${data.durationMs}ms)` : ''}`;
			break;
		case 'error':
			message = `Tool ${data.toolName} failed: ${data.error?.message || 'Unknown error'}`;
			break;
		default:
			message = `Tool ${data.toolName} ${data.phase}`;
	}

	await logEvent(
		createEvent(id, source, level, category, message, {
			toolName: data.toolName,
			phase: data.phase,
			parameters: data.parameters,
			result: data.result,
			error: data.error,
			durationMs: data.durationMs,
			attempt: data.attempt,
			maxAttempts: data.maxAttempts
		})
	);
}

/**
 * Log a system event (config check, file I/O, etc.)
 */
export async function logSystem(
	id: string,
	category: LogCategory,
	message: string,
	data?: Record<string, unknown>,
	level: LogLevel = 'info'
): Promise<void> {
	await logEvent(createEvent(id, 'system', level, category, message, data));
}
