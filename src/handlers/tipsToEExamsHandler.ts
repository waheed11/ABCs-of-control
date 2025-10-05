import { App, TFile, Notice, normalizePath } from 'obsidian';
import * as path from 'path';
import { HeadingMeta, Selection } from '../types';
import { ensureFolderExists, confirmModal, parseSection, compareSection, detectArabicContent, parseInsertionTemplateName  } from '../utils';
import { ArchiveHandler } from './archiveHandler';

export class TipsToEExamsHandler {
	private app: App;

	constructor(app: App) {
		this.app = app;
	}

	/**
	 * Handle Tips-to-E-Exams template processing with proper numeric ordering
	 * Based on the working implementation from ContentToDProjectsHandler
	 */
	async handleTipsToEExams(templates: TFile[], initialTemplate: TFile, contentEl: HTMLElement, closeModal: () => void, pipelineId: string = 'tips-to-d-exams') {
		contentEl.empty();

		// Get prefix from pipeline configuration
		const p0 = (this.app as any).plugins?.plugins?.['abcs-of-control'];
		const s0 = p0?.settings?.abcsPhase0;
		const prof0 = s0?.profiles?.find((x:any)=>x.id===s0.activeProfile) || s0?.profiles?.[0];
		const pipe0 = prof0?.pipelines?.find((x:any)=>x.id===pipelineId);
		const prefix = pipe0?.templatePrefix || 'Tips-to-D-Exams-';

		// Parse templates and extract exam info using new name-based parsing
		const exams: { name: string; template: TFile; parsedPath: ReturnType<typeof parseInsertionTemplateName> }[] = [];
		
		for (const template of templates) {
			const parsed = parseInsertionTemplateName(template.basename, prefix);
			if (parsed) {
				exams.push({
					name: parsed.projectName, // This is the filename (last segment)
					template,
					parsedPath: parsed
				});
			}
		}
		
		// Sort exams alphabetically by name
		exams.sort((a, b) => a.name.localeCompare(b.name));
		
		// Find initial exam
		const initialParsed = parseInsertionTemplateName(initialTemplate.basename, prefix);
		const initialExamName = initialParsed?.projectName || initialTemplate.basename;
		
		let currentExam = exams.find(e => e.name === initialExamName) || exams[0];
		if (!currentExam) {
			new Notice('No insertion templates found.');
			closeModal();
			return;
		}
		
		// Create exam selection UI
		contentEl.createEl('h2', { text: 'Add Content' });
		
		const examRow = contentEl.createDiv({ cls: 'form-row' });
		examRow.createEl('label', { text: 'Exam:' });
		const examSelect = examRow.createEl('select');
		exams.forEach(exam => {
			const option = examSelect.createEl('option');
			option.value = exam.name;
			option.text = exam.name;
			if (exam.name === currentExam.name) {
				option.selected = true;
			}
		});
		
		// Function to load exam template and update UI
		const loadExam = async (examName: string) => {
			const exam = exams.find(e => e.name === examName);
			if (!exam) return;
			
			currentExam = exam;
			const templateContent = await this.app.vault.read(exam.template);
			
			// Clear and rebuild the rest of the UI
			const existingContent = contentEl.querySelector('.exam-content');
			if (existingContent) {
				existingContent.remove();
			}
			
			// Pass the parsed path info to buildExamUI
			await this.buildExamUI(templateContent, exam.parsedPath!, contentEl, closeModal, pipelineId);
		};
		
		// Exam selection change handler
		examSelect.addEventListener('change', async () => {
			await loadExam((examSelect as HTMLSelectElement).value);
		});
		
		// Load initial exam
		await loadExam(currentExam.name);
	}

	/**
	 * Build the exam-specific UI (headings, selections, etc.)
	 */
	private async buildExamUI(templateContent: string, parsedPath: { path: string; filename: string; fullPath: string; projectName: string }, contentEl: HTMLElement, closeModal: () => void, pipelineId: string) {
		const examContainer = contentEl.createDiv({ cls: 'exam-content' });
		
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
		
		examContainer.createEl('h3', { text: 'Add notes or text for a specific Heading' });
		
		// Heading dropdown (auto RTL/LTR per selection)
		const headingRow = examContainer.createDiv({ cls: 'form-row' });
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
		const selectedList = examContainer.createDiv({ cls: 'selected-notes' });
		selectedList.createEl('h3', { text: 'Tips to add' });
		
		// Read "Include Archive" setting from pipeline configuration
		const getIncludeArchiveFromSettings = (): boolean => {
			const p = (this.app as any).plugins?.plugins?.['abcs-of-control'];
			const s = p?.settings?.abcsPhase0;
			if (!s) return false;
			const prof = s.profiles.find((x: any) => x.id === s.activeProfile) || s.profiles[0];
			const pipe = prof?.pipelines?.find((x: any) => x.id === pipelineId);
			return Boolean(pipe?.search?.includeArchive);
		};
		
		const includeArchiveNotes = getIncludeArchiveFromSettings();

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
		const inputRow = examContainer.createDiv({ cls: 'form-row' });
		const input = inputRow.createEl('input', { 
			type: 'text', 
			placeholder: 'Type to search notes, press Enter to add' 
		});
		const suggBox = examContainer.createDiv({ cls: 'wiki-suggest-box' });
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
			if (!searchTerm) return;
			const lower = searchTerm.toLowerCase();
			lastMatches = notes.filter(f => 
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
		const textAreaRow = examContainer.createDiv({ cls: 'form-row' });
		textAreaRow.createEl('label', { text: 'Or add custom text:' });
		const textArea = textAreaRow.createEl('textarea', { 
			placeholder: 'Enter custom tips to add under the selected heading...',
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
			const buttonContainer = examContainer.createDiv({ cls: 'button-container' });

			// Close button
			const closeButton = buttonContainer.createEl('button', { text: 'Close' });
			closeButton.addEventListener('click', () => closeModal());

			// 3) Insert (primary, right)
			const insertButton = buttonContainer.createEl('button', { text: 'Insert into Tips', cls: 'mod-cta' });
		insertButton.addEventListener('click', async () => {
			if (selections.length === 0) { 
				new Notice('Add at least one note or text first.'); 
				return; 
			}
			
			// Use the parsed target path from template name
			const targetPath = parsedPath.fullPath;
			await ensureFolderExists(this.app, path.dirname(targetPath));
			
			let targetFile = this.app.vault.getAbstractFileByPath(targetPath) as TFile | null;
			if (!targetFile) {
				// Create the target file with the exam name as heading
				targetFile = await this.app.vault.create(targetPath, `# ${parsedPath.filename}\n`);
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
			new Notice(`✅ Tips added to ${parsedPath.projectName}! You can now switch exams or add more tips.`);
		});
	}
	private filterNotes(notes: TFile[], includeArchive: boolean = false): TFile[] {
		return notes.filter(note => {
			// Skip E/Archive folder unless explicitly included
			if (!includeArchive && note.path.startsWith('E/Archive/')) {
				return false;
			}
			return true;
		});
	}
}
