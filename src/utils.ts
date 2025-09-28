import { App, Modal, TFile, TFolder, MarkdownView, MarkdownFileInfo, normalizePath } from 'obsidian';
import * as path from 'path';
import { HeadingMeta } from './types';
import { ALPHABET } from './constants';

export async function confirmModal(
  app: App,
  title: string,
  message: string,
  okText = 'OK',
  cancelText = 'Cancel'
): Promise<boolean> {
  return new Promise(resolve => {
    const modal = new Modal(app);
    const { contentEl } = modal;
    contentEl.empty();

    let decided = false; // guard to avoid double resolution

    contentEl.createEl('h2', { text: title });
    contentEl.createEl('p', { text: message });

    const btns = contentEl.createDiv({ cls: 'button-container' });
    const cancel = btns.createEl('button', { text: cancelText });
    const ok = btns.createEl('button', { text: okText, cls: 'mod-cta' });

    cancel.addEventListener('click', () => {
      if (!decided) {
        decided = true;
        resolve(false);
      }
      modal.close();
    });

    ok.addEventListener('click', () => {
      if (!decided) {
        decided = true;
        resolve(true);
      }
      modal.close();
    });

    const origOnClose = modal.onClose.bind(modal);
    modal.onClose = () => {
      // Only resolve false if neither button decided the result
      if (!decided) resolve(false);
      origOnClose();
    };

    modal.open();
  });
}
/**
 * Detect if content contains Arabic text
 */
export function detectArabicContent(content: string): boolean {
	// Check if the content contains Arabic characters
	// Arabic Unicode range is U+0600 to U+06FF
	const arabicRegex = /[\u0600-\u06FF]/;
	return arabicRegex.test(content);
}

/**
 * Helper function to get TFile from either MarkdownView or MarkdownFileInfo
 */
export function getFileFromView(view: MarkdownView | MarkdownFileInfo): TFile | null {
	if (view instanceof MarkdownView) {
		return view.file;
	} else if ('file' in view) {
		return view.file;
	}
	return null;
}

/**
 * Parse section number from heading text, handling Arabic-Indic digits
 */
export function parseSection(text: string): number[] {
	// Normalize Arabic-Indic digits to western digits before parsing
	const toWestern = (s: string) => s
		.replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660))
		.replace(/[\u06F0-\u06F9]/g, (d) => String(d.charCodeAt(0) - 0x06F0));
	
	const normalized = toWestern(text);
	const match = normalized.match(/^\s*(\d+(?:\.\d+)*)\b\.?/);
	return match ? match[1].split('.').map(n => parseInt(n, 10)) : [];
}

/**
 * Compare two section number arrays for proper ordering
 */
export function compareSection(a: number[], b: number[]): number {
	const len = Math.max(a.length, b.length);
	for (let i = 0; i < len; i++) {
		const av = a[i] ?? 0;
		const bv = b[i] ?? 0;
		if (av !== bv) return av - bv;
	}
	return a.length - b.length;
}

/**
 * Ensure a folder exists, creating it recursively if needed
 */
export async function ensureFolderExists(app: App, folderPath: string): Promise<void> {
	const existing = app.vault.getAbstractFileByPath(folderPath);
	if (existing instanceof TFolder) return;
	
	// Recursively create folders
	const parts = folderPath.split('/');
	let current = '';
	for (const p of parts) {
		current = current ? `${current}/${p}` : p;
		const f = app.vault.getAbstractFileByPath(current);
		if (!f) {
			await app.vault.createFolder(current);
		}
	}
}

/**
 * Get files in a folder
 */
export async function getFilesInFolder(folder: TFolder): Promise<TFile[]> {
	const files: TFile[] = [];
	
	for (const child of folder.children) {
		if (child instanceof TFile && child.extension === 'md') {
			files.push(child);
		}
	}
	
	return files;
}

/**
 * Get all template files organized by letter
 */
