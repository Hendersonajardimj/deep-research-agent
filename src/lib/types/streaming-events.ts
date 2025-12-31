/**
 * Streaming event types for deep research orchestration
 * These are emitted as Vercel AI SDK data parts during the research process
 */

export type ResearchPhase =
	| 'planning'      // Creating the outline
	| 'dispatching'   // Spawning subagents
	| 'researching'   // Subagents working
	| 'synthesizing'  // Merging results
	| 'complete'      // All done
	| 'error';        // Something failed

export type SectionStatus =
	| 'queued'        // Not started yet
	| 'running'       // Currently researching
	| 'synthesizing'  // Processing results
	| 'done'          // Completed successfully
	| 'error';        // Failed

/**
 * Global run status - shows current phase and overall progress
 * Part ID: `run:${runId}`
 * Persistent: Yes
 */
export interface RunStatusPart {
	type: 'run-status';
	runId: string;
	phase: ResearchPhase;
	phaseMessage: string;
	completedSections: number;
	totalSections: number;
	timestamp: string;
}

/**
 * Research outline - the 5 subtopics to research
 * Part ID: `outline:${runId}`
 * Persistent: Yes
 */
export interface OutlinePart {
	type: 'outline';
	runId: string;
	topic: string;
	sections: Array<{
		id: string;
		title: string;
		description: string;
	}>;
	timestamp: string;
}

/**
 * Per-section progress and results
 * Part ID: `section:${runId}:${sectionId}`
 * Persistent: Yes
 */
export interface SectionStatusPart {
	type: 'section-status';
	runId: string;
	sectionId: string;
	sectionTitle: string;
	status: SectionStatus;
	progress?: {
		sourcesFound?: number;
		keyFindings?: string[];
		preview?: string;
	};
	error?: string;
	timestamp: string;
}

/**
 * Heartbeat for long-running operations
 * Part ID: `heartbeat:${runId}`
 * Persistent: No (transient)
 */
export interface HeartbeatPart {
	type: 'heartbeat';
	runId: string;
	message: string;
	secondsSinceLastUpdate: number;
	timestamp: string;
}

/**
 * Union type of all streaming events
 */
export type StreamingEvent =
	| RunStatusPart
	| OutlinePart
	| SectionStatusPart
	| HeartbeatPart;

/**
 * Helper to create stable IDs for reconciliation
 */
export function createPartId(event: StreamingEvent): string {
	switch (event.type) {
		case 'run-status':
			return `run:${event.runId}`;
		case 'outline':
			return `outline:${event.runId}`;
		case 'section-status':
			return `section:${event.runId}:${event.sectionId}`;
		case 'heartbeat':
			return `heartbeat:${event.runId}`;
	}
}
