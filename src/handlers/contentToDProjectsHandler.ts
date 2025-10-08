import { ArchiveHandler } from './archiveHandler';
import { App, TFile, Notice, normalizePath } from 'obsidian';
import * as path from 'path';
import { HeadingMeta, Selection } from '../types';
import { ensureFolderExists, parseSection, compareSection, detectArabicContent, confirmModal, parseInsertionTemplateName  } from '../utils';

export class ContentToDProjectsHandler {
	private app: App;

	constructor(app: App) {
		this.app = app;
	}

	/**
	 * Handle Content-to-D-Projects template processing with proper numeric ordering
	 * Based on the working implementation from memories
	 */
	async handleContentToDProjects(templates: TFile[], initialTemplate: TFile, contentEl: HTMLElement, closeModal: () => void, pipelineId: string = 'content-to-d-projects') {
		contentEl.empty();

		// Get prefix from pipeline configuration
		const p0 = (this.app as any).plugins?.plugins?.['abcs-of-control'];
		const s0 = p0?.settings?.abcsPhase0;
		const prof0 = s0?.profiles?.find((x:any)=>x.id===s0.activeProfile) || s0?.profiles?.[0];
		const pipe0 = prof0?.pipelines?.find((x:any)=>x.id===pipelineId);
		const prefix = pipe0?.templatePrefix || 'Content-to-D-Projects-';

		// Parse templates and extract project info using new name-based parsing
		const projects: { name: string; template: TFile; parsedPath: ReturnType<typeof parseInsertionTemplateName> }[] = [];
		
		for (const template of templates) {
			// Only include templates located directly under C/Templates (exclude subfolders)
			if (!template.path.startsWith('C/Templates/')) continue;
			const relative = template.path.slice('C/Templates/'.length);
			if (relative.includes('/')) continue;
			const parsed = parseInsertionTemplateName(template.basename, prefix);
			if (parsed) {
				projects.push({
					name: parsed.projectName, // This is the filename (last segment)
					template,
					parsedPath: parsed
				});
			}
		}
		
		// Sort projects alphabetically by name
		projects.sort((a, b) => a.name.localeCompare(b.name));
		
		// Find initial project
		const initialParsed = parseInsertionTemplateName(initialTemplate.basename, prefix);
		const initialProjectName = initialParsed?.projectName || initialTemplate.basename;
		
		let currentProject = projects.find(p => p.name === initialProjectName) || projects[0];
		if (!currentProject) {
			new Notice('No insertion templates found.');
			closeModal();
			return;
		}
		
		// Create project selection UI
		contentEl.createEl('h2', { text: 'Add Content' });
		
		const projectRow = contentEl.createDiv({ cls: 'form-row' });
		projectRow.createEl('label', { text: 'Project:' });
		const projectSelect = projectRow.createEl('select');
		projects.forEach(project => {
			const option = projectSelect.createEl('option');
			option.value = project.name;
			option.text = project.name;
			if (project.name === currentProject.name) {
				option.selected = true;
			}
		});
		
		// Function to load project template and update UI
		const loadProject = async (projectName: string) => {
			const project = projects.find(p => p.name === projectName);
			if (!project) return;
			
			currentProject = project;
			const templateContent = await this.app.vault.read(project.template);
			
			// Clear and rebuild the rest of the UI
			const existingContent = contentEl.querySelector('.project-content');
			if (existingContent) {
				existingContent.remove();
			}
			
			// Pass the parsed path info to buildProjectUI
			await this.buildProjectUI(templateContent, project.parsedPath!, contentEl, closeModal, pipelineId);
		};
		
		// Project selection change handler
		projectSelect.addEventListener('change', async () => {
			await loadProject((projectSelect as HTMLSelectElement).value);
		});
		
		// Load initial project
		await loadProject(currentProject.name);
	}
    
