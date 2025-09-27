import { App, TFile, Notice, normalizePath } from 'obsidian';
import { ensureFolderExists } from '../utils';

export class ArchiveHandler {
	private app: App;

	constructor(app: App) {
		this.app = app;
	}

	/**
	 * Archive all notes with #archived tag to E/Archive folder
	 */
	async archiveTaggedNotes(): Promise<void> {
		try {
			// Get all markdown files in the vault
			const allFiles = this.app.vault.getMarkdownFiles();
			const filesToArchive: TFile[] = [];

			// Search for files containing #archived tag
			for (const file of allFiles) {
				// Skip files already in E/Archive
				if (file.path.startsWith('E/Archive/')) {
					continue;
				}

				try {
					const content = await this.app.vault.read(file);
					
					// Check if file contains #archived tag (in content or frontmatter)
					if (this.containsArchivedTag(content)) {
						filesToArchive.push(file);
					}
				} catch (error) {
					console.warn(`Could not read file ${file.path}:`, error);
				}
			}

			if (filesToArchive.length === 0) {
				new Notice('No files with #archived tag found to archive.');
				return;
			}

			// Ensure E/Archive folder exists
			await ensureFolderExists(this.app, 'E/Archive');

			// Move files to E/Archive
			let movedCount = 0;
			const errors: string[] = [];

			for (const file of filesToArchive) {
				try {
					const newPath = normalizePath(`E/Archive/${file.name}`);
					
					// Check if file already exists at destination
					const existingFile = this.app.vault.getAbstractFileByPath(newPath);
					if (existingFile) {
						// Generate unique name
						const uniquePath = await this.generateUniquePath(newPath);
						await this.app.fileManager.renameFile(file, uniquePath);
					} else {
						await this.app.fileManager.renameFile(file, newPath);
					}
					
					movedCount++;
				} catch (error) {
					errors.push(`${file.name}: ${(error as Error).message}`);
				}
			}

			// Show results
			if (movedCount > 0) {
				new Notice(`✅ Archived ${movedCount} file(s) to E/Archive`);
			}

			if (errors.length > 0) {
				new Notice(`⚠️ ${errors.length} file(s) could not be archived. Check console for details.`);
				console.error('Archive errors:', errors);
			}

		} catch (error) {
			new Notice(`Error during archiving: ${(error as Error).message}`);
			console.error('Archive process error:', error);
		}
	}

	/**
	 * Check if content contains #archived tag
	 */
	private containsArchivedTag(content: string): boolean {
		// Check for #archived in content (case insensitive)
		const contentMatch = content.toLowerCase().includes('#archived');
		
		// Check for archived tag in frontmatter
		const frontmatterMatch = this.checkFrontmatterForArchivedTag(content);
		
		return contentMatch || frontmatterMatch;
	}

	/**
	 * Check frontmatter for archived tag
	 */
	private checkFrontmatterForArchivedTag(content: string): boolean {
		const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---/;
		const match = content.match(frontmatterRegex);
		
		if (!match) return false;
		
		const frontmatter = match[1].toLowerCase();
		
		// Check various frontmatter formats:
		// tags: [archived]
		// tags: archived
		// tags:
		//   - archived
		return frontmatter.includes('archived') && 
			   (frontmatter.includes('tags:') || frontmatter.includes('tag:'));
	}

	/**
	 * Generate unique path if file already exists
	 */
	private async generateUniquePath(basePath: string): Promise<string> {
		const pathWithoutExt = basePath.replace(/\.md$/, '');
		let counter = 1;
		let uniquePath = basePath;

		while (this.app.vault.getAbstractFileByPath(uniquePath)) {
			uniquePath = `${pathWithoutExt} (${counter}).md`;
			counter++;
		}

		return normalizePath(uniquePath);
	}
}
