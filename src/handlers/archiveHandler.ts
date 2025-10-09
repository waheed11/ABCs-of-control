import { App, TFile, TFolder, TAbstractFile, Notice, normalizePath } from 'obsidian';
import { ensureFolderExists, getRoleRoot, isPathUnder } from '../utils';
import { ArchiveSettings } from '../types';

export class ArchiveHandler {
	private app: App;

	constructor(app: App) {
		this.app = app;
	}

	    /**
    	 * Archive all notes with #archived tag to archive root (language-aware)
    	 */
    /**
 * Archive all notes with #archived tag to archive root (language-aware)
 */
async archiveTaggedNotes(): Promise<void> {
	try {
	  const archiveRoot = getRoleRoot(this.app, 'E');
	  const allFiles = this.app.vault.getMarkdownFiles();
	  const filesToArchive: TFile[] = [];
  
	  // Scan all notes, skip those already under archive root
	  for (const file of allFiles) {
		if (isPathUnder(file.path, archiveRoot)) continue;
		try {
		  const content = await this.app.vault.read(file);
		  if (this.containsArchivedTag(content)) {
			filesToArchive.push(file);
		  }
		} catch (err) {
		  console.warn(`Failed to read ${file.path} while scanning for #archived:`, err);
		}
	  }
  
	  if (filesToArchive.length === 0) {
		new Notice(`No files with #archived tag found to archive in ${archiveRoot}.`);
		return;
	  }
  
	  // Ensure destination root exists
	  await ensureFolderExists(this.app, archiveRoot);
  
	  // Move files (handle naming conflicts)
	  let movedCount = 0;
	  const errors: string[] = [];
	  for (const file of filesToArchive) {
		try {
		  const newPath = normalizePath(`${archiveRoot}/${file.name}`);
		  const existingFile = this.app.vault.getAbstractFileByPath(newPath);
		  if (existingFile) {
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
  
	  if (movedCount > 0) {
		new Notice(`✅ Archived ${movedCount} file(s) to ${archiveRoot}`);
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
	/**
 * Get files that should be archived based on age settings
 */
async getFilesToArchiveByAge(settings: ArchiveSettings): Promise<{ file: TFile; age: number }[]> {
	if (!settings.enabled) {
		return [];
	}

	const allFiles = this.app.vault.getMarkdownFiles();
	const filesToArchive: { file: TFile; age: number }[] = [];
	const now = Date.now();
	const cutoffTime = now - (settings.archiveAfterDays * 24 * 60 * 60 * 1000);
	const archiveRoot = getRoleRoot(this.app, 'E');

	for (const file of allFiles) {
		// Skip files already under archive root
		if (isPathUnder(file.path, archiveRoot)) {
			continue;
		}

		// Skip excluded folders
		if (this.isFileInExcludedFolder(file, settings.excludeFolders)) {
			continue;
		}

		// Check file age
		const creationTime = file.stat.ctime;
		if (creationTime < cutoffTime) {
			const ageInDays = Math.floor((now - creationTime) / (24 * 60 * 60 * 1000));
			filesToArchive.push({ file, age: ageInDays });
		}
	}

	return filesToArchive;
}

/**
 * Archive files based on age settings
 */
async archiveFilesByAge(settings: ArchiveSettings): Promise<void> {
	const filesToArchive = await this.getFilesToArchiveByAge(settings);
	
	if (filesToArchive.length === 0) {
		new Notice('No files found that match the archive criteria');
		return;
	}

	const archiveRoot = getRoleRoot(this.app, 'E');
	await ensureFolderExists(this.app, archiveRoot);

	// Move files to E/Archive
	let movedCount = 0;
	const errors: string[] = [];

	for (const { file } of filesToArchive) {
		try {
			const newPath = normalizePath(`${archiveRoot}/${file.name}`);
			
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
		new Notice(`✅ Archived ${movedCount} old file(s) to ${archiveRoot}`);
	}

	if (errors.length > 0) {
		new Notice(`⚠️ ${errors.length} file(s) could not be archived. Check console for details.`);
		console.error('Archive errors:', errors);
	}
}
async archiveSpecificFiles(filesToArchive: { file: any; age: number }[]): Promise<void> {
	let movedCount = 0;
	const errors: string[] = [];
	const archiveRoot = getRoleRoot(this.app, 'E');

	for (const { file } of filesToArchive) {
		try {
			const archivePath = `${archiveRoot}/${file.name}`;
			
			// Ensure archive root exists
			await ensureFolderExists(this.app, archiveRoot);
			
			// Handle naming conflicts
			let finalPath = archivePath;
			let counter = 1;
			while (this.app.vault.getAbstractFileByPath(finalPath)) {
				const nameWithoutExt = file.basename;
				const ext = file.extension;
				finalPath = `${archiveRoot}/${nameWithoutExt} (${counter}).${ext}`;
				counter++;
			}
			
			// Move the file
			await this.app.vault.rename(file, finalPath);
			movedCount++;
		} catch (error) {
			errors.push(`Failed to archive ${file.name}: ${error.message}`);
		}
	}

	// Show results
	if (movedCount > 0) {
		new Notice(`✅ Successfully archived ${movedCount} file(s) to ${archiveRoot}`);
	}
	
	if (errors.length > 0) {
		new Notice(`❌ ${errors.length} file(s) failed to archive. Check console for details.`);
		console.error('Archive errors:', errors);
	}
}

	/**
	 * Check if file is in excluded folder
	 */
	private isFileInExcludedFolder(file: TFile, excludeFolders: string[]): boolean {
		return excludeFolders.some(folder => 
			file.path.toLowerCase().startsWith(folder.toLowerCase() + '/') ||
			file.path.toLowerCase() === folder.toLowerCase()
		);
	}
	/** Move a folder (project or exam) to a new location, creating parents and resolving conflicts. */
async moveFolder(fromPath: string, toPath: string): Promise<string> {
	const src = this.app.vault.getAbstractFileByPath(normalizePath(fromPath));
	if (!src || !(src instanceof TFolder)) {
	  throw new Error(`Source folder not found or not a folder: ${fromPath}`);
	}
  
	// Ensure destination parent exists
	const destParent = toPath.split('/').slice(0, -1).join('/');
	if (destParent) {
	  await ensureFolderExists(this.app, destParent);
	}
  
	// Resolve name conflicts
	let finalDest = normalizePath(toPath);
	if (this.app.vault.getAbstractFileByPath(finalDest)) {
	  finalDest = await this.generateUniqueFolderPath(finalDest);
	}
  
	await this.app.fileManager.renameFile(src as TAbstractFile, finalDest);
	return finalDest;
  }
  
  /** Move a D/{Projects|Exams}/[name] folder to E/{Projects|Exams}/[name] */
async moveProjectOrExam(kind: 'project' | 'exam', name: string): Promise<string> {
	const kindFolder = kind === 'project' ? 'Projects' : 'Exams';
	const fromPath = `D/${kindFolder}/${name}`;
	const archiveRoot = getRoleRoot(this.app, 'E');
	const toPath = `${archiveRoot}/${kindFolder}/${name}`;
	return await this.moveFolder(fromPath, toPath);
  }
  
  /** Generate a unique destination folder path if one already exists */
  private async generateUniqueFolderPath(basePath: string): Promise<string> {
	let counter = 1;
	let candidate = basePath;
	while (this.app.vault.getAbstractFileByPath(candidate)) {
	  candidate = `${basePath} (${counter})`;
	  counter++;
	}
	return normalizePath(candidate);
  }
}
