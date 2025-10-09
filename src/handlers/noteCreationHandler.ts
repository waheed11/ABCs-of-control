import { App, TFile, Notice, normalizePath } from 'obsidian';
import * as path from 'path';
import { WHEN_TO_USE_OPTIONS } from '../constants';
import { ensureFolderExists } from '../utils';

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
		// RTL + i18n
		const isArabic = (() => {
			try { const p = (this.app as any).plugins?.plugins?.['abcs-of-control']; return p?.settings?.language === 'arabic'; } catch { return false; }
		})();
		const t = (en: string, ar: string) => isArabic ? ar : en;
		contentEl.setAttr('dir', isArabic ? 'rtl' : 'ltr');
		contentEl.createEl('h2', { text: t('Create Note', 'إنشاء ملاحظة') });
		
		// Name input
		const nameInputContainer = contentEl.createDiv({ cls: 'name-input-container' });
		const nameInput = nameInputContainer.createEl('input', {
			type: 'text',
			placeholder: t('Enter note name', 'أدخل اسم الملاحظة')
		});
		
		// Optional date checkbox
		const dateCheckboxContainer = contentEl.createDiv({ cls: 'date-checkbox-container' });
		const dateCheckbox = dateCheckboxContainer.createEl('input', {
			type: 'checkbox',
			attr: { id: 'insert-date-checkbox' }
		});
		dateCheckboxContainer.createEl('label', {
			text: t("Prepend today's date (YYYY-MM-DD)", 'إضافة تاريخ اليوم في البداية (YYYY-MM-DD)'),
			attr: { for: 'insert-date-checkbox' }
		});
		
		// Prepare placeholder inputs by reading template content
		const placeholderSection = contentEl.createDiv({ cls: 'placeholder-section' });
		const inputFields: Record<string, HTMLInputElement | HTMLTextAreaElement> = {};
		const radioGroups: Record<string, HTMLInputElement[]> = {};
		const customResolvers: Record<string, () => string> = {};
		
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
				placeholderSection.createEl('h3', { text: t('Template Fields', 'حقول القالب') });
				
				// Reorder: tags → Quote (EN/AR) → Author (EN/AR) → The permanent note → Verified → Importance → When to use → Complexity → Prompt → Source → others
				const tagsTokens: string[] = [];
				const quoteEnTokens: string[] = [];
				const quoteArTokens: string[] = [];
				const authorEnTokens: string[] = [];
				const authorArTokens: string[] = [];
				const permanentNoteTokens: string[] = [];
				const verifiedTokens: string[] = [];
				const importanceTokens: string[] = [];
				const whenTokens: string[] = [];
				const complexityTokens: string[] = [];
				const promptTokens: string[] = [];
				const sourceTokens: string[] = [];
				const otherTokens: string[] = [];
				
				for (const token of uniquePlaceholders) {
					const inner = token.slice(2, -2).trim();
					const displayName = inner.replace(/^VALUE\s*[:|-]?\s*/i, '');
					const lowerCase = displayName.toLowerCase();
					
					if (lowerCase === 'tags' || displayName === 'الوسم' || displayName === 'الوسوم') {
						tagsTokens.push(token);
					} else if (lowerCase === 'quote') {
						quoteEnTokens.push(token);
					} else if (displayName === 'الاقتباس') {
						quoteArTokens.push(token);
					} else if (lowerCase === 'author') {
						authorEnTokens.push(token);
					} else if (displayName === 'القائل') {
						authorArTokens.push(token);
					} else if (lowerCase.includes('permanent note') || displayName.includes('الملاحظة الدائمة')) {
						permanentNoteTokens.push(token);
					} else if (/\bverified\b/i.test(lowerCase) || displayName.includes('التحقق') || displayName.includes('تم التحقق')) {
						verifiedTokens.push(token);
					} else if (/\bimportance\b/i.test(lowerCase) || displayName.includes('الأهمية') || displayName.includes('الاهمية')) {
						importanceTokens.push(token);
					} else if (/when[-\s]*to[-\s]*use/i.test(lowerCase) || displayName.includes('متى الاستخدام')) {
						whenTokens.push(token);
					} else if (/\bcomplexity\b/i.test(lowerCase) || displayName.includes('التعقيد')) {
						complexityTokens.push(token);
					} else if (lowerCase.includes('prompt') || displayName.includes('المطالبة')) {
						promptTokens.push(token);
					} else if (lowerCase.includes('source') || displayName.includes('المصدر')) {
						sourceTokens.push(token);
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
					...verifiedTokens,
					...importanceTokens,
					...whenTokens,
					...complexityTokens,
					...promptTokens,
					...sourceTokens,
					...otherTokens
				];
				
				for (const fullToken of orderedTokens) {
					const inner = fullToken.slice(2, -2);
					const name = inner.trim();
					const displayName = name.replace(/^VALUE\s*[:|-]?\s*/i, '');
					const displayNameLC = displayName.toLowerCase();
					const row = placeholderSection.createDiv({ cls: 'placeholder-input-container' });
					row.createEl('label', { text: displayName });
					
					// Special handling based on displayName
					if (displayNameLC === 'tags' || displayName === 'الوسم' || displayName === 'الوسوم') {
						// Chips-style multi-select for tags
						const chipsWrapper = row.createDiv({ cls: 'chips-input' });
						const chipsList = chipsWrapper.createDiv({ cls: 'chips-list' });
						const input = chipsWrapper.createEl('input', {
							type: 'text',
							placeholder: t('Add tags…', 'أضف وسوماً…')
						});
						const dropdown = row.createEl('ul', { cls: 'chips-suggestions' });
						const selectedTags: string[] = [];
						let allTags: string[] = [];
						
						// Load all tags from metadata cache
						try {
							const tagsMap = (this.app.metadataCache as any).getTags?.() as Record<string, number> | undefined;
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
									if (first) addTag((first as HTMLElement).innerText);
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
					} else if (/\bimportance\b/i.test(displayNameLC) || displayName.includes('الأهمية') || displayName.includes('الاهمية')) {
						const input = row.createEl('input', {
							type: 'number',
							placeholder: t('Importance from 1 to 5 (5 is most important)', 'الأهمية من 1 إلى 5 (5 الأكثر أهمية)')
						});
						input.setAttribute('min', '1');
						input.setAttribute('max', '5');
						input.setAttribute('step', '1');
						inputFields[fullToken] = input;
					} else if (/\bcomplexity\b/i.test(displayNameLC) || displayName.includes('التعقيد')) {
						const input = row.createEl('input', {
							type: 'number',
							placeholder: t('Complexity from 1 to 5', 'التعقيد من 1 إلى 5')
						});
						input.setAttribute('min', '1');
						input.setAttribute('max', '5');
						input.setAttribute('step', '1');
						inputFields[fullToken] = input;
					} else if (/when[-\s]*to[-\s]*use/i.test(displayNameLC) || displayName.includes('متى الاستخدام')) {
						const listId = `when-to-use-list-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
						const input = row.createEl('input', {
							type: 'text',
							placeholder: t('now, today, within a week, within a month, within a year', 'الآن، اليوم، خلال أسبوع، خلال شهر، خلال سنة')
						});
						input.setAttribute('list', listId);
						const dataList = row.createEl('datalist', { attr: { id: listId } });
						const suggestOptions = isArabic ? ['الآن', 'اليوم', 'خلال أسبوع', 'خلال شهر', 'خلال سنة'] : WHEN_TO_USE_OPTIONS;
						suggestOptions.forEach(option => {
							dataList.createEl('option', { attr: { value: option } });
						});
						inputFields[fullToken] = input;
					} else if (displayNameLC.includes('permanent note') || displayName.includes('الملاحظة الدائمة')) {
						const textarea = row.createEl('textarea', {
							attr: {
								rows: '10',
								placeholder: t('Write your note here', 'اكتب ملاحظتك هنا')
							}
						});
						inputFields[fullToken] = textarea;
					} else if (displayNameLC.includes('prompt') || displayName.includes('المطالبة')) {
						const textarea = row.createEl('textarea', {
							attr: {
								rows: '10',
								placeholder: t('Write your prompt here', 'اكتب الأمر هنا')
							}
						});
						inputFields[fullToken] = textarea;
					} else if (/\bverified\b/i.test(displayNameLC) || displayName.includes('التحقق')) {
						const group = row.createDiv({ cls: 'radio-group' });
						const groupName = `verified-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;

						const yesWrapper = group.createDiv({ cls: 'radio-option' });
						const yesInput = yesWrapper.createEl('input', { type: 'radio' });
						yesInput.setAttribute('name', groupName);
						yesInput.setAttribute('value', 'Yes');
						yesWrapper.createEl('label', { text: t('Yes', 'نعم') });

						const noWrapper = group.createDiv({ cls: 'radio-option' });
						const noInput = noWrapper.createEl('input', { type: 'radio' });
						noInput.setAttribute('name', groupName);
						noInput.setAttribute('value', 'No');
						noWrapper.createEl('label', { text: t('No', 'لا') });

						radioGroups[fullToken] = [yesInput, noInput];
					} else {
						const input = row.createEl('input', {
							type: 'text',
							placeholder: isArabic ? `أدخل قيمة لـ ${displayName}` : `Enter value for ${displayName}`
						});
						inputFields[fullToken] = input;
					}
				}
		}
			
			// Buttons
			const buttonContainer = contentEl.createDiv({ cls: 'button-container' });
			const cancelButton = buttonContainer.createEl('button', { text: t('Cancel', 'إلغاء') });
			cancelButton.addEventListener('click', () => closeModal());
			
			const createButton = buttonContainer.createEl('button', { text: t('Create Note', 'إنشاء الملاحظة') });
			createButton.addEventListener('click', async () => {
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
					new Notice(t('Please enter a note name', 'يرجى إدخال اسم للملاحظة'));
					return;
				}
				
				const placeholderValues: Record<string, string> = {};
				for (const fullToken of Object.keys({ ...inputFields, ...radioGroups, ...customResolvers })) {
					let value = '';
					if (fullToken in customResolvers) {
						value = customResolvers[fullToken]!();
					} else if (fullToken in inputFields) {
						value = (inputFields[fullToken] as HTMLInputElement | HTMLTextAreaElement).value.trim();
					} else if (fullToken in radioGroups) {
						const radios = radioGroups[fullToken];
						const checked = radios.find(r => (r as HTMLInputElement).checked);
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
								new Notice(t('Importance must be an integer between 1 and 5', 'يجب أن تكون الأهمية عددًا صحيحًا بين 1 و 5'));
								return;
							}
						}
						if (/\bcomplexity\b/.test(tokenNameLC)) {
							const num = Number(value);
							if (!Number.isInteger(num) || num < 1 || num > 5) {
								new Notice(t('Complexity must be an integer between 1 and 5', 'يجب أن يكون التعقيد عددًا صحيحًا بين 1 و 5'));
								return;
							}
						}
					}
					placeholderValues[fullToken] = value;
				}
				
				await this.createNoteFromTemplate(selectedTemplate, noteName, templateContent, placeholderValues);
				closeModal();
			});
		} catch (error) {
			console.error('Error preparing unified note creation modal:', error);
			new Notice(`${t('Error', 'خطأ')}: ${(error as Error).message}`);
		}
	}

	/**
	 * Create note from template with placeholder replacement
	 */
	async createNoteFromTemplate(selectedTemplate: TFile, noteName: string, templateContent: string, placeholderValues: Record<string, string>) {
		// Local i18n for notices inside this method
		const isArabic = (() => {
			try { const p = (this.app as any).plugins?.plugins?.['abcs-of-control']; return p?.settings?.language === 'arabic'; } catch { return false; }
		})();
		const t = (en: string, ar: string) => isArabic ? ar : en;
		// Replace placeholders with values
		let finalContent = templateContent;
		for (const [placeholder, value] of Object.entries(placeholderValues)) {
			finalContent = finalContent.replace(new RegExp(placeholder, 'g'), value);
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
			
			new Notice(`${t('Note created:', 'تم إنشاء الملاحظة:')} ${savePath}`);
		} catch (error) {
			console.error('Error creating note:', error);
			new Notice(`${t('Error creating note:', 'حدث خطأ أثناء إنشاء الملاحظة:')} ${(error as Error).message}`);
		}
	}
}
