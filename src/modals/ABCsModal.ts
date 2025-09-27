import { App, Modal, TFile, Notice, normalizePath } from 'obsidian';
import * as path from 'path';
import { MyPluginSettings, HeadingMeta, Selection } from '../types';
import { WHEN_TO_USE_OPTIONS } from '../constants';
import { getTemplateFiles, ensureFolderExists, parseSection, compareSection, detectArabicContent, extractJavaScriptCode } from '../utils';
import { SuggesterModal } from './SuggesterModal';
import { PromptModal } from './PromptModal';
import { ContentToDProjectsHandler } from '../handlers/contentToDProjectsHandler';
import { NoteCreationHandler } from '../handlers/noteCreationHandler';
import { TipsToEExamsHandler } from '../handlers/tipsToEExamsHandler';
import { ArchiveHandler } from '../handlers/archiveHandler';
export class ABCsModal extends Modal {
	plugin: any; // Will be properly typed when we refactor the main plugin
	templateMap: Map<string, TFile[]> = new Map();
	selectedTemplate: TFile | null = null;
	private contentToDProjectsHandler: ContentToDProjectsHandler;
    private tipsToEExamsHandler: TipsToEExamsHandler;
    private archiveHandler: ArchiveHandler;
	private noteCreationHandler: NoteCreationHandler;
	
	constructor(app: App, plugin: any) {
		super(app);
		this.plugin = plugin;
		this.contentToDProjectsHandler = new ContentToDProjectsHandler(app);
        this.tipsToEExamsHandler = new TipsToEExamsHandler(app);
        this.archiveHandler = new ArchiveHandler(app);
		this.noteCreationHandler = new NoteCreationHandler(app);
	}
	
	async onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('abcs-of-control-modal');
        
        // Add title
        contentEl.createEl('h2', { text: 'ABCs of Control' });
        
        // Load template files
        this.templateMap = await getTemplateFiles(this.app, this.plugin.settings.templateFolderPath);
        
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
        // Add Archive Now button for E letter
            if (letter === 'E') {
                const archiveItem = templateList.createEl('li');
                const archiveButton = archiveItem.createEl('button', { 
                    text: '📦 Archive Now',
                    cls: 'archive-now-button'
                });
                
                archiveButton.addEventListener('click', async () => {
                    await this.archiveHandler.archiveTaggedNotes();
                });
            }
        for (const template of templates) {
            const listItem = templateList.createEl('li');
            const templateButton = listItem.createEl('button', { text: template.basename });
            
            templateButton.addEventListener('click', async () => {
                this.selectedTemplate = template;
                
                // Handle special C-template that should act under D
                if (template.basename.startsWith('Content-to-D-Projects-')) {
                    await this.handleContentToDProjects(template);
                    return;
                }
                // Handle special Tips-to-E-Exams templates
                if (template.basename.startsWith('Tips-to-E-Exams-')) {
                    await this.handleTipsToEExams(template);
                    return;
                }
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
                    this.promptForNoteCreation();
                } else {
                    // Regular template - unified create note modal
                    this.promptForNoteCreation();
                }
            });
        }
    }

	promptForNoteCreation() {
        if (!this.selectedTemplate) return;
        
        this.noteCreationHandler.promptForNoteCreation(
            this.selectedTemplate,
            this.contentEl,
            () => this.close()
        );
    }
	
	async handleContentToDProjects(template: TFile) {
        // Collect all Content-to-D-Projects templates
        const allTemplates = this.app.vault.getMarkdownFiles();
        const projectTemplates = allTemplates.filter(file => 
            file.basename.startsWith('Content-to-D-Projects-')
        );
        
        await this.contentToDProjectsHandler.handleContentToDProjects(
            projectTemplates, 
            template, // Pass the initially selected template
            this.contentEl, 
            () => this.close()
        );
    }
    async handleTipsToEExams(template: TFile) {
        // Collect all Tips-to-E-Exams templates
        const allTemplates = this.app.vault.getMarkdownFiles();
        const examTemplates = allTemplates.filter(file => 
            file.basename.startsWith('Tips-to-E-Exams-')
        );
        
        await this.tipsToEExamsHandler.handleTipsToEExams(
            examTemplates, 
            template, // Pass the initially selected template
            this.contentEl, 
            () => this.close()
        );
    }
    /**
 * Handle Insert-to template processing
 */
async handleInsertToTemplate(template: TFile, templateContent: string) {
    const { contentEl } = this;
    contentEl.empty();
    
    // Parse the template name to determine the target file path
    const templateName = template.basename;
    const pathParts = templateName.replace('Insert-to-', '').split('-');
    
    if (pathParts.length < 2) {
        new Notice('Invalid Insert-to template format');
        this.close();
        return;
    }
    
    // Determine the target file path
    let targetPath = pathParts.join('/');
    if (!targetPath.endsWith('.md')) {
        targetPath += '.md';
    }
    
    targetPath = normalizePath(targetPath);
    
    // Check if the target file exists
    const targetFile = this.app.vault.getAbstractFileByPath(targetPath);
    if (!targetFile || !(targetFile instanceof TFile)) {
        new Notice(`Target file not found: ${targetPath}`);
        this.close();
        return;
    }
    
    // Simple text insertion interface
    contentEl.createEl('h2', { text: 'Enter Text to Insert' });
    contentEl.createEl('p', { text: `Target file: ${targetPath}` });
    
    const textArea = contentEl.createEl('textarea', {
        attr: { rows: '10', placeholder: 'Enter text to insert', style: 'width: 100%; margin: 20px 0;' }
    });
    
    const buttonContainer = contentEl.createDiv({ cls: 'button-container' });
    const cancelButton = buttonContainer.createEl('button', { text: 'Cancel' });
    cancelButton.addEventListener('click', () => this.close());
    
    const insertButton = buttonContainer.createEl('button', { text: 'Insert' });
    insertButton.addEventListener('click', async () => {
        const textToInsert = textArea.value.trim();
        if (!textToInsert) {
            new Notice('Please enter text to insert');
            return;
        }
        
        try {
            const targetContent = await this.app.vault.read(targetFile as TFile);
            const newContent = targetContent + '\n\n' + textToInsert;
            await this.app.vault.modify(targetFile as TFile, newContent);
            new Notice(`Text inserted into ${targetPath}`);
            this.close();
        } catch (error) {
            new Notice(`Error inserting text: ${(error as Error).message}`);
        }
    });
}

/**
 * Handle Invoke template processing
 */
async handleInvokeTemplate(template: TFile, templateContent: string) {
    try {
        // Extract JavaScript code from the template content
        const jsCode = extractJavaScriptCode(templateContent);
        
        if (!jsCode) {
            new Notice('No JavaScript code found in the template');
            this.close();
            return;
        }
        
        // Create a function context with useful variables
        const app = this.app;
        const plugin = this.plugin;
        
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
        const fn = new AsyncFunction('app', 'plugin', 'tp', jsCode);
        
        // Execute the function
        const result = await fn(app, plugin, tp);
        
        // If the function returns a string, show it as a notice
        if (typeof result === 'string' && result.trim() !== '') {
            new Notice(result);
        }
        
        this.close();
    } catch (error) {
        console.error('Error executing JavaScript code:', error);
        new Notice(`Error executing JavaScript code: ${(error as Error).message}`);
        this.close();
    }
}
}
