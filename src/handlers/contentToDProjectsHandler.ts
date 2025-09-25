import { App, TFile, Notice, normalizePath } from 'obsidian';
import * as path from 'path';
import { HeadingMeta, Selection } from '../types';
import { ensureFolderExists, parseSection, compareSection, detectArabicContent } from '../utils';

export class ContentToDProjectsHandler {
	private app: App;

	constructor(app: App) {
		this.app = app;
	}

	/**
	 * Handle Content-to-D-Projects template processing with proper numeric ordering
	 * Based on the working implementation from memories
	 */
	async handleContentToDProjects(template: TFile, contentEl: HTMLElement, closeModal: () => void) {
		contentEl.empty();
		
		const templateContent = await this.app.vault.read(template);
		
		// Extract project name from template name
		const prefix = 'Content-to-D-Projects-';
		const projectName = template.basename.startsWith(prefix)
			? template.basename.substring(prefix.length)
			: template.basename;
		
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
		
		contentEl.createEl('h2', { text: `Add notes to D/Projects/${projectName}/Content` });
		
		// Heading dropdown (auto RTL/LTR per selection)
		const headingRow = contentEl.createDiv({ cls: 'form-row' });
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
		const selectedList = contentEl.createDiv({ cls: 'selected-notes' });
		selectedList.createEl('h3', { text: 'Notes to add' });
		const listEl = selectedList.createEl('ul');
		const selections: Selection[] = [];
		
		const addSelection = (heading: string, link: string) => {
			selections.push({ heading, link });
			const li = listEl.createEl('li');
			li.setText(`${heading}: [[${link}]]`);
		};
		
		// Live note search
		const inputRow = contentEl.createDiv({ cls: 'form-row' });
		const input = inputRow.createEl('input', { 
			type: 'text', 
			placeholder: 'Type to search notes, press Enter to add' 
		});
		const suggBox = contentEl.createDiv({ cls: 'wiki-suggest-box' });
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
		
		const updateSuggestions = (query: string) => {
			suggList.empty();
			if (!query) return;
			const lower = query.toLowerCase();
			lastMatches = allNotes.filter(f => 
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
		
		input.addEventListener('input', () => {
			const value = input.value.trim();
			if (value.length === 0) { 
				suggList.empty(); 
				return; 
			}
			updateSuggestions(value);
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
		
		// Buttons
		const buttonContainer = contentEl.createDiv({ cls: 'button-container' });
		const cancelButton = buttonContainer.createEl('button', { text: 'Cancel' });
		cancelButton.addEventListener('click', () => closeModal());
		
		const insertButton = buttonContainer.createEl('button', { text: 'Insert into Content' });
		insertButton.addEventListener('click', async () => {
			if (selections.length === 0) { 
				new Notice('Add at least one note first.'); 
				return; 
			}
			
			const targetPath = normalizePath(`D/Projects/${projectName}/Content.md`);
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
				ensureHeadingAndAppend(selection.heading, `- [[${selection.link}]]`);
			}
			
			await this.app.vault.modify(targetFile, lines.join('\n'));
			new Notice(`Inserted ${selections.length} link(s) into ${targetPath}`);
			closeModal();
		});
	}
}
