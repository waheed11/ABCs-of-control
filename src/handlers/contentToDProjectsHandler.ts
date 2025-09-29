import { ArchiveHandler } from './archiveHandler';
import { App, TFile, Notice, normalizePath } from 'obsidian';
import * as path from 'path';
import { HeadingMeta, Selection } from '../types';
import { ensureFolderExists, parseSection, compareSection, detectArabicContent, confirmModal, getPipelineTargetPath  } from '../utils';

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

		// Extract project names from all templates
		const prefix = 'Content-to-D-Projects-';
		const projects: { name: string; template: TFile }[] = templates.map(template => ({
			name: template.basename.startsWith(prefix) 
				? template.basename.substring(prefix.length)
				: template.basename,
			template
		}));
		
		// Sort projects alphabetically
		projects.sort((a, b) => a.name.localeCompare(b.name));
		
		// Find initial project
		const initialProjectName = initialTemplate.basename.startsWith(prefix)
			? initialTemplate.basename.substring(prefix.length)
			: initialTemplate.basename;
		
		let currentProject = projects.find(p => p.name === initialProjectName) || projects[0];
		if (!currentProject) {
			new Notice('No Content-to-D-Projects templates found.');
			closeModal();
			return;
		}
		
		// Create project selection UI
		contentEl.createEl('h2', { text: 'Add content to D/Projects' });
		
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
			
			await this.buildProjectUI(templateContent, projectName, contentEl, closeModal, pipelineId);
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
		projectName: string,
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
		
		projectContainer.createEl('h3', { text: `Add notes to ${projectName}/Content` });
		
			
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
			(headingSelect as HTMLSelectElement).style.textAlign = isArabic ? 'right' : 'left';
		};
		applyHeadingDir();
		headingSelect.addEventListener('change', applyHeadingDir);
		
		// Selections list
		const selectedList = projectContainer.createDiv({ cls: 'selected-notes' });
		selectedList.createEl('h3', { text: 'Notes to add' });
		// Add checkbox for including archive folder notes
		const archiveCheckboxContainer = contentEl.createDiv({ cls: 'archive-checkbox-container' });
		const archiveCheckbox = archiveCheckboxContainer.createEl('input', {
			type: 'checkbox',
			attr: { id: 'include-archive-notes' }
		});
		const archiveLabel = archiveCheckboxContainer.createEl('label', {
			text: 'Include Archive Folder Notes',
			attr: { for: 'include-archive-notes' }
		});

		//let includeArchiveNotes = false; // Default: exclude archive notes
		
		// Helper to read/write includeArchive for this pipeline
		const getPlugin = () => (this.app as any).plugins?.plugins?.['ABCs-of-control'];
		const getIncludeArchiveDefault = (): boolean => {
		const p = getPlugin();
		const s = p?.settings?.abcsPhase0;
		if (!s) return false; // fallback default
		const prof = s.profiles.find((x: any) => x.id === s.activeProfile) || s.profiles[0];
		const pipe = prof?.pipelines?.find((x: any) => x.id === 'content-to-d-projects');
		return Boolean(pipe?.search?.includeArchive);
		};
		const setIncludeArchivePersist = async (value: boolean) => {
		const p = getPlugin();
		if (!p?.settings?.abcsPhase0) return;
		const s = p.settings.abcsPhase0;
		const prof = s.profiles.find((x: any) => x.id === s.activeProfile) || s.profiles[0];
		const pipe = prof?.pipelines?.find((x: any) => x.id === 'content-to-d-projects');
		if (!pipe) return;
		pipe.search = pipe.search || { includeArchive: false };
		pipe.search.includeArchive = value;
		await p.saveSettings?.();
		};
		
		let includeArchiveNotes = getIncludeArchiveDefault(); // default from settings
		archiveCheckbox.checked = includeArchiveNotes;

		archiveCheckbox.addEventListener('change', async () => {
		includeArchiveNotes = archiveCheckbox.checked;
		await setIncludeArchivePersist(includeArchiveNotes);
		// search refresh happens in input handler below as before
		});
		const listEl = selectedList.createEl('ul');
		const selections: Selection[] = [];
		
		const addSelection = (heading: string, link?: string, text?: string) => {
			if (link) {
				selections.push({ heading, link, type: 'note' });
				const li = listEl.createEl('li');
				li.setText(`${heading}: [[${link}]]`);
			} else if (text) {
				selections.push({ heading, text, type: 'text' });
				const li = listEl.createEl('li');
				li.setText(`${heading}: ${text}`);
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
		textAreaRow.createEl('label', { text: 'Or add custom text:' });
		const textArea = textAreaRow.createEl('textarea', { 
			placeholder: 'Enter custom text to add under the selected heading...',
			attr: { rows: '3', style: 'width: 100%; margin-top: 5px;' }
		});

		const addTextButton = textAreaRow.createEl('button', { 
			text: 'Add Text',
			attr: { style: 'margin-top: 5px;' }
		});
		addTextButton.addEventListener('click', () => {
			const text = textArea.value.trim();
			if (text) {
				addSelection((headingSelect as HTMLSelectElement).value, undefined, text);
				textArea.value = '';
			}
		});
		// Buttons
		const buttonContainer = projectContainer.createDiv({ cls: 'button-container' });

		// 1) Move to E button (neutral, left)
		const moveButton = buttonContainer.createEl('button', {
		text: 'Move to E/Projects',
		attr: { title: 'Move this project folder to E/Projects' }
		});
		moveButton.addEventListener('click', async () => {
			const confirmed = await confirmModal(
				this.app,
				'Move to E/Projects',
				`Move project "${projectName}" from D/Projects to E/Projects?`,
				'Move',
				'Cancel'
			  );
			  if (!confirmed) return;


		try {
			const archiveHandler = new ArchiveHandler(this.app);
			const dest = await archiveHandler.moveProjectOrExam('project', projectName);

			// Move corresponding D template to E/Templates and rename it so it no longer shows under D
			const oldTemplatePath = normalizePath(`C/Templates/Content-to-D-Projects-${projectName}.md`);
			const oldTemplate = this.app.vault.getAbstractFileByPath(oldTemplatePath) as TFile | null;
			if (oldTemplate) {
			await ensureFolderExists(this.app, 'E/Templates');
			// Keep the same filename in E/Templates; resolve conflicts if needed
			const fileName = oldTemplate.name; // e.g., Content-to-D-Projects-<name>.md
			let newTemplatePath = normalizePath(`E/Templates/${fileName}`);
			let counter = 1;
			while (this.app.vault.getAbstractFileByPath(newTemplatePath)) {
				const base = fileName.replace(/\.md$/, '');
				newTemplatePath = normalizePath(`E/Templates/${base} (${counter}).md`);
				counter++;
			}
			await this.app.fileManager.renameFile(oldTemplate, newTemplatePath);
			}

			new Notice(`✅ Moved to ${dest}`);
			// Close to refresh UI/lists
			closeModal();
		} catch (err) {
			console.error(err);
			new Notice('❌ Failed to move project. See console for details.');
		}
		});

		// 2) Close (neutral, middle)
		const cancelButton = buttonContainer.createEl('button', { text: 'Close' });
		cancelButton.addEventListener('click', () => closeModal());

		// 3) Insert (primary/violet, right)
		const insertButton = buttonContainer.createEl('button', { text: 'Insert into Content', cls: 'mod-cta' });
		insertButton.addEventListener('click', async () => {
		if (selections.length === 0) { 
			new Notice('Add at least one note or text first.'); 
			return; 
		}

		const defaultPattern = `D/Projects/{project}/Content.md`;
		const resolved = getPipelineTargetPath(this.app, pipelineId, { project: projectName });
		const targetPath = normalizePath((resolved ?? defaultPattern).replace('{project}', projectName));
		await ensureFolderExists(this.app, path.dirname(targetPath));

		let targetFile = this.app.vault.getAbstractFileByPath(targetPath) as TFile | null;
		if (!targetFile) {
			targetFile = await this.app.vault.create(targetPath, `# Content\n`);
		}
			
			let content = await this.app.vault.read(targetFile);
			const lines = content.split('\n');
			
			// Use the working ensureHeadingAndAppend function from memories
			const ensureHeadingAndAppend = (headingText: string, toAppend: string) => {
				const meta = headingMetaMap[headingText] || { level: 2, section: [] };
				
				let targetIndex = -1;
				
				// Look for existing heading by exact text match
				for (let i = 0; i < lines.length; i++) {
					const line = lines[i];
					const match = line.match(/^(#+)\s+(.+?)\s*$/);
					if (match && match[1].length === meta.level && match[2].trim() === headingText) {
						targetIndex = i;
						break;
					}
				}
				
				// If heading doesn't exist, create it in correct numeric position
				if (targetIndex === -1) {
					const hashes = '#'.repeat(meta.level);
					const targetSection = parseSection(headingText);
					let insertAt = lines.length;
					
					// Only try to find position if this heading has a section number
					if (targetSection.length > 0) {
						// Find the right position by comparing with existing headings
						for (let i = 0; i < lines.length; i++) {
							const line = lines[i];
							const match = line.match(/^(#+)\s+(.+?)\s*$/);
							if (match) {
								const text = match[2].trim();
								const section = parseSection(text);
								
								// If existing heading has section number and target should come before it
								if (section.length > 0 && compareSection(targetSection, section) < 0) {
									insertAt = i;
									break;
								}
							}
						}
					}
					
					// Insert the heading at the found position
					if (insertAt >= lines.length) {
						// Insert at end
						lines.push('', `${hashes} ${headingText}`, '');
						targetIndex = lines.length - 2;
					} else {
						// Insert at specific position
						lines.splice(insertAt, 0, '', `${hashes} ${headingText}`, '');
						targetIndex = insertAt + 1;
					}
				}
				
				// Find end of this section and insert content
				let insertAt = targetIndex + 1;
				
				// Skip any existing content immediately after the heading (but not subsections)
				while (insertAt < lines.length) {
					const line = lines[insertAt];
					
					// If we hit a heading, stop here
					if (line.startsWith('#')) {
						break;
					}
					
					// If we hit a non-empty content line, skip it
					if (line.trim() !== '') {
						insertAt++;
					} else {
						// Empty line - this is a good place to insert
						break;
					}
				}
				
				lines.splice(insertAt, 0, toAppend);
			};
			
			// Insert all selections
			for (const selection of selections) {
				if (selection.type === 'note' && selection.link) {
					ensureHeadingAndAppend(selection.heading, `- [[${selection.link}]]`);
				} else if (selection.type === 'text' && selection.text) {
					ensureHeadingAndAppend(selection.heading, `- ${selection.text}`);
				}
			}
			
			await this.app.vault.modify(targetFile, lines.join('\n'));
			new Notice(`Inserted ${selections.length} item(s) into ${targetPath}`);

			// Clear selections after successful insertion
			selections.length = 0;
			listEl.empty();

			// Clear input fields
			input.value = '';
			textArea.value = '';

			// Show success feedback and keep modal open for more additions

			new Notice(`✅ Content added to ${projectName}! You can now switch projects or add more content.`);
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

