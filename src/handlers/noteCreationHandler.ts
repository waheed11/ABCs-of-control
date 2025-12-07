import { App, TFile, Notice, normalizePath } from 'obsidian';
import * as path from 'path';
import { WHEN_TO_USE_OPTIONS } from '../constants';
import { ensureFolderExists, confirmModal } from '../utils';

type ConceptsJsonConcept = {
	name?: string;
	description?: string;
};

type ConceptsJsonGroup = {
	Part?: string;
	Chapter?: string | null;
	Concepts?: ConceptsJsonConcept[];
};

export class NoteCreationHandler {
	private app: App;

	constructor(app: App) {
		this.app = app;
	}

	/**
	 * Create unified note creation modal combining name, date prepend, and placeholders
	 */
	async promptForNoteCreation(selectedTemplate: TFile, contentEl: HTMLElement, closeModal: () => void) {
		if (!selectedTemplate) return;
		
		contentEl.empty();
		contentEl.createEl('h2', { text: 'Create note' });
		
		// Name input
		const nameInputContainer = contentEl.createDiv({ cls: 'name-input-container' });
		const nameInput = nameInputContainer.createEl('input', {
			type: 'text',
			placeholder: 'Enter note name'
		});
		
		// Optional date checkbox
		const dateCheckboxContainer = contentEl.createDiv({ cls: 'date-checkbox-container' });
		const dateCheckbox = dateCheckboxContainer.createEl('input', {
			type: 'checkbox',
			attr: { id: 'insert-date-checkbox' }
		});
		dateCheckboxContainer.createEl('label', {
			text: 'Prepend today\'s date (YYYY-MM-DD)',
			attr: { for: 'insert-date-checkbox' }
		});
		
		// Prepare placeholder inputs by reading template content
		const placeholderSection = contentEl.createDiv({ cls: 'placeholder-section' });
		const inputFields: Record<string, HTMLInputElement | HTMLTextAreaElement> = {};
		const radioGroups: Record<string, HTMLInputElement[]> = {};
		const customResolvers: Record<string, () => string> = {};
		const isCSheetTemplate = selectedTemplate.basename.startsWith('C-Sheets');
		const pluginApi = (this.app as unknown as { plugins?: { plugins?: Record<string, unknown> } }).plugins?.plugins?.['abcs-of-control'] as { settings?: { cSheetDefaults?: { intentionsPath?: string; informationBlocksPath?: string; conceptsPath?: string; pdfsPath?: string; videosPath?: string; audiosPath?: string; infographsPath?: string; imagesPath?: string; slidesPath?: string; projectsPath?: string } } } | undefined;
		const cSheetDefaults = pluginApi?.settings?.cSheetDefaults;
		let conceptsPathToken: string | null = null;
		const conceptsImportState: { jsonFilePath: string | null; data: ConceptsJsonGroup[] | null } = {
			jsonFilePath: null,
			data: null
		};
		
		try {
			const templateContent = await this.app.vault.read(selectedTemplate);
			const tokenRegex = /\{\{([^}]+)\}\}/g;
			const fullTokens: string[] = [];
			let match: RegExpExecArray | null;
			while ((match = tokenRegex.exec(templateContent)) !== null) {
				fullTokens.push(match[0]);
			}
			const uniquePlaceholders = [...new Set(fullTokens)];
			
			if (uniquePlaceholders.length > 0) {
				placeholderSection.createEl('h3', { text: 'Template fields' });
				
				// Reorder: tags first, then Quote (EN/AR), then Author (EN/AR), then The Permanent Note, then the rest
				const tagsTokens: string[] = [];
				const quoteEnTokens: string[] = [];
				const quoteArTokens: string[] = [];
				const authorEnTokens: string[] = [];
				const authorArTokens: string[] = [];
				const permanentNoteTokens: string[] = [];
				const otherTokens: string[] = [];
				
				for (const token of uniquePlaceholders) {
					const inner = token.slice(2, -2).trim();
					const displayName = inner.replace(/^VALUE\s*[:|-]?\s*/i, '');
					const lowerCase = displayName.toLowerCase();
					
					if (lowerCase === 'tags') {
						tagsTokens.push(token);
					} else if (lowerCase === 'quote') {
						quoteEnTokens.push(token);
					} else if (displayName === 'الاقتباس') {
						quoteArTokens.push(token);
					} else if (lowerCase === 'author') {
						authorEnTokens.push(token);
					} else if (displayName === 'القائل') {
						authorArTokens.push(token);
					} else if (lowerCase.includes('permanent note')) {
						permanentNoteTokens.push(token);
					} else {
						otherTokens.push(token);
					}
				}
				
				const orderedTokens = [
					...tagsTokens,
					...quoteEnTokens,
					...quoteArTokens,
					...authorEnTokens,
					...authorArTokens,
					...permanentNoteTokens,
					...otherTokens
				];
				
				for (const fullToken of orderedTokens) {
					const inner = fullToken.slice(2, -2);
					const name = inner.trim();
					const displayName = name.replace(/^VALUE\s*[:|-]?\s*/i, '');
					const displayNameLC = displayName.toLowerCase();
					const row = placeholderSection.createDiv({ cls: 'placeholder-input-container' });
					row.createEl('label', { text: displayName });
					
					// Helper: apply C-Sheets default with "Use default" toggle
					const applyCSheetDefault = (tokenKey: keyof NonNullable<typeof cSheetDefaults>, input: HTMLInputElement) => {
						if (!isCSheetTemplate || !cSheetDefaults) return;
						const defVal = (cSheetDefaults[tokenKey] || '').trim();
						if (!defVal) return;
						input.value = defVal;
						input.disabled = true;
						const toggleId = `csheet-use-default-${tokenKey}-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
						const toggleWrapper = row.createDiv({ cls: 'date-checkbox-container csheet-default-toggle' });
						const checkbox = toggleWrapper.createEl('input', {
							type: 'checkbox',
							attr: { id: toggleId }
						});
						checkbox.checked = true;
						toggleWrapper.createEl('label', {
							text: 'Use default',
							attr: { for: toggleId }
						});
						checkbox.addEventListener('change', () => {
							if (checkbox.checked) {
								input.value = defVal;
								input.disabled = true;
							} else {
								input.disabled = false;
							}
						});
					};
					
					// Special handling based on displayName
					if (displayNameLC === 'tags') {
						// Chips-style multi-select for tags
						const chipsWrapper = row.createDiv({ cls: 'chips-input' });
						const chipsList = chipsWrapper.createDiv({ cls: 'chips-list' });
						const input = chipsWrapper.createEl('input', {
							type: 'text',
							placeholder: 'Add tags…'
						});
						const dropdown = row.createEl('ul', { cls: 'chips-suggestions' });
						const selectedTags: string[] = [];
						let allTags: string[] = [];
						
						// Load all tags from metadata cache
						try {
							const tagsApi = this.app.metadataCache as unknown as { getTags?: () => Record<string, number> | undefined };
						const tagsMap = tagsApi.getTags?.();
							if (tagsMap) {
								allTags = Object.keys(tagsMap)
									.map(t => t.replace(/^#/, ''))
									.sort((a, b) => a.localeCompare(b));
							}
						} catch (e) {
							console.warn('Unable to load tags for suggestions:', e);
						}
						
						const renderChips = () => {
							chipsList.empty();
							selectedTags.forEach(tag => {
								const chip = chipsList.createDiv({ cls: 'chip' });
								chip.createSpan({ text: tag });
								const removeBtn = chip.createSpan({ cls: 'chip-remove', text: '×' });
								removeBtn.addEventListener('click', () => {
									const idx = selectedTags.indexOf(tag);
									if (idx >= 0) selectedTags.splice(idx, 1);
									renderChips();
									updateDropdown();
								});
							});
						};
						
						const addTag = (tag: string) => {
							const trimmed = tag.trim();
							if (!trimmed) return;
							if (!selectedTags.includes(trimmed)) {
								selectedTags.push(trimmed);
								renderChips();
							}
							input.value = '';
							updateDropdown();
							dropdown.removeClass('show');
						};
						
						const updateDropdown = () => {
							dropdown.empty();
							const query = input.value.trim().toLowerCase();
							const suggestions = allTags.filter(t => 
								!selectedTags.includes(t) && 
								(query === '' || t.toLowerCase().includes(query))
							).slice(0, 50);
							
							if (suggestions.length === 0) {
								dropdown.removeClass('show');
								return;
							}
							
							suggestions.forEach(tag => {
								const li = dropdown.createEl('li', { text: tag });
								li.addEventListener('mousedown', (ev) => {
									ev.preventDefault();
									addTag(tag);
									input.focus();
								});
							});
							dropdown.addClass('show');
						};
						
						input.addEventListener('input', updateDropdown);
						input.addEventListener('focus', updateDropdown);
						input.addEventListener('keydown', (e: KeyboardEvent) => {
							if (e.key === 'Enter' || e.key === ',') {
								e.preventDefault();
								const raw = input.value.replace(/,$/, '');
								if (raw) {
									addTag(raw);
								} else {
									const first = dropdown.querySelector('li');
									if (first && first.textContent) addTag(first.textContent);
								}
							} else if (e.key === 'Backspace' && input.value === '' && selectedTags.length > 0) {
								selectedTags.pop();
								renderChips();
								updateDropdown();
							}
						});
						
						// Custom resolver for YAML array format
						customResolvers[fullToken] = () => {
							if (selectedTags.length === 0) return '';
							const idx = templateContent.indexOf(fullToken);
							if (idx === -1) {
								return selectedTags[0] + selectedTags.slice(1).map(t => `\n- ${t}`).join('');
							}
							const lineStart = templateContent.lastIndexOf('\n', idx - 1) + 1;
							const prefix = templateContent.slice(lineStart, idx);
							return selectedTags[0] + selectedTags.slice(1).map(t => `\n${prefix}${t}`).join('');
						};
						
						inputFields[fullToken] = input;
					} else if (displayNameLC === 'quote' || displayName === 'الاقتباس') {
						const textarea = row.createEl('textarea', {
							attr: {
								rows: '8',
								placeholder: displayName === 'الاقتباس' ? 'اكتب الاقتباس هنا' : 'Write the quote here'
							}
						});
						inputFields[fullToken] = textarea;
					} else if (displayNameLC === 'author' || displayName === 'القائل') {
						const input = row.createEl('input', {
							type: 'text',
							placeholder: displayName === 'القائل' ? 'اكتب اسم المؤلف هنا' : 'Write the author here'
						});
						inputFields[fullToken] = input;
					} else if (/\bimportance\b/i.test(displayName)) {
						const input = row.createEl('input', {
							type: 'number',
							placeholder: 'Importance from 1 to 5 (5 is most important)'
						});
						input.setAttribute('min', '1');
						input.setAttribute('max', '5');
						input.setAttribute('step', '1');
						inputFields[fullToken] = input;
					} else if (/\bcomplexity\b/i.test(displayName)) {
						const input = row.createEl('input', {
							type: 'number',
							placeholder: 'Complexity from 1 to 5'
						});
						input.setAttribute('min', '1');
						input.setAttribute('max', '5');
						input.setAttribute('step', '1');
						inputFields[fullToken] = input;
					} else if (/when[-\s]*to[-\s]*use/i.test(displayNameLC)) {
						const listId = `when-to-use-list-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
						const input = row.createEl('input', {
							type: 'text',
							placeholder: 'now, today, within a week, within a month, within a year'
						});
						input.setAttribute('list', listId);
						const dataList = row.createEl('datalist', { attr: { id: listId } });
						WHEN_TO_USE_OPTIONS.forEach(option => {
							dataList.createEl('option', { attr: { value: option } });
						});
						inputFields[fullToken] = input;
					} else if (displayNameLC.includes('permanent note')) {
						const textarea = row.createEl('textarea', {
							attr: {
								rows: '10',
								placeholder: 'Write your note here'
							}
						});
						inputFields[fullToken] = textarea;
					} else if (displayNameLC.includes('prompt')) {
						const textarea = row.createEl('textarea', {
							attr: {
								rows: '10',
								placeholder: 'Write your prompt here'
							}
						});
						inputFields[fullToken] = textarea;
					} else if (/\bverified\b/i.test(displayName)) {
						const group = row.createDiv({ cls: 'radio-group' });
						const groupName = `verified-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;

						const yesWrapper = group.createDiv({ cls: 'radio-option' });
						const yesInput = yesWrapper.createEl('input', { type: 'radio' });
						yesInput.setAttribute('name', groupName);
						yesInput.setAttribute('value', 'Yes');
						yesWrapper.createEl('label', { text: 'Yes' });

						const noWrapper = group.createDiv({ cls: 'radio-option' });
						const noInput = noWrapper.createEl('input', { type: 'radio' });
						noInput.setAttribute('name', groupName);
						noInput.setAttribute('value', 'No');
						noWrapper.createEl('label', { text: 'No' });

						radioGroups[fullToken] = [yesInput, noInput];
					} else if (displayNameLC === 'concepts path') {
						const input = row.createEl('input', {
							type: 'text',
							placeholder: `Enter value for ${displayName}`
						});
						inputFields[fullToken] = input;
						conceptsPathToken = fullToken;
						applyCSheetDefault('conceptsPath', input);
						const importerContainer = row.createDiv({ cls: 'concepts-json-importer' });
						const labelSpan = importerContainer.createSpan({ text: 'Import concepts from JSON note in vault:' });
						labelSpan.addClass('concepts-json-importer-label');
						const select = importerContainer.createEl('select', { cls: 'concepts-json-select' });
						const defaultOption = select.createEl('option', { text: 'Select JSON note…' });
						defaultOption.value = '';
						const allMarkdownFiles = this.app.vault.getMarkdownFiles();
						const sortedFiles = allMarkdownFiles.slice().sort((a, b) => {
							const score = (file: TFile): number => {
								const p = file.path.toLowerCase();
								// Highest priority: any Sheets/json subpath (e.g., C/Sheets/json/...)
								if (p.includes('/sheets/json/') || p.endsWith('/sheets/json')) return 0;
								// Next: any folder containing "/json/"
								if (p.includes('/json/')) return 1;
								// Next: filenames starting with "json-"
								if (file.basename.toLowerCase().startsWith('json-')) return 2;
								// Fallback: everything else
								return 3;
							};
							const sa = score(a);
							const sb = score(b);
							if (sa !== sb) return sa - sb;
							return a.path.localeCompare(b.path);
						});
						if (sortedFiles.length === 0) {
							defaultOption.text = 'No markdown notes found in vault';
						} else {
							for (const f of sortedFiles) {
								const opt = select.createEl('option', { text: f.path });
								opt.value = f.path;
								if (!conceptsImportState.jsonFilePath) {
									conceptsImportState.jsonFilePath = f.path;
									select.value = f.path;
								}
							}
						}
						const importButton = importerContainer.createEl('button', { text: 'Load concepts' });
						importButton.addEventListener('click', () => { void (async () => {
							const selectedPath = select.value && select.value.trim();
							if (!selectedPath) {
								new Notice('Please select a JSON note from the vault');
								return;
							}
							const file = this.app.vault.getAbstractFileByPath(selectedPath);
							if (!file || !(file instanceof TFile)) {
								new Notice('Selected JSON note could not be found');
								return;
							}
							try {
								const raw = await this.app.vault.read(file);
								const data = this.parseConceptsJsonFromMarkdown(raw);
								if (!data || data.length === 0) {
									new Notice('No concepts found in selected JSON note');
									conceptsImportState.jsonFilePath = selectedPath;
									conceptsImportState.data = [];
									return;
								}
								conceptsImportState.jsonFilePath = selectedPath;
								conceptsImportState.data = data;
								const totalConcepts = this.countConcepts(data);
								new Notice(`Loaded ${totalConcepts} concepts from ${file.basename}`);
							} catch (e) {
								console.error('Error loading concepts JSON:', e);
								new Notice('Error loading concepts JSON');
							}
						})(); });
					} else {
						const input = row.createEl('input', {
							type: 'text',
							placeholder: `Enter value for ${displayName}`
						});
						// Map specific path placeholders to C-Sheets defaults
						if (isCSheetTemplate && cSheetDefaults) {
							const keyLC = displayNameLC;
							if (keyLC === 'intentions path') {
								applyCSheetDefault('intentionsPath', input);
							} else if (keyLC === 'information blocks path') {
								applyCSheetDefault('informationBlocksPath', input);
							} else if (keyLC === 'pdfs path') {
								applyCSheetDefault('pdfsPath', input);
							} else if (keyLC === 'videos path') {
								applyCSheetDefault('videosPath', input);
							} else if (keyLC === 'audios path') {
								applyCSheetDefault('audiosPath', input);
							} else if (keyLC === 'infographs path') {
								applyCSheetDefault('infographsPath', input);
							} else if (keyLC === 'images path') {
								applyCSheetDefault('imagesPath', input);
							} else if (keyLC === 'slides path') {
								applyCSheetDefault('slidesPath', input);
							} else if (keyLC === 'projects path') {
								applyCSheetDefault('projectsPath', input);
							}
						}
						inputFields[fullToken] = input;
					}
				}
			}
			
			// Buttons
			const buttonContainer = contentEl.createDiv({ cls: 'button-container' });
			const cancelButton = buttonContainer.createEl('button', { text: 'Cancel' });
			cancelButton.addEventListener('click', () => closeModal());
			
			const createButton = buttonContainer.createEl('button', { text: 'Create note' });
			createButton.addEventListener('click', () => { void (async () => {
				let noteName = nameInput.value.trim();
				if (dateCheckbox.checked) {
					const today = new Date();
					const year = today.getFullYear();
					const month = String(today.getMonth() + 1).padStart(2, '0');
					const day = String(today.getDate()).padStart(2, '0');
					const dateString = `${year}-${month}-${day}`;
					noteName = `${dateString}- ${noteName}`;
				}
				if (!noteName) {
					new Notice('Please enter a note name');
					return;
				}
				// If this is a C-Sheet template and a concepts JSON note is selected but not yet loaded,
				// ask the user to confirm creating the sheet without importing concepts.
				if (
					isCSheetTemplate &&
					conceptsPathToken &&
					conceptsImportState.jsonFilePath &&
					conceptsImportState.data === null
				) {
					const proceed = await confirmModal(
						this.app,
						'Create C-Sheet without imported concepts?',
						'You selected a JSON note for concepts but did not click "Load concepts".\n\nDo you want to create this C-Sheet without importing concepts from JSON?',
						'Create without import',
						'Go back'
					);
					if (!proceed) {
						return;
					}
				}
				
				const placeholderValues: Record<string, string> = {};
				for (const fullToken of Object.keys({ ...inputFields, ...radioGroups, ...customResolvers })) {
					let value = '';
					if (fullToken in customResolvers) {
						const resolver = customResolvers[fullToken];
						if (typeof resolver === 'function') {
							value = resolver();
						}
					} else if (fullToken in inputFields) {
						value = inputFields[fullToken].value.trim();
					} else if (fullToken in radioGroups) {
						const radios = radioGroups[fullToken];
						const checked = radios.find(r => r.checked);
						value = checked ? checked.value : '';
					}
					
					// Validate numeric fields
					const tokenNameLC = fullToken
						.slice(2, -2)
						.replace(/^VALUE\s*[:|-]?\s*/i, '')
						.toLowerCase();
					if (value !== '') {
						if (/\bimportance\b/.test(tokenNameLC)) {
							const num = Number(value);
							if (!Number.isInteger(num) || num < 1 || num > 5) {
								new Notice('Importance must be an integer between 1 and 5');
								return;
							}
						}
						if (/\bcomplexity\b/.test(tokenNameLC)) {
							const num = Number(value);
							if (!Number.isInteger(num) || num < 1 || num > 5) {
								new Notice('Complexity must be an integer between 1 and 5');
								return;
							}
						}
					}
					placeholderValues[fullToken] = value;
				}
				
				await this.createNoteFromTemplate(selectedTemplate, noteName, templateContent, placeholderValues, {
					token: conceptsPathToken,
					data: conceptsImportState.data
				});
				closeModal();
			})(); });
		} catch (error) {
			console.error('Error preparing unified note creation modal:', error);
			new Notice(`Error: ${(error as Error).message}`);
		}
	}

	/**
	 * Create note from template with placeholder replacement
	 */
	async createNoteFromTemplate(selectedTemplate: TFile, noteName: string, templateContent: string, placeholderValues: Record<string, string>, conceptsImport?: { token: string | null; data: ConceptsJsonGroup[] | null }) {
		// Replace placeholders with values
		let finalContent = templateContent;
		for (const [placeholder, value] of Object.entries(placeholderValues)) {
			finalContent = finalContent.replace(new RegExp(placeholder, 'g'), value);
		}
		if (conceptsImport && conceptsImport.token && conceptsImport.data && conceptsImport.data.length > 0) {
			const conceptsPathValue = placeholderValues[conceptsImport.token] ?? '';
			if (conceptsPathValue) {
				const headingLine = `#### ${conceptsPathValue}`;
				const headingIndex = finalContent.indexOf(headingLine);
				if (headingIndex !== -1) {
					const afterHeadingIndex = finalContent.indexOf('\n', headingIndex + headingLine.length);
					const insertPos = afterHeadingIndex === -1 ? finalContent.length : afterHeadingIndex + 1;
					const conceptsSection = this.buildConceptsMarkdown(conceptsPathValue, conceptsImport.data);
					if (conceptsSection.trim() !== '') {
						const before = finalContent.slice(0, insertPos);
						const after = finalContent.slice(insertPos);
						finalContent = `${before}\n${conceptsSection}\n${after}`;
					}
				}
			}
		}
		
		// Determine the save path based on the template name
		const templateName = selectedTemplate.basename;
		let savePath = '';
		
		// Parse the template name to create the folder structure
		const pathParts = templateName.split('-');
		
		if (pathParts.length >= 2) {
			// Create proper folder structure
			let folderPath = '';
			
			// First part is always the letter folder (e.g., 'A')
			folderPath = pathParts[0];
			
			// Process remaining parts except the last one (which is the template name)
			for (let i = 1; i < pathParts.length; i++) {
				folderPath += '/' + pathParts[i];
			}
			
			// Add the note name with .md extension
			savePath = `${folderPath}/${noteName}.md`;
		} else {
			// Fallback if the template name doesn't follow the expected format
			savePath = `${templateName}/${noteName}.md`;
		}
		
		// Normalize the path to handle any issues
		savePath = normalizePath(savePath);
		
		try {
			// Ensure the folder exists
			const folderPath = path.dirname(savePath);
			await ensureFolderExists(this.app, folderPath);
			
			// Create the note
			await this.app.vault.create(savePath, finalContent);
			
			new Notice(`Note created: ${savePath}`);
		} catch (error) {
			console.error('Error creating note:', error);
			new Notice(`Error creating note: ${(error as Error).message}`);
		}
	}

	private parseConceptsJsonFromMarkdown(raw: string): ConceptsJsonGroup[] {
		const codeBlockRegex = /```(?:json)?\s*([\s\S]*?)```/;
		const match = codeBlockRegex.exec(raw);
		if (!match) return [];
		const jsonText = match[1].trim();
		if (jsonText === '') return [];
		try {
			const parsed = JSON.parse(jsonText);
			// If it already matches the expected ConceptsJsonGroup[] shape, keep old behaviour
			if (Array.isArray(parsed) && parsed.every(v => this.isConceptsJsonGroupShape(v))) {
				return parsed as ConceptsJsonGroup[];
			}
			// Otherwise, normalize arbitrary JSON (including Arabic keys) into groups + concepts
			return this.normalizeConceptGroups(parsed);
		} catch (e) {
			console.error('Failed to parse concepts JSON:', e);
			return [];
		}
	}

	private isConceptsJsonGroupShape(value: unknown): value is ConceptsJsonGroup {
		if (!value || typeof value !== 'object') return false;
		const obj = value as { [key: string]: unknown };
		// Must at least expose a Concepts array to be considered a pre-shaped group
		if (!('Concepts' in obj)) return false;
		if ('Part' in obj && typeof obj.Part !== 'string') return false;
		if (
			'Chapter' in obj &&
			obj.Chapter !== null &&
			typeof obj.Chapter !== 'string'
		) return false;
		const concepts = obj.Concepts;
		if (!Array.isArray(concepts)) return false;
		for (const c of concepts) {
			if (!c || typeof c !== 'object') return false;
			const cc = c as { [key: string]: unknown };
			if ('name' in cc && typeof cc.name !== 'string') return false;
			if ('description' in cc && typeof cc.description !== 'string') return false;
		}
		return true;
	}

	private normalizeConceptGroups(parsed: unknown): ConceptsJsonGroup[] {
		// Generic strategy:
		// 1) Walk the entire JSON tree and collect every concept object together with
		//    the string headings found in its ancestor objects.
		// 2) Derive up to two levels of headings per concept (Part, Chapter) from
		//    that heading stack.
		// 3) Group concepts by (Part, Chapter) pair into ConceptsJsonGroup objects.
		const collected: { headings: string[]; concept: ConceptsJsonConcept }[] = [];
		this.collectConceptsWithHeadings(parsed, [], collected);
		if (collected.length === 0) return [];
		const groupMap = new Map<string, ConceptsJsonGroup>();
		for (const item of collected) {
			const cleanHeadings = item.headings.map(h => h.trim()).filter(h => h.length > 0);
			const part = cleanHeadings[0] || '';
			const chapterSegments = cleanHeadings.slice(1);
			const chapter = chapterSegments.join('\n');
			const key = `${part}||${chapter}`;
			let group = groupMap.get(key);
			if (!group) {
				group = {
					Part: part || undefined,
					Chapter: chapter || undefined,
					Concepts: [],
				};
				groupMap.set(key, group);
			}
			(group.Concepts ?? (group.Concepts = [])).push(item.concept);
		}
		return Array.from(groupMap.values());
	}

	private collectConceptsWithHeadings(
		value: unknown,
		headingStack: string[],
		out: { headings: string[]; concept: ConceptsJsonConcept }[],
	): void {
		if (Array.isArray(value)) {
			for (const item of value) {
				this.collectConceptsWithHeadings(item, headingStack, out);
			}
			return;
		}
		if (!value || typeof value !== 'object') return;
		const obj = value as Record<string, unknown>;
		// If this object itself is a concept, record it with the current heading stack
		// and do not descend further inside it.
		const concept = this.conceptFromObject(obj);
		if (concept) {
			out.push({ headings: headingStack, concept });
			return;
		}
		// Derive additional headings for this level from any string properties.
		// This is language-agnostic: any string field above the concepts becomes
		// a heading level, in the order it appears in the JSON.
		const localHeadings: string[] = [];
		for (const [, rawVal] of Object.entries(obj)) {
			if (typeof rawVal !== 'string') continue;
			const text = rawVal.trim();
			if (!text) continue;
			if (!headingStack.includes(text) && !localHeadings.includes(text)) {
				localHeadings.push(text);
			}
		}
		const newHeadingStack = headingStack.concat(localHeadings);
		for (const child of Object.values(obj)) {
			if (child && typeof child === 'object') {
				this.collectConceptsWithHeadings(child, newHeadingStack, out);
			}
		}
	}

	private normalizeConceptGroup(value: unknown): ConceptsJsonGroup | null {
		if (!value || typeof value !== 'object') return null;
		const obj = value as Record<string, unknown>;
		// 1) Try language-specific/known keys first
		let part = this.pickFirstStringProperty(obj, ['Part', 'part', 'جزء', 'الجزء', 'الفصل']);
		let chapter = this.pickFirstStringProperty(obj, ['Chapter', 'chapter', 'سورة', 'السورة', 'الموضوع']);
		// 2) Fallback: use the first and second string properties as generic heading levels
		if (!part || !chapter) {
			const stringKeys: string[] = [];
			for (const [key, val] of Object.entries(obj)) {
				if (typeof val === 'string') {
					stringKeys.push(key);
				}
			}
			if (!part && stringKeys.length > 0) {
				const v = obj[stringKeys[0]];
				if (typeof v === 'string' && v.trim() !== '') {
					part = v.trim();
				}
			}
			if (!chapter && stringKeys.length > 1) {
				const v = obj[stringKeys[1]];
				if (typeof v === 'string' && v.trim() !== '') {
					chapter = v.trim();
				}
			}
		}
		const concepts = this.extractConceptsFromValue(obj);
		if (!part && !chapter && concepts.length === 0) return null;
		return {
			Part: part || undefined,
			Chapter: chapter || undefined,
			Concepts: concepts,
		};
	}

	private pickFirstStringProperty(obj: Record<string, unknown>, keys: string[]): string {
		for (const key of keys) {
			const value = obj[key];
			if (typeof value === 'string') {
				const trimmed = value.trim();
				if (trimmed !== '') return trimmed;
			}
		}
		return '';
	}

	private extractConceptsFromValue(value: unknown): ConceptsJsonConcept[] {
		const concepts: ConceptsJsonConcept[] = [];
		const visit = (val: unknown) => {
			if (Array.isArray(val)) {
				for (const item of val) {
					visit(item);
				}
				return;
			}
			if (!val || typeof val !== 'object') return;
			const obj = val as Record<string, unknown>;
			const concept = this.conceptFromObject(obj);
			if (concept) concepts.push(concept);
			for (const child of Object.values(obj)) {
				if (child && typeof child === 'object') {
					visit(child);
				}
			}
		};
		visit(value);
		return concepts;
	}

	private conceptFromObject(obj: Record<string, unknown>): ConceptsJsonConcept | null {
		const keys = Object.keys(obj);
		if (keys.length === 0) return null;
		const stringKeys = keys.filter(k => typeof obj[k] === 'string');
		if (stringKeys.length === 0) return null;
		const normalizeKey = (k: string) => k.toLowerCase().replace(/[\s_]+/g, '');
		const isNameKey = (nk: string) =>
			nk.includes('name') ||
			nk.includes('title') ||
			nk.includes('concept') ||
			nk.includes('topic') ||
			nk.includes('اسم') ||
			nk.includes('العنوان') ||
			nk.includes('الموضوع');
		const isDescriptionKey = (nk: string) =>
			nk.includes('description') ||
			nk.includes('desc') ||
			nk.includes('details') ||
			nk.includes('summary') ||
			nk.includes('شرح') ||
			nk.includes('الوصف') ||
			nk.includes('تفاصيل') ||
			nk.includes('ملخص');
		let nameKey: string | undefined;
		let descKey: string | undefined;
		for (const key of stringKeys) {
			const nk = normalizeKey(key);
			if (!nameKey && isNameKey(nk)) nameKey = key;
			if (!descKey && isDescriptionKey(nk)) descKey = key;
		}
		if (!nameKey || !descKey) return null;
		const nameValue = obj[nameKey];
		const descValue = obj[descKey];
		if (typeof nameValue !== 'string' || typeof descValue !== 'string') return null;
		const name = nameValue.trim();
		const description = descValue.trim();
		if (!name && !description) return null;
		return { name, description };
	}

	private buildConceptsMarkdown(conceptsPathValue: string, groups: ConceptsJsonGroup[]): string {
		const lines: string[] = [];
		const baseConceptPath = (conceptsPathValue || '').trim().replace(/\/+$/, '');
		let lastPart: string | undefined;
		let lastChapterSegments: string[] = [];
		for (const group of groups) {
			const part = typeof group.Part === 'string' ? group.Part.trim() : '';
			const rawChapter = typeof group.Chapter === 'string' ? group.Chapter : '';
			const concepts = Array.isArray(group.Concepts) ? group.Concepts : [];
			if (!part && !rawChapter && concepts.length === 0) continue;
			if (part && part !== lastPart) {
				if (lines.length > 0) {
					lines.push('');
				}
				lines.push(`##### ${part}`);
				lastPart = part;
				lastChapterSegments = [];
			}
			const chapterSegments = rawChapter.split('\n').map(s => s.trim()).filter(s => s.length > 0);
			if (chapterSegments.length > 0) {
				let divergenceIndex = 0;
				const maxCommon = Math.min(chapterSegments.length, lastChapterSegments.length);
				while (
					divergenceIndex < maxCommon &&
					chapterSegments[divergenceIndex] === lastChapterSegments[divergenceIndex]
				) {
					divergenceIndex++;
				}
				for (let i = divergenceIndex; i < chapterSegments.length; i++) {
					const chapter = chapterSegments[i];
					if (!chapter) continue;
					lines.push('');
					lines.push(`###### ${chapter}`);
				}
				lastChapterSegments = chapterSegments;
			} else {
				// No chapter headings for this group; reset so the next group prints its full path
				lastChapterSegments = [];
			}
			for (const concept of concepts) {
				const name = concept && typeof concept.name === 'string' ? concept.name.trim() : '';
				const description = concept && typeof concept.description === 'string' ? concept.description.trim() : '';
				if (!name && !description) continue;
				lines.push('');
				if (name) {
					const fullPath = baseConceptPath ? `${baseConceptPath}/${name}` : name;
					lines.push(`- ==${fullPath}==`);
				} else if (description) {
					// No name, only description
					lines.push(`- ${description}`);
				}
				if (name && description) {
					lines.push(`  ${description}`);
				}
				// Append D1 metadata lines under each concept so they collapse with the concept bullet
				lines.push('  D1 No.: ');
				lines.push('  Optional:');
				lines.push('  Is verified?(Y or N):');
				lines.push('  Degree of importance (1-5):');
				lines.push('  Complexity (1-5):');
			}
		}
		return lines.join('\n');
	}

	private countConcepts(groups: ConceptsJsonGroup[]): number {
		let count = 0;
		for (const group of groups) {
			if (Array.isArray(group.Concepts)) {
				count += group.Concepts.length;
			}
		}
		return count;
	}
}
