import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, TFile, TFolder, MarkdownFileInfo, addIcon, normalizePath } from 'obsidian';
import * as path from 'path';

interface MyPluginSettings {
	templateFolderPath: string;
	defaultHighlightColor: string;
	language: string;
}

const DEFAULT_SETTINGS: MyPluginSettings = {
	templateFolderPath: 'C/Templates',
	defaultHighlightColor: 'yellow',
	language: 'english' // Default language
}

// Store copied highlight data
interface HighlightData {
	text: string;
	comment: string;
	color: string;
}

// Section headers for different languages
const SECTION_HEADERS = {
	english: {
		highlights: '## 📝 Highlights & Comments',
		quotes: '# 🗨 Quotes'
	},
	arabic: {
		highlights: '## 📝 التحديدات والتعليقات',
		quotes: '# 🗨 اقتباسات'
	}
};

export default class ABCsOfControlPlugin extends Plugin {
	settings: MyPluginSettings;
	copiedHighlight: HighlightData | null = null;

	async onload() {
		await this.loadSettings();
		
		// Add a ribbon icon
		this.addRibbonIcon('lucide-a-large-small', 'ABCs of control', (evt: MouseEvent) => {
			new ABCsModal(this.app, this).open();
		});

		// Add a command to open the ABCs modal
		this.addCommand({
			id: 'start-abcs-of-control',
			name: 'Start ABCs of Control',
			callback: () => {
				new ABCsModal(this.app, this).open();
			}
		});

		// Register context menu event
		this.registerEvent(
			this.app.workspace.on('editor-menu', (menu, editor, view) => {
				if (editor.getSelection().length > 0) {
					menu.addItem((item) => {
						item.setTitle('ABCs: Highlight')
							.setIcon('highlighter')
							.onClick(() => this.handleHighlight(editor, view));
					});

					menu.addItem((item) => {
						item.setTitle('ABCs: Copy Highlight')
							.setIcon('copy')
							.onClick(() => this.handleCopyHighlight(editor, view));
					});

					if (this.copiedHighlight) {
						menu.addItem((item) => {
							item.setTitle('ABCs: Paste Highlight')
								.setIcon('paste')
								.onClick(() => this.handlePasteHighlight(editor, view));
						});
					}

					menu.addItem((item) => {
						item.setTitle('ABCs: Quote')
							.setIcon('quote')
							.onClick(() => this.handleQuote(editor, view));
					});
				}
			})
		);

		// Add settings tab
		this.addSettingTab(new ABCsSettingTab(this.app, this));
	}

	// Handle highlight action
	async handleHighlight(editor: Editor, view: MarkdownView | MarkdownFileInfo) {
		const selectedText = editor.getSelection();
		if (!selectedText) return;

		// Get the file from the view
		const file = this.getFileFromView(view);
		if (!file) {
			new Notice('Cannot highlight: No file is open');
			return;
		}

		// Open color picker modal
		const colors = ['yellow', 'green', 'red', 'blue', 'gray'];
		const color = await this.openColorPicker(colors, this.settings.defaultHighlightColor);
		if (!color) return;

		// Prompt for comment
		const comment = await this.openPromptModal('Enter a comment (optional)', '', 'Comment for highlight');
		if (comment === null) return; // User cancelled

		// Store the highlight data
		const highlightData: HighlightData = {
			text: selectedText,
			comment: comment,
			color: color
		};

		// Add the highlight to the current note
		await this.addHighlightToNote(file, highlightData);
	}

	// Handle copy highlight action
	async handleCopyHighlight(editor: Editor, view: MarkdownView | MarkdownFileInfo) {
		const selectedText = editor.getSelection();
		if (!selectedText) return;

		// Open color picker modal
		const colors = ['yellow', 'green', 'red', 'blue', 'gray'];
		const color = await this.openColorPicker(colors, this.settings.defaultHighlightColor);
		if (!color) return;

		// Prompt for comment
		const comment = await this.openPromptModal('Enter a comment (optional)', '', 'Comment for highlight');
		if (comment === null) return; // User cancelled

		// Store the highlight data
		this.copiedHighlight = {
			text: selectedText,
			comment: comment,
			color: color
		};

		new Notice('Highlight copied and stored for later use');
	}

	// Handle paste highlight action
	async handlePasteHighlight(editor: Editor, view: MarkdownView | MarkdownFileInfo) {
		if (!this.copiedHighlight) return;
		
		// Get the file from the view
		const file = this.getFileFromView(view);
		if (!file) {
			new Notice('Cannot paste highlight: No file is open');
			return;
		}
		
		// Use the stored highlight data, not the current selection
		await this.addHighlightToNote(file, this.copiedHighlight);
		new Notice('Stored highlight pasted');
	}

