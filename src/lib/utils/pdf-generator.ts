import puppeteer from 'puppeteer';
import { marked } from 'marked';
import fs from 'fs/promises';
import path from 'path';
import { logToolExecution, serializeError } from '$lib/logging/server-logger';

/**
 * Convert markdown content to PDF
 */
export async function generatePDF(
	markdownPath: string,
	outputPath?: string
): Promise<string> {
	const toolId = crypto.randomUUID();
	const startTime = performance.now();

	// Log tool start
	await logToolExecution(toolId, {
		toolName: 'pdfGenerator',
		phase: 'start',
		parameters: { markdownPath, outputPath }
	});

	try {
		// Read the markdown file
		const markdownContent = await fs.readFile(markdownPath, 'utf-8');

		// Strip frontmatter if present
		const contentWithoutFrontmatter = markdownContent.replace(/^---[\s\S]*?---\n/, '');

		// Convert markdown to HTML
		const htmlContent = await marked(contentWithoutFrontmatter);

		// Create styled HTML document
		const styledHTML = `
<!DOCTYPE html>
<html>
<head>
	<meta charset="UTF-8">
	<style>
		body {
			font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
			line-height: 1.6;
			color: #333;
			max-width: 800px;
			margin: 0 auto;
			padding: 2rem;
		}
		h1 {
			color: #1a1a1a;
			border-bottom: 2px solid #007aff;
			padding-bottom: 0.5rem;
			margin-bottom: 1.5rem;
		}
		h2 {
			color: #1a1a1a;
			margin-top: 2rem;
			margin-bottom: 1rem;
		}
		h3 {
			color: #333;
			margin-top: 1.5rem;
		}
		code {
			background: #f5f5f5;
			padding: 0.2rem 0.4rem;
			border-radius: 3px;
			font-family: 'Monaco', 'Courier New', monospace;
			font-size: 0.9em;
		}
		pre {
			background: #f5f5f5;
			padding: 1rem;
			border-radius: 6px;
			overflow-x: auto;
		}
		pre code {
			background: none;
			padding: 0;
		}
		blockquote {
			border-left: 4px solid #007aff;
			margin-left: 0;
			padding-left: 1rem;
			color: #666;
		}
		a {
			color: #007aff;
			text-decoration: none;
		}
		a:hover {
			text-decoration: underline;
		}
		img {
			max-width: 100%;
			height: auto;
		}
		table {
			border-collapse: collapse;
			width: 100%;
			margin: 1rem 0;
		}
		th, td {
			border: 1px solid #ddd;
			padding: 0.75rem;
			text-align: left;
		}
		th {
			background: #f5f5f5;
			font-weight: 600;
		}
	</style>
</head>
<body>
	${htmlContent}
</body>
</html>
`;

		// Generate PDF using Puppeteer
		const browser = await puppeteer.launch({
			headless: true,
			args: ['--no-sandbox', '--disable-setuid-sandbox']
		});

		try {
			const page = await browser.newPage();
			await page.setContent(styledHTML, { waitUntil: 'networkidle0' });

			// Determine output path
			const pdfPath = outputPath || markdownPath.replace('.md', '.pdf');

			await page.pdf({
				path: pdfPath,
				format: 'A4',
				margin: {
					top: '1.5cm',
					right: '1.5cm',
					bottom: '1.5cm',
					left: '1.5cm'
				},
				printBackground: true
			});

			console.log(`Generated PDF: ${pdfPath}`);

			// Get file size for logging
			const stats = await fs.stat(pdfPath);

			// Log tool success
			await logToolExecution(toolId, {
				toolName: 'pdfGenerator',
				phase: 'success',
				result: {
					pdfPath,
					fileSizeBytes: stats.size
				},
				durationMs: Math.round(performance.now() - startTime)
			});

			return pdfPath;
		} finally {
			await browser.close();
		}
	} catch (error) {
		// Log tool error
		await logToolExecution(toolId, {
			toolName: 'pdfGenerator',
			phase: 'error',
			error: serializeError(error),
			durationMs: Math.round(performance.now() - startTime)
		});
		throw error;
	}
}
