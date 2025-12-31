import fs from 'fs/promises';
import path from 'path';

const RESEARCH_OUTPUT_DIR = process.env.RESEARCH_OUTPUT_DIR || './research-output';

/**
 * Create a slug from a string (for file naming)
 */
function slugify(text: string): string {
	return text
		.toLowerCase()
		.replace(/[^\w\s-]/g, '')
		.replace(/\s+/g, '-')
		.replace(/-+/g, '-')
		.trim();
}

/**
 * Ensure the research output directory exists
 */
async function ensureOutputDirectory(topicSlug: string): Promise<string> {
	const topicDir = path.join(RESEARCH_OUTPUT_DIR, topicSlug);
	await fs.mkdir(topicDir, { recursive: true });
	return topicDir;
}

/**
 * Generate frontmatter for the markdown file
 */
function generateFrontmatter(data: {
	subtopic: string;
	parentTopic: string;
	sectionNumber: number;
	createdAt: string;
}): string {
	return `---
title: "${data.subtopic}"
parent_topic: "${data.parentTopic}"
section: ${data.sectionNumber}
created_at: ${data.createdAt}
generated_by: deep-research-agent
---

`;
}

/**
 * Save a markdown report to the filesystem
 */
export async function saveMarkdownReport(data: {
	content: string;
	subtopic: string;
	parentTopic: string;
	sectionNumber: number;
}): Promise<string> {
	const timestamp = new Date().toISOString();
	const topicSlug = slugify(data.parentTopic);
	const subtopicSlug = slugify(data.subtopic);

	// Ensure directory exists
	const topicDir = await ensureOutputDirectory(topicSlug);

	// Generate filename: section-number_subtopic-slug.md
	const filename = `${String(data.sectionNumber).padStart(2, '0')}_${subtopicSlug}.md`;
	const filePath = path.join(topicDir, filename);

	// Create frontmatter
	const frontmatter = generateFrontmatter({
		subtopic: data.subtopic,
		parentTopic: data.parentTopic,
		sectionNumber: data.sectionNumber,
		createdAt: timestamp
	});

	// Combine frontmatter and content
	const fullContent = frontmatter + data.content;

	// Write file
	await fs.writeFile(filePath, fullContent, 'utf-8');

	console.log(`Saved markdown report: ${filePath}`);
	return filePath;
}

/**
 * Get the absolute path to the research output directory
 */
export async function getResearchOutputPath(): Promise<string> {
	const absolutePath = path.resolve(RESEARCH_OUTPUT_DIR);
	await fs.mkdir(absolutePath, { recursive: true });
	return absolutePath;
}

/**
 * List all research topics (directories) in the output folder
 */
export async function listResearchTopics(): Promise<string[]> {
	try {
		const outputPath = await getResearchOutputPath();
		const entries = await fs.readdir(outputPath, { withFileTypes: true });
		return entries
			.filter(entry => entry.isDirectory())
			.map(entry => entry.name);
	} catch (error) {
		console.error('Error listing research topics:', error);
		return [];
	}
}

/**
 * List all markdown files for a specific research topic
 */
export async function listTopicReports(topicSlug: string): Promise<string[]> {
	try {
		const topicPath = path.join(RESEARCH_OUTPUT_DIR, topicSlug);
		const files = await fs.readdir(topicPath);
		return files.filter(file => file.endsWith('.md'));
	} catch (error) {
		console.error(`Error listing reports for topic ${topicSlug}:`, error);
		return [];
	}
}
