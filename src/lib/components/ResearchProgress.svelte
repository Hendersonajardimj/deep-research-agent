<script lang="ts">
	import type { RunStatusPart, OutlinePart, SectionStatusPart } from '$lib/types/streaming-events';

	interface Props {
		runStatus?: RunStatusPart;
		outline?: OutlinePart;
		sections?: Map<string, SectionStatusPart>;
	}

	let { runStatus, outline, sections = new Map() }: Props = $props();

	function getStatusColor(status: string): string {
		switch (status) {
			case 'queued': return 'bg-gray-100 text-gray-600';
			case 'running': return 'bg-blue-100 text-blue-700';
			case 'synthesizing': return 'bg-purple-100 text-purple-700';
			case 'done': return 'bg-green-100 text-green-700';
			case 'error': return 'bg-red-100 text-red-700';
			default: return 'bg-gray-100 text-gray-600';
		}
	}

	function getPhaseColor(phase: string): string {
		switch (phase) {
			case 'planning': return 'bg-blue-500';
			case 'dispatching': return 'bg-purple-500';
			case 'researching': return 'bg-yellow-500';
			case 'synthesizing': return 'bg-orange-500';
			case 'complete': return 'bg-green-500';
			case 'error': return 'bg-red-500';
			default: return 'bg-gray-500';
		}
	}
</script>

{#if runStatus}
	<div class="bg-white border border-gray-200 rounded-lg p-4 mb-4 shadow-sm">
		<!-- Phase Header -->
		<div class="flex items-center gap-3 mb-3">
			<div class="w-2 h-2 rounded-full {getPhaseColor(runStatus.phase)} animate-pulse"></div>
			<div class="flex-1">
				<div class="text-sm font-semibold text-gray-900">{runStatus.phaseMessage}</div>
				<div class="text-xs text-gray-500">
					{runStatus.completedSections}/{runStatus.totalSections} sections complete
				</div>
			</div>
			<div class="text-xs text-gray-400">
				{new Date(runStatus.timestamp).toLocaleTimeString()}
			</div>
		</div>

		<!-- Progress Bar -->
		{#if runStatus.totalSections > 0}
			<div class="w-full bg-gray-200 rounded-full h-2">
				<div
					class="bg-blue-500 h-2 rounded-full transition-all duration-500"
					style="width: {(runStatus.completedSections / runStatus.totalSections) * 100}%"
				></div>
			</div>
		{/if}
	</div>
{/if}

{#if outline}
	<div class="bg-white border border-gray-200 rounded-lg p-4 mb-4">
		<h3 class="font-semibold text-gray-900 mb-2">Research Outline</h3>
		<p class="text-sm text-gray-600 mb-3">{outline.topic}</p>
		<div class="space-y-2">
			{#each outline.sections as section, i}
				{@const sectionStatus = sections.get(section.id)}
				<div class="flex items-start gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors">
					<div class="flex-shrink-0 w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-xs font-medium text-gray-600">
						{i + 1}
					</div>
					<div class="flex-1 min-w-0">
						<div class="font-medium text-sm text-gray-900">{section.title}</div>
						<div class="text-xs text-gray-500 mt-0.5">{section.description}</div>
						{#if sectionStatus}
							<div class="mt-2 flex items-center gap-2">
								<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium {getStatusColor(sectionStatus.status)}">
									{sectionStatus.status}
								</span>
								{#if sectionStatus.progress?.sourcesFound}
									<span class="text-xs text-gray-500">
										{sectionStatus.progress.sourcesFound} sources
									</span>
								{/if}
							</div>
							{#if sectionStatus.progress?.preview}
								<div class="mt-1 text-xs text-gray-600 italic line-clamp-2">
									{sectionStatus.progress.preview}
								</div>
							{/if}
						{/if}
					</div>
				</div>
			{/each}
		</div>
	</div>
{/if}
