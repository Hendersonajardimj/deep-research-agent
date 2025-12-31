import { exec } from 'child_process';
import { promisify } from 'util';
import { getResearchOutputPath } from '$lib/utils/file-operations';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { logSystem, serializeError } from '$lib/logging/server-logger';

const execAsync = promisify(exec);

export const POST: RequestHandler = async () => {
	const id = crypto.randomUUID();

	try {
		const outputPath = await getResearchOutputPath();

		await logSystem(id, 'system', 'Opening research folder in Finder', {
			path: outputPath
		});

		// Open the folder in Finder (macOS)
		await execAsync(`open "${outputPath}"`);

		await logSystem(id, 'system', 'Successfully opened Finder', {
			path: outputPath,
			success: true
		});

		return json({ success: true, path: outputPath });
	} catch (error) {
		await logSystem(id, 'system', 'Failed to open Finder', {
			error: serializeError(error),
			success: false
		}, 'error');

		console.error('Error opening Finder:', error);
		return json(
			{ success: false, error: 'Failed to open Finder' },
			{ status: 500 }
		);
	}
};