	// Handle quote action
	async handleQuote(editor: Editor, view: MarkdownView | MarkdownFileInfo) {
		const selectedText = editor.getSelection();
		if (!selectedText) return;

		// Get the file from the view
		const file = this.getFileFromView(view);
		if (!file) {
			new Notice('Cannot add quote: No file is open');
			return;
		}

		const fileContents = await this.app.vault.read(file);
		const lines = fileContents.split('\n');
		
		// Check if the Quotes section exists in any language
		const englishHeaderIndex = lines.findIndex(line => line.trim() === SECTION_HEADERS.english.quotes);
		const arabicHeaderIndex = lines.findIndex(line => line.trim() === SECTION_HEADERS.arabic.quotes);
		
		// Use the found header or default to the configured language
		let quotesHeaderIndex = -1;
		let quotesHeader = '';
		
		if (englishHeaderIndex !== -1) {
			quotesHeaderIndex = englishHeaderIndex;
			quotesHeader = SECTION_HEADERS.english.quotes;
		} else if (arabicHeaderIndex !== -1) {
			quotesHeaderIndex = arabicHeaderIndex;
			quotesHeader = SECTION_HEADERS.arabic.quotes;
		} else {
			// If no header found, use the configured language or detect from file content
			const isArabic = this.detectArabicContent(fileContents);
			quotesHeader = isArabic ? 
				SECTION_HEADERS.arabic.quotes : 
				SECTION_HEADERS.english.quotes;
		}
		
		let updatedContent: string;
		if (quotesHeaderIndex === -1) {
			// If Quotes section doesn't exist, add it at the end
			updatedContent = fileContents + '\n\n' + quotesHeader + '\n\n> ' + selectedText + '\n';
		} else {
			// If Quotes section exists, add the quote at the end of that section
			let endOfQuotesSection = quotesHeaderIndex + 1;
			while (endOfQuotesSection < lines.length && 
				   (lines[endOfQuotesSection].trim() === '' || 
				    !lines[endOfQuotesSection].startsWith('#'))) {
				endOfQuotesSection++;
			}
			
			// Insert the quote before the next section
			lines.splice(endOfQuotesSection, 0, '', '> ' + selectedText);
			updatedContent = lines.join('\n');
		}
		
		// Save the updated content
		await this.app.vault.modify(file, updatedContent);
		new Notice('Quote added');
	}

	// Helper function to get TFile from either MarkdownView or MarkdownFileInfo
	getFileFromView(view: MarkdownView | MarkdownFileInfo): TFile | null {
		if (view instanceof MarkdownView) {
			return view.file;
		} else if ('file' in view) {
			return view.file;
		}
		return null;
	}

	// Add highlight to note
	async addHighlightToNote(file: TFile, highlightData: HighlightData) {
		if (!file) return;

		const fileContents = await this.app.vault.read(file);
		const lines = fileContents.split('\n');
		
		// Check if the Highlights section exists in any language
		const englishHeaderIndex = lines.findIndex(line => line.trim() === SECTION_HEADERS.english.highlights);
		const arabicHeaderIndex = lines.findIndex(line => line.trim() === SECTION_HEADERS.arabic.highlights);
		
		// Use the found header or default to the configured language
		let highlightsHeaderIndex = -1;
		let highlightsHeader = '';
		
		if (englishHeaderIndex !== -1) {
			highlightsHeaderIndex = englishHeaderIndex;
			highlightsHeader = SECTION_HEADERS.english.highlights;
		} else if (arabicHeaderIndex !== -1) {
			highlightsHeaderIndex = arabicHeaderIndex;
			highlightsHeader = SECTION_HEADERS.arabic.highlights;
		} else {
			// If no header found, use the configured language or detect from file content
			const isArabic = this.detectArabicContent(fileContents);
			highlightsHeader = isArabic ? 
				SECTION_HEADERS.arabic.highlights : 
				SECTION_HEADERS.english.highlights;
		}
		
		let updatedContent: string;
		if (highlightsHeaderIndex === -1) {
			// If Highlights section doesn't exist, add it at the end
			updatedContent = fileContents + '\n\n' + highlightsHeader + '\n\n';
			updatedContent += this.formatHighlight(highlightData);
		} else {
			// If Highlights section exists, add the highlight at the end of that section
			let endOfHighlightsSection = highlightsHeaderIndex + 1;
			while (endOfHighlightsSection < lines.length && 
				   (lines[endOfHighlightsSection].trim() === '' || 
				    !lines[endOfHighlightsSection].startsWith('#'))) {
				endOfHighlightsSection++;
			}
			
			// Insert the highlight before the next section
			const formattedHighlight = this.formatHighlight(highlightData);
			lines.splice(endOfHighlightsSection, 0, '', formattedHighlight);
			updatedContent = lines.join('\n');
		}
		
		// Save the updated content
		await this.app.vault.modify(file, updatedContent);
		new Notice('Highlight added');
	}

	// Format highlight with color and comment
	formatHighlight(highlightData: HighlightData): string {
		let result = `<mark style="background: ${highlightData.color}">${highlightData.text}</mark>`;
		
		if (highlightData.comment) {
			result += `\n\n**Comment:** ${highlightData.comment}`;
		}
		
		return result;
	}

	// Open color picker modal
	async openColorPicker(colors: string[], defaultColor: string): Promise<string | null> {
		return new Promise((resolve) => {
			new ColorPickerModal(this.app, colors, defaultColor, resolve).open();
		});
	}

	// Open prompt modal
	async openPromptModal(promptText: string, defaultValue: string, placeholder: string): Promise<string | null> {
		return new Promise((resolve) => {
			new PromptModal(this.app, promptText, defaultValue, placeholder, resolve).open();
		});
	}

