/**
 * Server-side helpers for emitting streaming events
 * These work with Vercel AI SDK's streamText and data parts
 */

import type {
	StreamingEvent,
	RunStatusPart,
	OutlinePart,
	SectionStatusPart,
	HeartbeatPart,
	ResearchPhase,
	SectionStatus
} from '$lib/types/streaming-events';
import { createPartId } from '$lib/types/streaming-events';

/**
 * Helper to create a run status event
 */
export function createRunStatus(
	runId: string,
	phase: ResearchPhase,
	phaseMessage: string,
	completedSections: number = 0,
	totalSections: number = 5
): RunStatusPart {
	return {
		type: 'run-status',
		runId,
		phase,
		phaseMessage,
		completedSections,
		totalSections,
		timestamp: new Date().toISOString()
	};
}

/**
 * Helper to create an outline event
 */
export function createOutline(
	runId: string,
	topic: string,
	sections: Array<{ id: string; title: string; description: string }>
): OutlinePart {
	return {
		type: 'outline',
		runId,
		topic,
		sections,
		timestamp: new Date().toISOString()
	};
}

/**
 * Helper to create a section status event
 */
export function createSectionStatus(
	runId: string,
	sectionId: string,
	sectionTitle: string,
	status: SectionStatus,
	progress?: {
		sourcesFound?: number;
		keyFindings?: string[];
		preview?: string;
	},
	error?: string
): SectionStatusPart {
	return {
		type: 'section-status',
		runId,
		sectionId,
		sectionTitle,
		status,
		progress,
		error,
		timestamp: new Date().toISOString()
	};
}

/**
 * Helper to create a heartbeat event
 */
export function createHeartbeat(
	runId: string,
	message: string,
	secondsSinceLastUpdate: number
): HeartbeatPart {
	return {
		type: 'heartbeat',
		runId,
		message,
		secondsSinceLastUpdate,
		timestamp: new Date().toISOString()
	};
}

/**
 * Format an event as a data part for AI SDK
 * Returns the part object ready to be sent via streamText
 */
export function formatAsDataPart(event: StreamingEvent) {
	const id = createPartId(event);

	return {
		type: 'data' as const,
		id,
		data: event
	};
}
