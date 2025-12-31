/**
 * Dev Log Ingestion API
 *
 * Accepts batched log events from the browser and writes them to the server log file.
 * This endpoint is only active in development (or when ENABLE_DEV_LOGGING is set).
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { dev } from '$app/environment';
import { logEvent } from '$lib/logging/server-logger';
import type { LogEvent, DevLogPayload } from '$lib/logging/types';

/**
 * Check if dev logging is enabled
 */
function isLoggingEnabled(): boolean {
	// Check explicit env flag first
	const envFlag = process.env.ENABLE_DEV_LOGGING;
	if (envFlag !== undefined) {
		return envFlag === 'true' || envFlag === '1';
	}
	// Default to enabled in dev mode
	return dev;
}

/**
 * POST /api/dev-log
 *
 * Accepts a batch of log events from the client and persists them.
 * Request body: { id: string, events: LogEvent[] }
 */
export const POST: RequestHandler = async ({ request }) => {
	// Check if logging is enabled
	if (!isLoggingEnabled()) {
		throw error(404, 'Not found');
	}

	try {
		const payload: DevLogPayload = await request.json();

		// Validate payload structure
		if (!payload.id || typeof payload.id !== 'string') {
			throw error(400, 'Missing or invalid correlation id');
		}

		if (!Array.isArray(payload.events)) {
			throw error(400, 'Events must be an array');
		}

		// Process each event
		const results = await Promise.allSettled(
			payload.events.map(async (event: Partial<LogEvent>) => {
				// Force source to 'client' for all incoming events
				const clientEvent: LogEvent = {
					id: payload.id,
					timestamp: event.timestamp || new Date().toISOString(),
					source: 'client',
					level: event.level || 'info',
					category: event.category || 'system',
					message: event.message || '',
					data: event.data
				};

				await logEvent(clientEvent);
			})
		);

		// Count successes and failures
		const succeeded = results.filter((r) => r.status === 'fulfilled').length;
		const failed = results.filter((r) => r.status === 'rejected').length;

		return json({
			success: true,
			processed: succeeded,
			failed
		});
	} catch (err) {
		// If it's already an HTTP error, rethrow it
		if (err && typeof err === 'object' && 'status' in err) {
			throw err;
		}

		console.error('Error processing dev-log request:', err);
		throw error(500, 'Failed to process log events');
	}
};

/**
 * GET /api/dev-log
 *
 * Returns status information about the dev logging system.
 * Useful for checking if logging is enabled.
 */
export const GET: RequestHandler = async () => {
	if (!isLoggingEnabled()) {
		throw error(404, 'Not found');
	}

	return json({
		enabled: true,
		environment: dev ? 'development' : 'production'
	});
};