export async function getTemplateFiles(app: App, templateFolderPath: string): Promise<Map<string, TFile[]>> {
	const templateMap = new Map<string, TFile[]>();
	
	// Initialize map with empty arrays for each letter
	ALPHABET.forEach(letter => {
		templateMap.set(letter, []);
	});
	
	// Get the template folder
	const templateFolder = app.vault.getAbstractFileByPath(templateFolderPath);
	
	if (!templateFolder || !(templateFolder instanceof TFolder)) {
		return templateMap;
	}
	
	// Process all files in the template folder
	for (const file of templateFolder.children) {
		if (file instanceof TFile && file.extension === 'md') {
			const fileName = file.basename;
			
			// Check if the file name starts with our special Content-to-D-Projects- prefix
			if (fileName.startsWith('Content-to-D-Projects-')) {
				// Force-list under D
				const letterFiles = templateMap.get('D') || [];
				letterFiles.push(file);
				templateMap.set('D', letterFiles);
				continue;
			}
			// Check if the file name starts with our special Tips-to-E-Exams- prefix
			if (fileName.startsWith('Tips-to-D-Exams-')) {
				// Force-list under E
				const letterFiles = templateMap.get('D') || [];
				letterFiles.push(file);
				templateMap.set('D', letterFiles);
				continue;
			}
			// Check if the file name starts with "Insert-to-"
			if (fileName.startsWith('Insert-to-')) {
				// Extract the letter after "Insert-to-"
				const parts = fileName.substring('Insert-to-'.length).split('-');
				if (parts.length > 0) {
					const letter = parts[0].toUpperCase();
					if (ALPHABET.includes(letter)) {
						const letterFiles = templateMap.get(letter) || [];
						letterFiles.push(file);
						templateMap.set(letter, letterFiles);
					}
				}
			} else if (fileName.startsWith('Invoke-')) {
				// Extract the letter after "Invoke-"
				const parts = fileName.substring('Invoke-'.length).split('-');
				if (parts.length > 0) {
					const letter = parts[0].toUpperCase();
					if (ALPHABET.includes(letter)) {
						const letterFiles = templateMap.get(letter) || [];
						letterFiles.push(file);
						templateMap.set(letter, letterFiles);
					}
				}
			} else {
				// Check if the file name starts with a letter followed by a dash
				const firstChar = fileName.charAt(0).toUpperCase();
				if (ALPHABET.includes(firstChar) && fileName.charAt(1) === '-') {
					const letterFiles = templateMap.get(firstChar) || [];
					letterFiles.push(file);
					templateMap.set(firstChar, letterFiles);
				}
			}
		} else if (file instanceof TFolder) {
			// Process files within subfolders
			const folderFiles = await getFilesInFolder(file);
			
			// Add folder to the map with its files
			if (folderFiles.length > 0) {
				const folderName = file.name;
				templateMap.set(folderName, folderFiles);
			}
		}
	}
	
	return templateMap;
}

/**
 * Extract JavaScript code from template content
 */
export function extractJavaScriptCode(templateContent: string): string {
	// First, check for Templater syntax <%* ... %>
	const templaterRegex = /<%\*([\s\S]*?)%>/g;
	const templaterMatches = [...templateContent.matchAll(templaterRegex)];
	
	if (templaterMatches.length > 0) {
		// Return the content of the first Templater code block
		return templaterMatches[0][1].trim();
	}
	
	// If no Templater syntax, look for code blocks with js, javascript, or typescript language specifiers
	const codeBlockRegex = /```(?:js|javascript|typescript)\s*([\s\S]*?)```/g;
	const matches = [...templateContent.matchAll(codeBlockRegex)];
	
	if (matches.length > 0) {
		// Return the content of the first code block
		return matches[0][1].trim();
	}
	
	// If no code block is found, check if the entire content is JavaScript
	// This is a fallback for templates that don't use code blocks
	if (templateContent.trim().startsWith('//') || 
		templateContent.trim().startsWith('/*') || 
		templateContent.trim().startsWith('function') || 
		templateContent.trim().startsWith('const') || 
		templateContent.trim().startsWith('let') || 
		templateContent.trim().startsWith('var') || 
		templateContent.trim().startsWith('import')) {
		return templateContent.trim();
	}
	
	return '';
}