	onunload() {
		// Clean up when the plugin is disabled
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	// Helper function to get all template files
	async getTemplateFiles(): Promise<Map<string, TFile[]>> {
		const templateMap = new Map<string, TFile[]>();
		const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
		
		// Initialize map with empty arrays for each letter
		alphabet.forEach(letter => {
			templateMap.set(letter, []);
		});
		
		// Get the template folder
		const templateFolder = this.app.vault.getAbstractFileByPath(this.settings.templateFolderPath);
		
		if (!templateFolder || !(templateFolder instanceof TFolder)) {
			new Notice(`Template folder not found: ${this.settings.templateFolderPath}`);
			return templateMap;
		}
		
		// Process all files in the template folder
		for (const file of templateFolder.children) {
			if (file instanceof TFile && file.extension === 'md') {
				const fileName = file.basename;
				
				// Check if the file name starts with "Insert-to-"
				if (fileName.startsWith('Insert-to-')) {
					// Extract the letter after "Insert-to-"
					const parts = fileName.substring('Insert-to-'.length).split('-');
					if (parts.length > 0) {
						const letter = parts[0].toUpperCase();
						if (alphabet.includes(letter)) {
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
						if (alphabet.includes(letter)) {
							const letterFiles = templateMap.get(letter) || [];
							letterFiles.push(file);
							templateMap.set(letter, letterFiles);
						}
					}
				} else {
					// Check if the file name starts with a letter followed by a dash
					const firstChar = fileName.charAt(0).toUpperCase();
					if (alphabet.includes(firstChar) && fileName.charAt(1) === '-') {
						const letterFiles = templateMap.get(firstChar) || [];
						letterFiles.push(file);
						templateMap.set(firstChar, letterFiles);
					}
				}
			} else if (file instanceof TFolder) {
				// Process files within subfolders
				const folderFiles = await this.getFilesInFolder(file);
				
				// Add folder to the map with its files
				if (folderFiles.length > 0) {
					const folderName = file.name;
					templateMap.set(folderName, folderFiles);
				}
			}
		}
		
		return templateMap;
	}
	
	// Helper function to get files in a folder
	async getFilesInFolder(folder: TFolder): Promise<TFile[]> {
		const files: TFile[] = [];
		
		for (const child of folder.children) {
			if (child instanceof TFile && child.extension === 'md') {
				files.push(child);
			}
		}
		
		return files;
	}

	// Detect if content contains Arabic text
	detectArabicContent(content: string): boolean {
		// Check if the content contains Arabic characters
		// Arabic Unicode range is U+0600 to U+06FF
		const arabicRegex = /[\u0600-\u06FF]/;
		return arabicRegex.test(content);
	}
}

class ABCsModal extends Modal {
	plugin: ABCsOfControlPlugin;
	templateMap: Map<string, TFile[]> = new Map();
	selectedTemplate: TFile | null = null;
	
	constructor(app: App, plugin: ABCsOfControlPlugin) {
		super(app);
		this.plugin = plugin;
	}
	
	async onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('abcs-of-control-modal');
		
		// Add title
		contentEl.createEl('h2', { text: 'ABCs of Control' });
		
		// Load template files
		this.templateMap = await this.plugin.getTemplateFiles();
		
		// Create ABCs UI based on the wireframe
		const abcContainer = contentEl.createDiv({ cls: 'abc-container' });
		
		// Create the layout structure
		const topRow = abcContainer.createDiv({ cls: 'abc-row top-row' });
		const middleRow = abcContainer.createDiv({ cls: 'abc-row middle-row' });
		const bottomRow = abcContainer.createDiv({ cls: 'abc-row bottom-row' });
		
		// Create letter cells
		const letterA = this.createLetterCell('A', 'left', topRow);
		const letterB = this.createLetterCell('B', 'right', topRow);
		const letterC = this.createLetterCell('C', 'center', middleRow);
		const letterD = this.createLetterCell('D', 'left', bottomRow);
		const letterE = this.createLetterCell('E', 'right', bottomRow);
		
		// Add container for template list
		contentEl.createDiv({ cls: 'template-list-container' });
	}
	
	createLetterCell(letter: string, position: string, container: HTMLElement): HTMLElement {
		const letterCell = container.createDiv({ cls: `letter-cell ${position}` });
		
		// Create the letter bubble
		const letterBubble = letterCell.createDiv({ cls: 'letter-bubble' });
		letterBubble.createDiv({ cls: 'letter', text: letter });
		
		// Check if templates exist for this letter
		const hasTemplates = (this.templateMap.get(letter) ?? []).length > 0;
		
		// Make the bubble clickable if templates exist
		if (hasTemplates) {
			letterBubble.addClass('has-templates');
			letterBubble.addEventListener('click', () => {
				this.showTemplatesForLetter(letter);
			});
		}
		
		return letterCell;
	}
	
	async showTemplatesForLetter(letter: string) {
		const { contentEl } = this;
		const templateListContainer = contentEl.querySelector('.template-list-container');
		if (!templateListContainer) return;
		
		templateListContainer.empty();
		
		const templates = this.templateMap.get(letter) || [];
		if (templates.length === 0) {
			templateListContainer.createEl('p', { text: `No templates found for letter ${letter}` });
			return;
		}
		
		const templateList = templateListContainer.createEl('ul', { cls: 'template-list' });
		
		for (const template of templates) {
			const listItem = templateList.createEl('li');
			const templateButton = listItem.createEl('button', { text: template.basename });
			
			templateButton.addEventListener('click', async () => {
				this.selectedTemplate = template;
				
				// Check if this is an "Insert-to-" template
				if (template.basename.startsWith('Insert-to-')) {
					// Read template content
					const templateContent = await this.app.vault.read(template);
					// Handle insert-to template directly
					await this.handleInsertToTemplate(template, templateContent);
				} else if (template.basename.startsWith('Invoke-')) {
					// Read template content
					const templateContent = await this.app.vault.read(template);
					// Handle invoke template directly
					await this.handleInvokeTemplate(template, templateContent);
				} else if (template.basename.includes("Literature Notes") || letter === "B") {
					// Literature note template or any template in section B - go directly to data source selection
					await this.promptForDataSource();
				} else {
					// Regular template - unified create note modal
					this.promptForNoteCreation();
				}
			});
		}
	}
	
	async promptForDataSource() {
		const { contentEl } = this;
		contentEl.empty();
		
		contentEl.createEl('h2', { text: 'Data Source' });
		contentEl.createEl('p', { text: 'How would you like to create your note?' });
		
		const buttonContainer = contentEl.createDiv({ cls: 'button-container' });
		
		const manualButton = buttonContainer.createEl('button', { text: 'Enter Data Manually' });
		manualButton.addEventListener('click', async () => {
			// For manual entry, open unified create note modal
			this.promptForNoteCreation();
		});
		
		// Check if Zotero Desktop Connector plugin is available
		const zoteroPlugin = (this.app as any).plugins.getPlugin('obsidian-zotero-desktop-connector');
		
		const zoteroButton = buttonContainer.createEl('button', { text: 'Import from Zotero' });
		if (!zoteroPlugin) {
			zoteroButton.disabled = true;
			zoteroButton.title = 'Zotero Desktop Connector plugin is not installed or enabled';
		}
		
		zoteroButton.addEventListener('click', async () => {
			if (!zoteroPlugin) {
				new Notice('Zotero Desktop Connector plugin is not installed or enabled');
				return;
			}
			
			try {
				// Inform the user about the Zotero naming behavior
				new Notice('Note: Zotero will use the citation key as the note name instead of the one you entered', 5000);
				
				// Close this modal first
				this.close();
				
				// Get the template name without the file extension
				const templateName = this.selectedTemplate ? this.selectedTemplate.basename : "";
				
				// Find the Zotero command that matches the template name
				const commands = (this.app as any).commands.commands;
				const commandId = Object.keys(commands).find(id => {
					// Check if this is a Zotero integration command
					if (!id.includes('obsidian-zotero-desktop-connector')) return false;
					
					// Get the command name
					const commandName = commands[id].name;
					
					// Check if the command name includes the template name or vice versa
					// This allows for flexibility in matching
					return (
						// Direct match with "Zotero Integration: [template name]"
						commandName === `Zotero Integration: ${templateName}` ||
						// The command name contains the template name
						commandName.includes(templateName) ||
						// The template name contains the command name (excluding "Zotero Integration: ")
						templateName.includes(commandName.replace("Zotero Integration: ", ""))
					);
				});
				
				if (commandId) {
					// Execute the Zotero command
					await (this.app as any).commands.executeCommandById(commandId);
				} else {
					// Fallback to a generic Zotero command if the specific one isn't found
					new Notice(`No matching Zotero command found for template "${templateName}". Please check your Zotero integration settings.`);
					return;
				}
			} catch (error) {
				console.error('Error executing Zotero command:', error);
				new Notice(`Error: ${error.message}`);
			}
		});
		
		// Add a back button
		const backButton = buttonContainer.createEl('button', { text: 'Back' });
		backButton.addEventListener('click', () => {
			this.promptForNoteCreation();
		});
	}
	
	async handleInsertToTemplate(template: TFile, templateContent: string) {
		const { contentEl } = this;
		contentEl.empty();
		
		// Parse the template name to determine the target file path
		// Format: Insert-to-X-Folder1-Folder2-...-FileName
		const templateName = template.basename;
		const pathParts = templateName.replace('Insert-to-', '').split('-');
		
		if (pathParts.length < 2) {
			new Notice('Invalid Insert-to template format');
			this.close();
			return;
		}
		
		// Determine the target file path
		let targetPath = '';
		
		// First part is always the letter folder (e.g., 'A')
		targetPath = pathParts[0];
		
		// Process remaining parts to build the path
		for (let i = 1; i < pathParts.length; i++) {
			targetPath += '/' + pathParts[i];
		}
		
		// Add .md extension if not present
		if (!targetPath.endsWith('.md')) {
			targetPath += '.md';
		}
		
		// Normalize the path to handle any issues
		targetPath = normalizePath(targetPath);
		
		// Check if the target file exists
		const targetFile = this.app.vault.getAbstractFileByPath(targetPath);
		if (!targetFile || !(targetFile instanceof TFile)) {
			new Notice(`Target file not found: ${targetPath}`);
			this.close();
			return;
		}
		
		// Parse the template content to determine insertion behavior
		const lines = templateContent.split('\n');
		let insertionMode = '';
		let insertAfterLine = '';
		
		// Look for the first header
		for (let i = 0; i < lines.length; i++) {
			const line = lines[i].trim();
			if (line.startsWith('# ')) {
				insertionMode = line.substring(2).trim();
				
				// If insertion mode is "Insert after", get the next line
				if (insertionMode === 'Insert after' && i + 1 < lines.length) {
					insertAfterLine = lines[i + 1].trim();
				}
				
				break;
			}
		}
		
		// Prompt the user for the text to insert
		contentEl.createEl('h2', { text: 'Enter Text to Insert' });
		
		const targetFileInfo = contentEl.createEl('p', { 
			text: `Target file: ${targetPath}` 
		});
		
		const insertionModeInfo = contentEl.createEl('p', { 
			text: `Insertion mode: ${insertionMode}` 
		});
		
		// Add styles for better text area appearance
		contentEl.createEl('style', {
			text: `
				.text-area-container {
					margin-top: 20px;
					margin-bottom: 20px;
					width: 100%;
				}
				.text-area-container textarea {
					width: 100%;
					min-height: 200px;
					padding: 10px;
					font-family: inherit;
					border-radius: 5px;
					resize: vertical;
				}
			`
		});
		
		const textAreaContainer = contentEl.createDiv({ cls: 'text-area-container' });
		const textArea = textAreaContainer.createEl('textarea', {
			attr: {
				rows: '15',
				placeholder: 'Enter text to insert',
				style: 'width: 100%; min-height: 200px;'
			}
		});
		
		// Set focus to the text area
		setTimeout(() => {
			textArea.focus();
		}, 50);
		
		const buttonContainer = contentEl.createDiv({ cls: 'button-container' });
		
		const cancelButton = buttonContainer.createEl('button', { text: 'Cancel' });
		cancelButton.addEventListener('click', () => {
			this.close();
		});
		
		const insertButton = buttonContainer.createEl('button', { text: 'Insert' });
		insertButton.addEventListener('click', async () => {
			const textToInsert = textArea.value.trim();
			
			if (!textToInsert) {
				new Notice('Please enter text to insert');
				return;
			}
			
			try {
				// Read the target file content
				const targetContent = await this.app.vault.read(targetFile as TFile);
				let newContent = '';
				
				if (insertionMode === 'Write to bottom file') {
					// Append to the bottom of the file
					newContent = targetContent + '\n\n' + textToInsert;
				} else if (insertionMode === 'Insert after' && insertAfterLine) {
					// Insert after the specified line
					const targetLines = targetContent.split('\n');
					let insertionIndex = -1;
					
					for (let i = 0; i < targetLines.length; i++) {
						if (targetLines[i].trim() === insertAfterLine) {
							insertionIndex = i;
							break;
						}
					}
					
					if (insertionIndex >= 0) {
						targetLines.splice(insertionIndex + 1, 0, textToInsert);
						newContent = targetLines.join('\n');
					} else {
						// Line not found, append to the end
						new Notice(`Line "${insertAfterLine}" not found, appending to the end`);
						newContent = targetContent + '\n\n' + textToInsert;
					}
				} else {
					// Default: append to the end
					newContent = targetContent + '\n\n' + textToInsert;
				}
				
				// Write the updated content back to the file
				await this.app.vault.modify(targetFile as TFile, newContent);
				
				new Notice(`Text inserted into ${targetPath}`);
				this.close();
			} catch (error) {
				console.error('Error inserting text:', error);
				new Notice(`Error inserting text: ${error.message}`);
			}
		});
	}
	
	async handleInvokeTemplate(template: TFile, templateContent: string) {
		try {
			// Extract JavaScript code from the template content
			const jsCode = this.extractJavaScriptCode(templateContent);
			
			if (!jsCode) {
				new Notice('No JavaScript code found in the template');
				this.close();
				return;
			}
			
			// Create a function context with useful variables
			const app = this.app;
			const plugin = this.plugin;
			const vault = this.app.vault;
			const workspace = this.app.workspace;
			const fileManager = this.app.fileManager;
			const metadataCache = this.app.metadataCache;
			
			// Create a mock tp object similar to Templater for compatibility
			const tp = {
				file: {
					path: template.path,
					basename: template.basename,
					extension: template.extension,
					folder: path.dirname(template.path)
				},
				system: {
					suggester: async (displayTexts: string[], values: any[], throwOnCancel: boolean = false, placeholder: string = "") => {
						return new Promise((resolve) => {
							const modal = new SuggesterModal(this.app, displayTexts, values, placeholder, resolve);
							modal.open();
						});
					},
					prompt: async (promptText: string, defaultValue: string = "", throwOnCancel: boolean = false, placeholder: string = "") => {
						return new Promise((resolve) => {
							const modal = new PromptModal(this.app, promptText, defaultValue, placeholder, resolve);
							modal.open();
						});
					}
				}
			};
			
			// Create a function from the code
			const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
			const fn = new AsyncFunction('app', 'plugin', 'vault', 'workspace', 'fileManager', 'metadataCache', 'tp', jsCode);
			
			// Execute the function
			const result = await fn(app, plugin, vault, workspace, fileManager, metadataCache, tp);
			
			// If the function returns a string, show it as a notice
			if (typeof result === 'string' && result.trim() !== '') {
				new Notice(result);
			}
			
			this.close();
		} catch (error) {
			console.error('Error executing JavaScript code:', error);
			new Notice(`Error executing JavaScript code: ${error.message}`);
			this.close();
		}
	}
	
	extractJavaScriptCode(templateContent: string): string {
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
	
	promptForNoteName() {
		// Deprecated: redirect to unified modal
		this.promptForNoteCreation();
	}
	
	showNoteNamePrompt() {
		// Deprecated: redirect to unified modal
		this.promptForNoteCreation();
	}
	
	// New unified note creation modal combining name, date prepend, and placeholders
	promptForNoteCreation() {
		if (!this.selectedTemplate) return;
		const { contentEl } = this;
		contentEl.empty();
		
		contentEl.createEl('h2', { text: 'Create Note' });
		
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
		
		(async () => {
			try {
				const templateContent = await this.app.vault.read(this.selectedTemplate as TFile);
				const tokenRegex = /\{\{([^}]+)\}\}/g;
				const fullTokens: string[] = [];
				let m: RegExpExecArray | null;
				while ((m = tokenRegex.exec(templateContent)) !== null) {
					fullTokens.push(m[0]);
				}
				const uniquePlaceholders = [...new Set(fullTokens)];
				
				if (uniquePlaceholders.length > 0) {
					placeholderSection.createEl('h3', { text: 'Template Fields' });
					// Reorder: tags first, then Quote (EN/AR), then Author (EN/AR), then The Permanent Note, then the rest
					const tagsTokens: string[] = [];
					const quoteEnTokens: string[] = [];
					const quoteArTokens: string[] = [];
					const authorEnTokens: string[] = [];
					const authorArTokens: string[] = [];
					const permanentNoteTokens: string[] = [];
					const otherTokens: string[] = [];
					for (const tok of uniquePlaceholders) {
						const inner = tok.slice(2, -2).trim();
						const displayName = inner.replace(/^VALUE\s*[:|-]?\s*/i, '');
						const lc = displayName.toLowerCase();
						if (lc === 'tags') {
							tagsTokens.push(tok);
						} else if (lc === 'quote') {
							quoteEnTokens.push(tok);
						} else if (displayName === 'الاقتباس') {
							quoteArTokens.push(tok);
						} else if (lc === 'author') {
							authorEnTokens.push(tok);
						} else if (displayName === 'القائل') {
							authorArTokens.push(tok);
						} else if (lc.includes('permanent note')) {
							permanentNoteTokens.push(tok);
						} else {
							otherTokens.push(tok);
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
						const inner = fullToken.slice(2, -2); // remove {{ }}
						const name = inner.trim();
						// Strip leading 'VALUE:' (case-insensitive) only for display purposes
						const displayName = name.replace(/^VALUE\s*[:|-]?\s*/i, '');
						const displayNameLC = displayName.toLowerCase();
						const row = placeholderSection.createDiv({ cls: 'placeholder-input-container' });
						row.createEl('label', { text: displayName });
						
						// Special handling and hints based on displayName
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
									const rm = chip.createSpan({ cls: 'chip-remove', text: '×' });
									rm.addEventListener('click', () => {
										const idx = selectedTags.indexOf(tag);
										if (idx >= 0) selectedTags.splice(idx, 1);
										renderChips();
										updateDropdown();
									});
								});
							};
							
							const addTag = (tag: string) => {
								const t = tag.trim();
								if (!t) return;
								if (!selectedTags.includes(t)) {
									selectedTags.push(t);
									renderChips();
								}
								input.value = '';
								updateDropdown();
								dropdown.removeClass('show');
							};
							
							const updateDropdown = () => {
								dropdown.empty();
								const q = input.value.trim().toLowerCase();
								const suggestions = allTags.filter(t => !selectedTags.includes(t) && (q === '' || t.toLowerCase().includes(q))).slice(0, 50);
								if (suggestions.length === 0) {
									dropdown.removeClass('show');
									return;
								}
								suggestions.forEach(tag => {
									const li = dropdown.createEl('li', { text: tag });
									// Use mousedown so it fires before focusout hides the list
									li.addEventListener('mousedown', (ev) => {
									ev.preventDefault(); // prevent losing focus before we add
									addTag(tag);
									input.focus();       // keep typing smoothly
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
									// quick remove last chip
									selectedTags.pop();
									renderChips();
									updateDropdown();
								}
							});

							// Hide on Escape
							input.addEventListener('keydown', (e: KeyboardEvent) => {
								if (e.key === 'Escape') {
								dropdown.removeClass('show');
								}
							});
							
							// Hide when clicking anywhere outside the tags row
							const onDocMouseDown = (e: MouseEvent) => {
								const target = e.target as HTMLElement | null;
								if (target && !row.contains(target)) {
								dropdown.removeClass('show');
								}
							};
							document.addEventListener('mousedown', onDocMouseDown);
							
							// Clean up when modal closes (optional if you already have onClose logic)
							this.onClose = ((orig => () => {
								document.removeEventListener('mousedown', onDocMouseDown);
								orig?.call(this);
							}))(this.onClose?.bind(this) as any);

							// Hide dropdown when focus leaves the tags area
							const scopeEl = row;
							scopeEl.addEventListener('focusout', () => {
								setTimeout(() => {
									const active = document.activeElement as HTMLElement | null;
									if (!active || !scopeEl.contains(active)) {
										dropdown.removeClass('show');
									}
								}, 0);
							});

							// Provide YAML array lines for template replacement.
							// It will respect the current line's prefix (indent and dash) before the token.
							customResolvers[fullToken] = () => {
								if (selectedTags.length === 0) return '';
								// Find the first occurrence of the token in the template to detect line prefix
								const idx = templateContent.indexOf(fullToken);
								if (idx === -1) {
									// Fallback: first item as-is, subsequent with "\n- "
									return selectedTags[0] + selectedTags.slice(1).map(t => `\n- ${t}`).join('');
								}
								const lineStart = templateContent.lastIndexOf('\n', idx - 1) + 1;
								const prefix = templateContent.slice(lineStart, idx); // includes indentation and "- " before token
								// Compose: first item uses the existing "- " in template line; subsequent items prepend the same prefix
								return selectedTags[0] + selectedTags.slice(1).map(t => `\n${prefix}${t}`).join('');
							};

							// Keep a hidden input for consistent structure (not used directly for value)
							inputFields[fullToken] = input;
						} else if (displayNameLC === 'quote' || displayName === 'الاقتباس') {
							// Render quote as textarea (EN and AR) and positioned under tags via ordering
							const ta = row.createEl('textarea', {
								attr: {
									rows: '8',
									placeholder: displayName === 'الاقتباس' ? 'اكتب الاقتباس هنا' : 'Write the quote here'
								}
							});
							inputFields[fullToken] = ta as HTMLTextAreaElement;
						} else if (displayNameLC === 'author' || displayName === 'القائل') {
							// Render author as text input (EN and AR) and positioned after quote via ordering
							const input = row.createEl('input', {
								type: 'text',
								placeholder: displayName === 'القائل' ? 'اكتب اسم المؤلف هنا' : 'Write the author here'
							});
							inputFields[fullToken] = input;
						} else if (/\bimportance\b/i.test(displayName)) {
							// Text input with suggestions via datalist
							const input = row.createEl('input', {
								type: 'number',
								placeholder: 'Importance from 1 to 5 (5 is most important)'
							});
							(input as any).setAttr?.('min', '1');
							(input as any).setAttr?.('max', '5');
							(input as any).setAttr?.('step', '1');
							inputFields[fullToken] = input;

						} else if (/\bcomplexity\b/i.test(displayName)) {
							// Text input with suggestions via datalist
							const input = row.createEl('input', {
								type: 'number',
								placeholder: 'Complexity from 1 to 5'
							});
							(input as any).setAttr?.('min', '1');
							(input as any).setAttr?.('max', '5');
							(input as any).setAttr?.('step', '1');
							inputFields[fullToken] = input;

						} else if (/when[-\s]*to[-\s]*use/i.test(displayNameLC)) {
							// Text input with suggestions via datalist
							const listId = `when-to-use-list-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
							const input = row.createEl('input', {
								type: 'text',
								placeholder: 'now, today, within a week, within a month, within a year'
							});
							input.setAttr('list', listId);
							const dataList = row.createEl('datalist', { attr: { id: listId } });
							['now','today','within a week','within a month','within a year'].forEach(opt => {
								dataList.createEl('option', { attr: { value: opt } });
							});
							inputFields[fullToken] = input;
						} else if (displayNameLC.includes('permanent note')) {
							// Render main note as a textarea and moved up under tags via ordering
							const ta = row.createEl('textarea', {
								attr: {
									rows: '10',
									placeholder: 'Write your note here'
								}
							});
							inputFields[fullToken] = ta as HTMLTextAreaElement;
						} else if (/\bverified\b/i.test(displayName)) {
							// Yes/No radio group
							const group = row.createDiv({ cls: 'radio-group' });
							const groupName = `verified-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;

							const yesWrap = group.createDiv({ cls: 'radio-option' });
							const yesInput = yesWrap.createEl('input', { type: 'radio' });
							yesInput.setAttr('name', groupName);
							yesInput.setAttr('value', 'Yes');
							yesWrap.createEl('label', { text: 'Yes' });

							const noWrap = group.createDiv({ cls: 'radio-option' });
							const noInput = noWrap.createEl('input', { type: 'radio' });
							noInput.setAttr('name', groupName);
							noInput.setAttr('value', 'No');
							noWrap.createEl('label', { text: 'No' });

							radioGroups[fullToken] = [yesInput, noInput];
						} else {
							const input = row.createEl('input', {
								type: 'text',
								placeholder: `Enter value for ${displayName}`
							});
							inputFields[fullToken] = input;
						}
					}
				}
				
				// Buttons
				const buttonContainer = contentEl.createDiv({ cls: 'button-container' });
				const cancelButton = buttonContainer.createEl('button', { text: 'Cancel' });
				cancelButton.addEventListener('click', () => this.close());
				
				const createButton = buttonContainer.createEl('button', { text: 'Create Note' });
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
						new Notice('Please enter a note name');
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
						// Use stripped name for validation only
						const tokenNameLC = fullToken
							.slice(2, -2)
							.replace(/^VALUE\s*[:|-]?\s*/i, '')
							.toLowerCase();
						if (value !== '') {
							if (/\bimportance\b/.test(tokenNameLC)) {
								const n = Number(value);
								if (!Number.isInteger(n) || n < 1 || n > 5) {
									new Notice('Importance must be an integer between 1 and 5');
									return;
								}
							}
							if (/\bcomplexity\b/.test(tokenNameLC)) {
								const n = Number(value);
								if (!Number.isInteger(n) || n < 1 || n > 5) {
									new Notice('Complexity must be an integer between 1 and 5');
									return;
								}
							}
						}
						placeholderValues[fullToken] = value;
					}
					await this.createNoteFromTemplate(noteName, templateContent, placeholderValues);
				});
			} catch (error) {
				console.error('Error preparing unified note creation modal:', error);
				new Notice(`Error: ${error.message}`);
			}
		})();
	}
	
	async createNoteFromTemplate(noteName: string, templateContent: string, placeholderValues: Record<string, string>) {
		if (!this.selectedTemplate) return;
		
		// Replace placeholders with values
		let finalContent = templateContent;
		for (const [placeholder, value] of Object.entries(placeholderValues)) {
			finalContent = finalContent.replace(new RegExp(placeholder, 'g'), value);
		}
		
		// Determine the save path based on the template name
		const templateName = this.selectedTemplate.basename;
		let savePath = '';
		
		// Parse the template name to create the folder structure
		// Format: X-Folder1-Folder2-...-FileName
		const pathParts = templateName.split('-');
		
		if (pathParts.length >= 2) {
			// Create proper folder structure
			// For example: A-Inbox-Ideas should become A/Inbox/Ideas
			// For example: A-Permanent Notes should become A/Permanent Notes
			
			// Convert template name parts to folder path
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
			await this.ensureFolderExists(folderPath);
			
			// Create the note
			await this.app.vault.create(savePath, finalContent);
			
			new Notice(`Note created: ${savePath}`);
			this.close();
		} catch (error) {
			console.error('Error creating note:', error);
			new Notice(`Error creating note: ${error.message}`);
		}
	}
	
	async ensureFolderExists(folderPath: string) {
		const folders = folderPath.split('/');
		let currentPath = '';
		
		for (const folder of folders) {
			if (!folder) continue;
			
			currentPath += folder;
			
			if (!(await this.app.vault.adapter.exists(currentPath))) {
				await this.app.vault.createFolder(currentPath);
			}
			
			currentPath += '/';
		}
	}
	/*
	showNoteNamePrompt() {
		// Deprecated: redirect to unified modal
		this.promptForNoteCreation();
	}
	*/
	
	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