    /**
     * Build the project-specific UI (headings, selections, etc.)
     */
	private async buildProjectUI(
		templateContent: string,
		parsedPath: { path: string; filename: string; fullPath: string; projectName: string },
		contentEl: HTMLElement,
		closeModal: () => void,
		pipelineId: string
	  ) {
		const projectContainer = contentEl.createDiv({ cls: 'project-content' });
		
		// Parse headings with level and numeric section (e.g., 1.2.3)
		const headings: string[] = [];
		const headingMetaMap: Record<string, { level: number; section: number[] }> = {};
		
		for (const line of templateContent.split('\n')) {
			const match = line.match(/^(#+)\s+(.+?)\s*$/);
			if (match) {
				const level = match[1].length;
				const text = match[2].trim();
				headings.push(text);
				headingMetaMap[text] = { level, section: parseSection(text) };
			}
		}
		
		if (headings.length === 0) {
			new Notice('No headings found in the template to insert under.');
			closeModal();
			return;
		}
		
		projectContainer.createEl('h3', { text: 'Add notes or text for a specific Heading' });
		
			
			// Heading dropdown (auto RTL/LTR per selection)
		const headingRow = projectContainer.createDiv({ cls: 'form-row' });
		headingRow.createEl('label', { text: 'Heading:' });
		const headingSelect = headingRow.createEl('select');
		headings.forEach(h => {
			const option = headingSelect.createEl('option');
			option.value = h;
			option.text = h;
			option.setAttr('title', h);
		});
		
		const applyHeadingDir = () => {
			const value = (headingSelect as HTMLSelectElement).value || '';
			const isArabic = detectArabicContent(value);
			headingSelect.setAttr('dir', isArabic ? 'rtl' : 'ltr');
		};
		applyHeadingDir();
		headingSelect.addEventListener('change', applyHeadingDir);
		
		// Selections list
		const selectedList = projectContainer.createDiv({ cls: 'selected-notes' });
		selectedList.createEl('h3', { text: 'Notes to add' });
		// Read "Include Archive" setting from pipeline configuration
		const getIncludeArchiveFromSettings = (): boolean => {
			const p = (this.app as any).plugins?.plugins?.['abcs-of-control'];
			const s = p?.settings?.abcsPhase0;
			if (!s) return false; // fallback default
			const prof = s.profiles.find((x: any) => x.id === s.activeProfile) || s.profiles[0];
			const pipe = prof?.pipelines?.find((x: any) => x.id === pipelineId);
			return Boolean(pipe?.search?.includeArchive);
		};
		
		const includeArchiveNotes = getIncludeArchiveFromSettings();
		const listEl = selectedList.createEl('ul');
		const selections: Selection[] = [];

		// Show only a short preview for long custom text
		const truncatePreview = (text: string): string => {
			const firstLine = (text || '').split('\n')[0].trim();
			const words = firstLine.split(/\s+/).filter(Boolean);
			const maxWords = 8;
			const hasMore = words.length > maxWords || text.includes('\n');
			const preview = words.slice(0, maxWords).join(' ');
			return hasMore ? `${preview} ........` : firstLine;
		};
		
		const addSelection = (heading: string, link?: string, text?: string) => {
			if (link) {
				selections.push({ heading, link, type: 'note' });
				const li = listEl.createEl('li');
				li.setText(`${heading}: [[${link}]]`);
			} else if (text) {
				selections.push({ heading, text, type: 'text' });
				const li = listEl.createEl('li');
				li.setText(`${heading}: ${truncatePreview(text)}`);
				li.setAttr('title', text);
			}
		};
		
		// Live note search
		const inputRow = projectContainer.createDiv({ cls: 'form-row' });
		const input = inputRow.createEl('input', { 
			type: 'text', 
			placeholder: 'Type to search notes, press Enter to add' 
		});
		const suggBox = projectContainer.createDiv({ cls: 'wiki-suggest-box' });
		const suggList = suggBox.createEl('ul', { cls: 'wiki-suggest-list' });

		let allNotes: TFile[] = [];
		try { 
			allNotes = this.app.vault.getMarkdownFiles(); 
		} catch {}
		
		let activeIndex = -1;
		let lastMatches: TFile[] = [];
		
		const updateActive = () => {
			const items = Array.from(suggList.children) as HTMLElement[];
			items.forEach((el, idx) => {
				if (idx === activeIndex) el.addClass('active'); 
				else el.removeClass('active');
			});
		};
		
		const updateSuggestions = (searchTerm: string, notesToSearch?: TFile[]) => {
			// Use provided notes or default to all vault notes
			const notes = notesToSearch || this.app.vault.getMarkdownFiles();
			suggList.empty();
			if (!searchTerm) return;  // Changed from 'query' to 'searchTerm'
			const lower = searchTerm.toLowerCase();  // Changed from 'query' to 'searchTerm'
			lastMatches = notes.filter(f =>  // Changed from 'allNotes' to 'notes'
				f.basename.toLowerCase().includes(lower) || 
				f.path.toLowerCase().includes(lower)
			).slice(0, 50);
			
			lastMatches.forEach((f) => {
				const item = suggList.createEl('li');
				const btn = item.createEl('button', { text: `${f.basename} — ${f.path}` });
				btn.addEventListener('click', () => {
					addSelection((headingSelect as HTMLSelectElement).value, f.basename);
					input.value = '';
					suggList.empty();
					lastMatches = [];
					activeIndex = -1;
				});
			});
			activeIndex = lastMatches.length > 0 ? 0 : -1;
			updateActive();
		};
		
		input.addEventListener('input', (e) => {
			const searchTerm = (e.target as HTMLInputElement).value.trim();
			
			if (searchTerm.length === 0) { 
				suggList.empty(); 
				return; 
			}
			
			// Get all notes and filter them based on archive inclusion
			const allNotes = this.app.vault.getMarkdownFiles();
			const filteredNotes = this.filterNotes(allNotes, includeArchiveNotes);
			
			// Apply search term filter to the already filtered notes
			const searchResults = filteredNotes.filter(note => 
				note.basename.toLowerCase().includes(searchTerm.toLowerCase()) ||
				note.path.toLowerCase().includes(searchTerm.toLowerCase())
			);
			
			// Update suggestions with the filtered results
			updateSuggestions(searchTerm, searchResults); // Pass the filtered results
		});
		
		input.addEventListener('keydown', (ev) => {
			if (ev.key === 'ArrowDown') { 
				ev.preventDefault(); 
				if (lastMatches.length > 0) { 
					activeIndex = (activeIndex + 1) % lastMatches.length; 
					updateActive(); 
				} 
				return; 
			}
			if (ev.key === 'ArrowUp') { 
				ev.preventDefault(); 
				if (lastMatches.length > 0) { 
					activeIndex = (activeIndex - 1 + lastMatches.length) % lastMatches.length; 
					updateActive(); 
				} 
				return; 
			}
			if (ev.key === 'Enter') {
				ev.preventDefault();
				if (lastMatches.length > 0) {
					const chosen = lastMatches[Math.max(activeIndex, 0)];
					addSelection((headingSelect as HTMLSelectElement).value, chosen.basename);
					input.value = '';
					suggList.empty();
					lastMatches = [];
					activeIndex = -1;
				}
			}
		});
				// Text area for custom text input
		const textAreaRow = projectContainer.createDiv({ cls: 'form-row' });
		textAreaRow.addClass('abcs-stack');
		textAreaRow.createEl('label', { text: 'Or add custom text:' });
		const textArea = textAreaRow.createEl('textarea', { 
			placeholder: 'Enter custom text to add under the selected heading...',
			attr: { rows: '4' }
		});
		textArea.addClass('abcs-textarea');

		const addTextButton = textAreaRow.createEl('button', { text: 'Add Text' });
		addTextButton.addClass('abcs-mt-5');
		addTextButton.addEventListener('click', () => {
			const text = textArea.value.trim();
			if (text) {
				addSelection((headingSelect as HTMLSelectElement).value, undefined, text);
				textArea.value = '';
			}
		});
		// Buttons
		const buttonContainer = projectContainer.createDiv({ cls: 'button-container' });

		// Close button
		const cancelButton = buttonContainer.createEl('button', { text: 'Close' });
		cancelButton.addEventListener('click', () => closeModal());

		// 3) Insert (primary/violet, right)
		const insertButton = buttonContainer.createEl('button', { text: 'Insert into Content', cls: 'mod-cta' });
		insertButton.addEventListener('click', async () => {
			if (textArea && textArea.value && textArea.value.trim().length > 0) {
				new Notice('You have custom text typed. Click "Add Text" to include it before inserting, or clear the field.');
				return;
			}
			if (selections.length === 0) { new Notice('Add at least one note or text first.'); return; }
			const targetPath = parsedPath.fullPath;
			await ensureFolderExists(this.app, path.dirname(targetPath));
			const existing = this.app.vault.getAbstractFileByPath(targetPath);
			const targetFile = existing instanceof TFile ? existing : await this.app.vault.create(targetPath, `# ${parsedPath.filename}\n`);
			let content = await this.app.vault.read(targetFile);
			const lines = content.split('\n');
			const ensureHeadingAndAppend = (headingText: string, toAppend: string) => {
				const meta = headingMetaMap[headingText] || { level: 2, section: [] };
				let targetIndex = -1;
				for (let i = 0; i < lines.length; i++) {
					const line = lines[i];
					const match = line.match(/^(#+)\s+(.+?)\s*$/);
					if (match && match[1].length === meta.level && match[2].trim() === headingText) { targetIndex = i; break; }
				}
				if (targetIndex === -1) {
					const hashes = '#'.repeat(meta.level);
					const targetSection = parseSection(headingText);
					let insertAt = lines.length;
					if (targetSection.length > 0) {
						for (let i = 0; i < lines.length; i++) {
							const line = lines[i];
							const match = line.match(/^(#+)\s+(.+?)\s*$/);
							if (match) {
								const text = match[2].trim();
								const section = parseSection(text);
								if (section.length > 0 && compareSection(targetSection, section) < 0) { insertAt = i; break; }
							}
						}
					}
					if (insertAt >= lines.length) { lines.push('', `${hashes} ${headingText}`, ''); targetIndex = lines.length - 2; }
					else { lines.splice(insertAt, 0, '', `${hashes} ${headingText}`, ''); targetIndex = insertAt + 1; }
				}
				let insertAt = targetIndex + 1;
				while (insertAt < lines.length) {
					const line = lines[insertAt];
					if (line.startsWith('#')) break;
					if (line.trim() !== '') insertAt++; else break;
				}
				lines.splice(insertAt, 0, toAppend);
			};
			for (const s of selections) {
				if (s.type === 'note' && s.link) ensureHeadingAndAppend(s.heading, `- [[${s.link}]]`);
				else if (s.type === 'text' && s.text) ensureHeadingAndAppend(s.heading, `- ${s.text}`);
			}
			await this.app.vault.modify(targetFile, lines.join('\n'));
			new Notice(`Inserted ${selections.length} item(s) into ${targetPath}`);
			selections.length = 0; listEl.empty(); input.value = ''; textArea.value = '';
			new Notice(`✅ Content added to ${parsedPath.projectName}! You can now switch projects or add more content.`);
		});
		}		
		private filterNotes(notes: TFile[], includeArchive: boolean = false): TFile[] {
			return notes.filter(note => {
				// Skip archive folders unless explicitly included
				if (!includeArchive) {
					if (note.path.startsWith('E/')) {
						return false;
					}
				}
				return true;
			});
		}	
	}

