/**
 * Client-side Dev Logger
 *
 * Provides logging utilities for browser-side telemetry.
 * Captures console output, network timing, and errors, then batches
 * them for submission to the server via /api/dev-log.
 */

import type {
	LogEvent,
	LogLevel,
	LogCategory,
	DevLogPayload,
	NetworkRequestData,
	NetworkResponseData,
	StreamStatsData,
	ClientSummaryData
} from './types';

/**
 * Redact authorization headers from a headers object
 */
function redactHeaders(headers: Record<string, string>): Record<string, string> {
	const redacted: Record<string, string> = {};
	for (const [key, value] of Object.entries(headers)) {
		if (/auth|token|key|secret|bearer/i.test(key)) {
			redacted[key] = '[REDACTED]';
		} else {
			redacted[key] = value;
		}
	}
	return redacted;
}

/**
 * Safely serialize a value for logging (handles circular refs, etc.)
 */
function safeSerialize(value: unknown): unknown {
	try {
		// Test if it's serializable
		JSON.stringify(value);
		return value;
	} catch {
		// If not, convert to string
		return String(value);
	}
}

/**
 * Serialize console arguments to a loggable array
 */
function serializeConsoleArgs(args: unknown[]): unknown[] {
	return args.map((arg) => {
		if (arg instanceof Error) {
			return {
				name: arg.name,
				message: arg.message,
				stack: arg.stack
			};
		}
		return safeSerialize(arg);
	});
}

/**
 * Request logger instance returned by createRequestLogger.
 * Provides methods to log various events and flush to server.
 */
export interface RequestLogger {
	/** The correlation ID for this request */
	id: string;

	/** Start time for duration calculations */
	startTime: number;

	/** Log a debug-level event */
	debug(category: LogCategory, message: string, data?: Record<string, unknown>): void;

	/** Log an info-level event */
	info(category: LogCategory, message: string, data?: Record<string, unknown>): void;

	/** Log a warning-level event */
	warn(category: LogCategory, message: string, data?: Record<string, unknown>): void;

	/** Log an error-level event */
	error(category: LogCategory, message: string, data?: Record<string, unknown>): void;

	/** Log network request details */
	logNetworkRequest(data: NetworkRequestData): void;

	/** Log network response details */
	logNetworkResponse(data: NetworkResponseData): void;

	/** Log stream completion stats */
	logStreamStats(data: StreamStatsData): void;

	/** Log a chat error */
	logChatError(error: Error | unknown, additionalData?: Record<string, unknown>): void;

	/** Install console interceptors (call before the request) */
	installConsoleInterceptors(): void;

	/** Restore original console methods (call after the request) */
	restoreConsole(): void;

	/** Flush all queued events to the server */
	flush(success: boolean, errorMessage?: string): Promise<void>;

	/** Get current console counts */
	getConsoleCounts(): ClientSummaryData['consoleCounts'];
}

/**
 * Create a new request logger instance.
 *
 * Usage:
 * ```ts
 * const logger = createRequestLogger();
 * logger.installConsoleInterceptors();
 * try {
 *   logger.logNetworkRequest({ ... });
 *   // ... do the request ...
 *   logger.logNetworkResponse({ ... });
 * } finally {
 *   logger.restoreConsole();
 *   await logger.flush(success);
 * }
 * ```
 */