class SuggesterModal extends Modal {
	private resolve: (value: any) => void;
	private displayTexts: string[];
	private values: any[];
	private placeholder: string;
	
	constructor(app: App, displayTexts: string[], values: any[], placeholder: string, resolve: (value: any) => void) {
		super(app);
		this.displayTexts = displayTexts;
		this.values = values;
		this.placeholder = placeholder;
		this.resolve = resolve;
	}
	
	onOpen() {
		const { contentEl } = this;
		
		contentEl.createEl('h2', { text: this.placeholder || 'Select an option' });
		
		const listContainer = contentEl.createDiv({ cls: 'suggester-list-container' });
		const list = listContainer.createEl('ul', { cls: 'suggester-list' });
		
		for (let i = 0; i < this.displayTexts.length; i++) {
			const item = list.createEl('li');
			const button = item.createEl('button', { text: this.displayTexts[i] });
			
			button.addEventListener('click', () => {
				this.resolve(this.values[i]);
				this.close();
			});
		}
		
		const cancelButton = contentEl.createEl('button', { text: 'Cancel' });
		cancelButton.addEventListener('click', () => {
			this.resolve(null);
			this.close();
		});
	}
	
	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

class PromptModal extends Modal {
	private resolve: (value: string | null) => void;
	private promptText: string;
	private defaultValue: string;
	private placeholder: string;
	
