import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { OPENAI_API_KEY, TAVILY_API_KEY } from '$env/static/private';
import { logSystem } from '$lib/logging/server-logger';

/**
 * Check if required API keys are configured
 */
export const GET: RequestHandler = async () => {
	const id = crypto.randomUUID();
	const openaiKey = OPENAI_API_KEY;
	const tavilyKey = TAVILY_API_KEY;

	const configStatus = {
		openaiConfigured: !!openaiKey && openaiKey.length > 0,
		tavilyConfigured: !!tavilyKey && tavilyKey.length > 0,
		allConfigured: !!(openaiKey && tavilyKey && openaiKey.length > 0 && tavilyKey.length > 0)
	};

	await logSystem(id, 'system.config.check', 'Config check performed', {
		openaiConfigured: configStatus.openaiConfigured,
		tavilyConfigured: configStatus.tavilyConfigured,
		allConfigured: configStatus.allConfigured
	});

	return json(configStatus);
};