export function createRequestLogger(id?: string): RequestLogger {
	const requestId = id || crypto.randomUUID();
	const startTime = performance.now();
	const events: LogEvent[] = [];

	// Console interception state
	let originalConsole: {
		log: typeof console.log;
		info: typeof console.info;
		warn: typeof console.warn;
		error: typeof console.error;
		debug: typeof console.debug;
	} | null = null;

	const consoleCounts = {
		debug: 0,
		log: 0,
		info: 0,
		warn: 0,
		error: 0
	};

	// Stream stats tracking
	let streamStats: StreamStatsData | null = null;

	/**
	 * Add an event to the queue
	 */
	function addEvent(
		level: LogLevel,
		category: LogCategory,
		message: string,
		data?: Record<string, unknown>
	): void {
		events.push({
			id: requestId,
			timestamp: new Date().toISOString(),
			source: 'client',
			level,
			category,
			message,
			data
		});
	}

	/**
	 * Create a console interceptor for a specific method
	 */
	function createConsoleInterceptor(
		method: 'log' | 'info' | 'warn' | 'error' | 'debug',
		original: (...args: unknown[]) => void
	): (...args: unknown[]) => void {
		const levelMap: Record<string, LogLevel> = {
			log: 'info',
			info: 'info',
			warn: 'warn',
			error: 'error',
			debug: 'debug'
		};

		return (...args: unknown[]) => {
			// Call original
			original.apply(console, args);

			// Track count
			consoleCounts[method]++;

			// Log the event
			const category = `console.${method}` as LogCategory;
			const message = args.length > 0 ? String(args[0]) : '';
			addEvent(levelMap[method], category, message.substring(0, 500), {
				args: serializeConsoleArgs(args)
			});
		};
	}

	const logger: RequestLogger = {
		id: requestId,
		startTime,

		debug(category, message, data) {
			addEvent('debug', category, message, data);
		},

		info(category, message, data) {
			addEvent('info', category, message, data);
		},

		warn(category, message, data) {
			addEvent('warn', category, message, data);
		},

		error(category, message, data) {
			addEvent('error', category, message, data);
		},

		logNetworkRequest(data) {
			addEvent('info', 'network.request', `${data.method} ${data.url}`, {
				url: data.url,
				method: data.method,
				headers: redactHeaders(data.headers),
				bodySize: data.bodySize,
				userPrompt: data.userPrompt
			});
		},

		logNetworkResponse(data) {
			addEvent('info', 'network.response', `${data.status} ${data.statusText}`, {
				status: data.status,
				statusText: data.statusText,
				headers: redactHeaders(data.headers),
				contentLength: data.contentLength,
				durationMs: data.durationMs
			});
		},

		logStreamStats(data) {
			streamStats = data;
			addEvent(
				data.success ? 'info' : 'warn',
				'chat.stream.stats',
				`Stream completed: ${data.totalChunks} chunks, ${data.totalBytes} bytes, ${data.durationMs}ms`,
				{
					totalChunks: data.totalChunks,
					totalBytes: data.totalBytes,
					durationMs: data.durationMs,
					success: data.success
				}
			);
		},

		logChatError(error, additionalData) {
			let errorData: Record<string, unknown> = { ...additionalData };

			if (error instanceof Error) {
				errorData = {
					...errorData,
					errorName: error.name,
					errorMessage: error.message,
					errorStack: error.stack
				};
			} else if (typeof error === 'object' && error !== null) {
				errorData = {
					...errorData,
					error: safeSerialize(error)
				};
			} else {
				errorData = {
					...errorData,
					error: String(error)
				};
			}

			addEvent(
				'error',
				'chat.error',
				error instanceof Error ? error.message : String(error),
				errorData
			);
		},

		installConsoleInterceptors() {
			if (originalConsole) return; // Already installed

			originalConsole = {
				log: console.log,
				info: console.info,
				warn: console.warn,
				error: console.error,
				debug: console.debug
			};

			console.log = createConsoleInterceptor('log', originalConsole.log);
			console.info = createConsoleInterceptor('info', originalConsole.info);
			console.warn = createConsoleInterceptor('warn', originalConsole.warn);
			console.error = createConsoleInterceptor('error', originalConsole.error);
			console.debug = createConsoleInterceptor('debug', originalConsole.debug);
		},

		restoreConsole() {
			if (!originalConsole) return;

			console.log = originalConsole.log;
			console.info = originalConsole.info;
			console.warn = originalConsole.warn;
			console.error = originalConsole.error;
			console.debug = originalConsole.debug;

			originalConsole = null;
		},

		getConsoleCounts() {
			return { ...consoleCounts };
		},

		async flush(success, errorMessage) {
			// Add summary event
			const durationMs = Math.round(performance.now() - startTime);
			const summary: ClientSummaryData = {
				requestId,
				durationMs,
				success,
				consoleCounts: { ...consoleCounts },
				streamStats: streamStats || undefined,
				errorMessage
			};

			addEvent(
				success ? 'info' : 'error',
				'client.summary',
				success
					? `Request completed successfully (${durationMs}ms)`
					: `Request failed: ${errorMessage || 'Unknown error'}`,
				summary as unknown as Record<string, unknown>
			);

			// Send to server (fire and forget)
			if (events.length === 0) return;

			const payload: DevLogPayload = {
				id: requestId,
				events
			};

			try {
				// Use sendBeacon if available for reliability, otherwise fetch
				const body = JSON.stringify(payload);

				if (navigator.sendBeacon) {
					navigator.sendBeacon('/api/dev-log', body);
				} else {
					fetch('/api/dev-log', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body,
						keepalive: true
					}).catch(() => {
						// Ignore flush errors - don't break the app
					});
				}
			} catch {
				// Ignore flush errors - don't break the app
			}
		}
	};

	return logger;
}

/**
 * Generate a new correlation ID
 */
export function generateRequestId(): string {
	return crypto.randomUUID();
}

/**
 * Convert Headers object to plain object
 */
export function headersToObject(headers: Headers): Record<string, string> {
	const result: Record<string, string> = {};
	headers.forEach((value, key) => {
		result[key] = value;
	});
	return result;
}