	constructor(app: App, promptText: string, defaultValue: string, placeholder: string, resolve: (value: string | null) => void) {
		super(app);
		this.promptText = promptText;
		this.defaultValue = defaultValue;
		this.placeholder = placeholder;
		this.resolve = resolve;
	}
	
	onOpen() {
		const { contentEl } = this;
		
		contentEl.createEl('h2', { text: 'Prompt' });
		contentEl.createEl('p', { text: this.promptText });
		
		// Add styles for better text area appearance
		contentEl.createEl('style', {
			text: `
				.prompt-textarea-container {
					margin-top: 20px;
					margin-bottom: 20px;
					width: 100%;
				}
				.prompt-textarea-container textarea {
					width: 100%;
					min-height: 150px;
					padding: 10px;
					font-family: inherit;
					border-radius: 5px;
					resize: vertical;
				}
			`
		});
		
		const textAreaContainer = contentEl.createDiv({ cls: 'prompt-textarea-container' });
		const textArea = textAreaContainer.createEl('textarea', {
			attr: {
				rows: '10',
				placeholder: this.placeholder || 'Enter your response',
			}
		});
		textArea.value = this.defaultValue || '';
		
		// Set focus to the text area
		setTimeout(() => {
			textArea.focus();
		}, 50);
		
		const buttonContainer = contentEl.createDiv({ cls: 'button-container' });
		
		const cancelButton = buttonContainer.createEl('button', { text: 'Cancel' });
		cancelButton.addEventListener('click', () => {
			this.resolve(null);
			this.close();
		});
		
		const submitButton = buttonContainer.createEl('button', { text: 'Submit' });
		submitButton.addEventListener('click', () => {
			this.resolve(textArea.value);
			this.close();
		});
	}
	
	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

class ABCsSettingTab extends PluginSettingTab {
	plugin: ABCsOfControlPlugin;
	
