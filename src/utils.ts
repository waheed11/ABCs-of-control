import { App, Modal, TFile, TFolder, MarkdownView, MarkdownFileInfo, normalizePath, Notice } from 'obsidian';
import { Profile, RoleLetter, ABCsOfControlPluginAPI, SettingsRoot, PipelineConfig } from './types';
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
	// Normalize the path
	const normalizedPath = normalizePath(folderPath);
	const existing = app.vault.getAbstractFileByPath(normalizedPath);
	if (existing instanceof TFolder) return;
	
	// Recursively create folders
	const parts = normalizedPath.split('/');
	let current = '';
	for (const p of parts) {
		if (!p) continue; // Skip empty parts
		current = current ? `${current}/${p}` : p;
		const f = app.vault.getAbstractFileByPath(current);
		if (!f) {
			try {
				await app.vault.createFolder(current);
			} catch (error) {
				// Ignore "already exists" errors (race condition or vault sync)
				if (!(error instanceof Error) || !error.message.includes('already exists')) {
					throw error;
				}
			}
		} else if (!(f instanceof TFolder)) {
			throw new Error(`Path exists but is not a folder: ${current}`);
		}
	}
}

/**
 * Get files in a folder
 */
export function getFilesInFolder(folder: TFolder): TFile[] {
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
 * Templates are ONLY discovered from C/Templates
 * Role folders are for destination paths, not template discovery
 */
export function getTemplateFiles(app: App, templateFolderPath?: string): Map<string, TFile[]> {
	const templateMap = new Map<string, TFile[]>();
	
	// Initialize map with empty arrays for each letter
	ALPHABET.forEach(letter => {
		templateMap.set(letter, []);
	});
	
	// Scan C/Templates for all templates
	scanCTemplates(app, templateMap);
	
	return templateMap;
}

/**
 * Scan C/Templates for traditional A-, B- prefixed templates and pipeline templates
 */
function scanCTemplates(app: App, templateMap: Map<string, TFile[]>): void {
	const folderPath = getTemplatesFolder(app);
	const templateFolder = app.vault.getAbstractFileByPath(folderPath);
	
	if (!templateFolder || !(templateFolder instanceof TFolder)) {
		return;
	}
	
	// Read ALL pipeline configurations from Phase 0
	const api = getABCsPluginAPI(app);
	const s: SettingsRoot | undefined = api?.settings?.abcsPhase0;
	const allPipelines: Array<{ prefix: string; targetLetter: string }> = [];
	
	if (s) {
		const prof = s.profiles.find((x: Profile) => x.id === s.activeProfile) || s.profiles[0];
		if (prof?.pipelines) {
			// Collect all pipeline prefixes and their target letters
			for (const pipeline of prof.pipelines) {
				if (pipeline.templatePrefix && pipeline.targetPath) {
					// Extract the first letter from the target path (e.g., "D/P/{project}/Test.md" -> "D")
					const targetLetter = pipeline.targetPath.charAt(0).toUpperCase();
					if (ALPHABET.includes(targetLetter)) {
						allPipelines.push({
							prefix: pipeline.templatePrefix,
							targetLetter: targetLetter
						});
					}
				}
			}
		}
	}
	
	// Process all files in the template folder
	for (const file of templateFolder.children) {
		if (file instanceof TFile && file.extension === 'md') {
			const fileName = file.basename;
			let matched = false;
			
			// Check if the file name matches any pipeline prefix
			for (const pipeline of allPipelines) {
				if (fileName.startsWith(pipeline.prefix)) {
					const letterFiles = templateMap.get(pipeline.targetLetter) || [];
					letterFiles.push(file);
					templateMap.set(pipeline.targetLetter, letterFiles);
					matched = true;
					break; // Stop after first match
				}
			}
			
			if (matched) continue;
			
			// Check if the file name starts with a letter followed by a dash (e.g., A-Something)
			const firstChar = fileName.charAt(0).toUpperCase();
			if (ALPHABET.includes(firstChar) && fileName.charAt(1) === '-') {
				const letterFiles = templateMap.get(firstChar) || [];
				letterFiles.push(file);
				templateMap.set(firstChar, letterFiles);
				continue;
			}
			
			// For templates without letter prefix, infer from path structure
			// E.g., "StarterKit-3_Permanent" -> first part is "StarterKit", check if it maps to a role folder
			const parts = fileName.split('-');
			if (parts.length > 0) {
				const targetLetter = inferLetterFromPath(app, parts);
				if (targetLetter) {
					const letterFiles = templateMap.get(targetLetter) || [];
					letterFiles.push(file);
					templateMap.set(targetLetter, letterFiles);
				}
			}
		}
	}
}

/**
 * Infer which letter (A/B/D) a template belongs to based on its path structure
 * E.g., "StarterKit-3_Permanent" -> Check if "StarterKit/3_Permanent" matches a configured folder
 */
function inferLetterFromPath(app: App, pathParts: string[]): string | null {
	// Build the path from parts (e.g., ["StarterKit", "3_Permanent"] -> "StarterKit/3_Permanent")
	const targetPath = pathParts.join('/');
	
	const prof = getPhase0(app);
	if (!prof) return null;
	
	// Collect all folders with their letter for exact/prefix matching
	const allMappings: Array<{ letter: string; folder: string }> = [];
	
	(prof.roles.A || []).forEach(f => allMappings.push({ letter: 'A', folder: f.replace(/\/+$/, '').replace(/\/$/, '') }));
	(prof.roles.B || []).forEach(f => allMappings.push({ letter: 'B', folder: f.replace(/\/+$/, '').replace(/\/$/, '') }));
	(prof.roles.D || []).forEach(f => allMappings.push({ letter: 'D', folder: f.replace(/\/+$/, '').replace(/\/$/, '') }));
	
	// Sort by folder length descending (longest/most specific first)
	allMappings.sort((a, b) => b.folder.length - a.folder.length);
	
	// Find the best match
	for (const mapping of allMappings) {
		const folder = mapping.folder;
		// Check if target path exactly matches folder or starts with it
		if (targetPath === folder || targetPath.startsWith(folder + '/')) {
			return mapping.letter;
		}
	}
	
	return null;
}

/**
 * Get folder paths for multi-folder roles (A, B, D)
 */
export function getRoleFolders(app: App, role: 'A' | 'B' | 'D'): string[] {
    const prof = getPhase0(app);
    if (!prof) return [];
    const folders = prof.roles[role] || [];
    return folders.map((f: string) => f.replace(/\/+$/, '').replace(/\/$/, ''));
}

// ===== Pipeline helpers =====

// Build a path from a pattern like "D/Projects/{project}/Content.md"
export function buildTargetPath(pattern: string, vars: Record<string, string>): string {
	return Object.keys(vars).reduce((acc, key) => {
		const re = new RegExp(`\\{${key}\\}`, 'g');
		return acc.replace(re, vars[key]);
	}, pattern);
}

// Read pipeline target pattern from Phase 0 and build a concrete path
export function getPipelineTargetPath(app: App, pipelineId: string, vars: Record<string,string>): string | null {
  const api = getABCsPluginAPI(app);
  const s: SettingsRoot | undefined = api?.settings?.abcsPhase0;
  if (!s) return null;
  const prof = s.profiles.find((x: Profile) => x.id === s.activeProfile) || s.profiles[0];
  const pipe = (prof?.pipelines || []).find((x: PipelineConfig) => x.id === pipelineId);
  if (!pipe?.targetPath) return null;
  return buildTargetPath(pipe.targetPath, vars);
}

// ===== Role folder helpers =====

/**
 * Get the active Phase 0 profile
 */
// Type guard for plugin API shape without using 'any'
function isABCsPluginAPI(obj: unknown): obj is ABCsOfControlPluginAPI {
  if (typeof obj !== 'object' || obj === null) return false;
  const o = obj as Record<string, unknown>;
  return 'settings' in o && 'saveSettings' in o;
}

export function getABCsPluginAPI(app: App): ABCsOfControlPluginAPI | null {
  const pluginsContainer = (app as unknown as { plugins?: { plugins?: Record<string, unknown> } }).plugins;
  const pluginEntry = pluginsContainer?.plugins?.['abcs-of-control'];
  return isABCsPluginAPI(pluginEntry) ? pluginEntry : null;
}

export function getPhase0(app: App): Profile | null {
  const api = getABCsPluginAPI(app);
  const s: SettingsRoot | undefined = api?.settings?.abcsPhase0;
  if (!s) return null;
  return s.profiles.find((x: Profile) => x.id === s.activeProfile) || s.profiles[0] || null;
}

/**
 * Get single folder path for E (archive)
 * C is hardcoded to 'C' and not configurable
 */
export function getRoleRoot(app: App, role: 'C' | 'E'): string {
	if (role === 'C') {
		return 'C'; // C is always 'C', not configurable
	}
	
	const prof = getPhase0(app);
	if (!prof) return 'E/Archive'; // fallback for E
	
	const value = prof.roles.E;
	
	// Backward compatibility: if it's an array (old format), take first element
	if (Array.isArray(value)) {
		const path = value[0] || 'E/Archive';
		return path.replace(/\/$/, ''); // Remove trailing slash
	}
	
	const stringValue = value || 'E/Archive';
	return stringValue.replace(/\/$/, ''); // Remove trailing slash
}

/**
 * Get the templates folder path - always C/Templates (hardcoded)
 */
export function getTemplatesFolder(app: App): string {
	return 'C/Templates';
}

/**
 * Parse insertion template name to extract target path and filename
 * Format: {prefix}-{path-segments}-{filename}
 * Example: 'Content-to-D-YouTube Channel-Breaking Bad Habits'
 * Returns: { path: 'D/YouTube Channel', filename: 'Breaking Bad Habits', fullPath: 'D/YouTube Channel/Breaking Bad Habits.md' }
 */
export function parseInsertionTemplateName(templateName: string, prefix: string): { 
	path: string; 
	filename: string; 
	fullPath: string;
	projectName: string; // alias for filename, for backward compatibility
} | null {
	if (!templateName.startsWith(prefix)) {
		return null;
	}
	
	// Remove prefix
	const withoutPrefix = templateName.substring(prefix.length);
	
	// Split by dashes to get path segments
	const segments = withoutPrefix.split('-').map(s => s.trim()).filter(s => s.length > 0);
	
	if (segments.length < 2) {
		// Need at least: letter and filename
		return null;
	}
	
	// Last segment is the filename
	const filename = segments[segments.length - 1];
	
	// All previous segments form the path (joined with '/')
	const pathSegments = segments.slice(0, -1);
	const path = pathSegments.join('/');
	
	// Build full path with .md extension
	const fullPath = normalizePath(`${path}/${filename}.md`);
	
	return {
		path,
		filename,
		fullPath,
		projectName: filename // alias for dropdown display
	};
}

/**
 * Check if a path is under a given root folder
 */
export function isPathUnder(targetPath: string, rootFolder: string): boolean {
    const normalizedTargetPath = normalizePath(targetPath).replace(/\/+$/, '').replace(/\/$/, '');
    const normalizedRootFolder = normalizePath(rootFolder).replace(/\/+$/, '').replace(/\/$/, '');
    return normalizedTargetPath === normalizedRootFolder || normalizedTargetPath.startsWith(normalizedRootFolder + '/');
}

/**
 * Validate that a target path is under the configured role folder(s)
 * Show a warning Notice if validation fails
 */
export function ensureUnderRole(app: App, role: RoleLetter, targetPath: string): boolean {
	let valid = false;
	if (role === 'C' || role === 'E') {
		const root = getRoleRoot(app, role);
		valid = isPathUnder(targetPath, root);
	} else {
		const folders = getRoleFolders(app, role);
		valid = folders.some(root => isPathUnder(targetPath, root));
	}
	
	if (!valid) {
		new Notice(`Warning: Target path "${targetPath}" is outside configured ${role} folder(s)`);
	}
	return valid;
}