	constructor(app: App, plugin: ABCsOfControlPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}
	
	display(): void {
		const { containerEl } = this;
		
		containerEl.empty();
		
		containerEl.createEl('h2', { text: 'ABCs of Control Settings' });
		
		new Setting(containerEl)
			.setName('Template Folder Path')
			.setDesc('Path to the folder containing your templates')
			.addText(text => text
				.setPlaceholder('C/Templates')
				.setValue(this.plugin.settings.templateFolderPath)
				.onChange(async (value) => {
					this.plugin.settings.templateFolderPath = value;
					await this.plugin.saveSettings();
				}));
				
		new Setting(containerEl)
			.setName('Default Highlight Color')
			.setDesc('Default Color for text highlighting')
			.addDropdown(dropdown => dropdown
				.addOption('yellow', 'Yellow')
				.addOption('green', 'Green')
				.addOption('red', 'Red')
				.addOption('blue', 'Blue')
				.addOption('gray', 'Gray')
				.setValue(this.plugin.settings.defaultHighlightColor)
				.onChange(async (value) => {
					this.plugin.settings.defaultHighlightColor = value;
					await this.plugin.saveSettings();
				}));
				
		new Setting(containerEl)
			.setName('Default Language')
			.setDesc('Default language for section headers')
			.addDropdown(dropdown => dropdown
				.addOption('english', 'English')
				.addOption('arabic', 'Arabic')
				.setValue(this.plugin.settings.language || 'english')
				.onChange(async (value) => {
					this.plugin.settings.language = value;
					await this.plugin.saveSettings();
				}));
	}
}

// Add ColorPickerModal class
class ColorPickerModal extends Modal {
	private colors: string[];
	private defaultColor: string;
	private resolve: (value: string | null) => void;

	constructor(app: App, colors: string[], defaultColor: string, resolve: (value: string | null) => void) {
		super(app);
		this.colors = colors;
		this.defaultColor = defaultColor;
		this.resolve = resolve;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('color-picker-modal');
		
		contentEl.createEl('h2', { text: 'Select Highlight Color' });

		const colorContainer = contentEl.createDiv({ cls: 'color-container' });

		// Create color swatches
		this.colors.forEach(color => {
			const swatch = colorContainer.createDiv({ cls: 'color-swatch' });
			swatch.style.backgroundColor = color;
			
			if (color === this.defaultColor) {
				swatch.addClass('selected');
			}

			swatch.addEventListener('click', () => {
				this.resolve(color);
				this.close();
			});
		});

		// Add cancel button
		const buttonContainer = contentEl.createDiv({ cls: 'button-container' });
		const cancelButton = buttonContainer.createEl('button', { text: 'Cancel' });
		cancelButton.addEventListener('click', () => {
			this.resolve(null);
			this.close();
		});
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
