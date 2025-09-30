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
	private resizeHandler?: () => void;

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
        // Draw arrows and keep them synced on resize
        this.drawArrows(abcContainer, { A: letterA, B: letterB, C: letterC, D: letterD, E: letterE });
        this.resizeHandler = () => this.drawArrows(abcContainer, { A: letterA, B: letterB, C: letterC, D: letterD, E: letterE });
        window.addEventListener('resize', this.resizeHandler);
        // Add container for template list
        contentEl.createDiv({ cls: 'template-list-container' });
    }
    onClose() {
        if (this.resizeHandler) {
          window.removeEventListener('resize', this.resizeHandler);
          this.resizeHandler = undefined;
        }
      }

    createLetterCell(letter: string, position: string, container: HTMLElement): HTMLElement {
        const letterCell = container.createDiv({ cls: `letter-cell ${position}` });
        
        // Create the letter bubble
        const letterBubble = letterCell.createDiv({ cls: 'letter-bubble' });
        letterBubble.createDiv({ cls: 'letter', text: letter });
        
        // Check if templates exist for this letter
        const hasTemplates = (this.templateMap.get(letter) ?? []).length > 0;
        
        // Make E clickable even if it has no templates (to show Archive actions)
        // Others remain clickable only if templates exist
        if (hasTemplates || letter === 'E') {
            letterBubble.addClass('has-templates');
            letterBubble.addEventListener('click', () => {
                this.showTemplatesForLetter(letter);
            });
        }
        
        return letterCell;
    }
    // Resolve active Phase 0 pipeline by matching templatePrefix against a clicked template's basename
    private resolvePipelineIdForTemplate(template: TFile): string | null {
        const p = (this.app as any).plugins?.plugins?.['ABCs-of-control'];
        const s = p?.settings?.abcsPhase0;
        if (!s) return null;
        const prof = s.profiles.find((x: any) => x.id === s.activeProfile) || s.profiles[0];
        const basename = template.basename;
    
        for (const pipe of prof.pipelines || []) {
        if (pipe?.templatePrefix && basename.startsWith(pipe.templatePrefix)) {
            return pipe.id;
        }
        }
        return null;
    }
    private getActivePipelineById(pipelineId: string): any | null {
        const p = (this.app as any).plugins?.plugins?.['ABCs-of-control'];
        const s = p?.settings?.abcsPhase0;
        if (!s) return null;
        const prof = s.profiles.find((x: any) => x.id === s.activeProfile) || s.profiles[0];
        return (prof?.pipelines || []).find((x: any) => x.id === pipelineId) || null;
      }
    // Convenience: get a pipeline config by id (useful if you later want more than id)
    private getPipelineById(pipelineId: string): any | null {
        const p = (this.app as any).plugins?.plugins?.['ABCs-of-control'];
        const s = p?.settings?.abcsPhase0;
        if (!s) return null;
        const prof = s.profiles.find((x: any) => x.id === s.activeProfile) || s.profiles[0];
        return (prof?.pipelines || []).find((x: any) => x.id === pipelineId) || null;
    }
    async showTemplatesForLetter(letter: string) {
        const { contentEl } = this;
        const templateListContainer = contentEl.querySelector('.template-list-container');
        if (!templateListContainer) return;
        
        templateListContainer.empty();
        
        const templates = this.templateMap.get(letter) || [];

        const templateList = templateListContainer.createEl('ul', { cls: 'template-list' });

        // E actions should appear regardless of templates
        if (letter === 'E') {
            const archiveItem = templateList.createEl('li');
            const archiveButton = archiveItem.createEl('button', { 
                text: '📦 Archive #archived Notes',
                cls: 'archive-now-button'
            });
            archiveButton.addEventListener('click', async () => {
                await this.archiveHandler.archiveTaggedNotes();
            });

            const settingsItem = templateList.createEl('li');
            const settingsButton = settingsItem.createEl('button', { 
                text: '⚙️ Archive Settings',
                cls: 'archive-settings-button'
            });
            settingsButton.addEventListener('click', async () => {
                const { ArchiveSettingsModal } = await import('./ArchiveSettingsModal');
                const tplFolder = this.plugin.settings.templateFolderPath || 'C/Templates';
                const currentSettings = this.plugin.settings.archiveSettings || {
                enabled: false,
                archiveAfterDays: 30,
                excludeFolders: [tplFolder, 'E'] // exclude C/Templates and all of E
                };
                const modal = new ArchiveSettingsModal(
                    this.app,
                    currentSettings,
                    (newSettings) => {
                        this.plugin.settings.archiveSettings = newSettings;
                        this.plugin.saveSettings();
                    }
                );
                modal.open();
            });
        }

        // If no templates: for E, just return silently (actions above already shown). For others, show a message.
        if (templates.length === 0) {
            if (letter !== 'E') {
            const msgItem = templateList.createEl('li');
            msgItem.createEl('span', { text: `No templates found for letter ${letter}` });
            }
            return;
        }
        for (const template of templates) {
            const listItem = templateList.createEl('li');
            const templateButton = listItem.createEl('button', { text: template.basename });
            
            templateButton.addEventListener('click', async () => {
                this.selectedTemplate = template;
                
                // Handle special C-template that should act under D
                const pipelineId = this.resolvePipelineIdForTemplate(template);
                if (pipelineId === 'content-to-d-projects') {
                await this.handleContentToDProjects(template, pipelineId);
                return;
                }
                if (pipelineId === 'tips-to-d-exams') {
                await this.handleTipsToEExams(template, pipelineId);
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
	
	async handleContentToDProjects(template: TFile, pipelineId: string) {
        const allTemplates = this.app.vault.getMarkdownFiles();
        const pipe = this.getPipelineById(pipelineId);
        const prefix = pipe?.templatePrefix || 'Content-to-D-Projects-';
        const projectTemplates = allTemplates.filter(file =>
        file.basename.startsWith(prefix)
        );
      
        await this.contentToDProjectsHandler.handleContentToDProjects(
          projectTemplates,
          template,
          this.contentEl,
          () => this.close(),
          pipelineId
        );
      }
      async handleTipsToEExams(template: TFile, pipelineId: string) {
        const allTemplates = this.app.vault.getMarkdownFiles();
        const pipe = this.getPipelineById(pipelineId);
        const prefix = pipe?.templatePrefix || 'Tips-to-D-Exams-';
        const examTemplates = allTemplates.filter(file =>
        file.basename.startsWith(prefix)
        );
      
        await this.tipsToEExamsHandler.handleTipsToEExams(
          examTemplates,
          template,
          this.contentEl,
          () => this.close(),
          pipelineId
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
// Draw requested arrows using an SVG overlay
private drawArrows(abcContainer: HTMLElement, cells: Record<string, HTMLElement>) {
    const svgns = 'http://www.w3.org/2000/svg';
  
    // Remove any existing SVG overlay
    const existing = abcContainer.querySelector('.abc-svg');
    if (existing) existing.remove();
  
    const width = abcContainer.clientWidth;
    const height = abcContainer.clientHeight;
    const svg = document.createElementNS(svgns, 'svg');
    svg.setAttribute('class', 'abc-svg');
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  
        // Arrowhead marker
    const defs = document.createElementNS(svgns, 'defs');
    const marker = document.createElementNS(svgns, 'marker');
    marker.setAttribute('id', 'abc-arrowhead');
    // Make size explicit and independent of stroke width
    marker.setAttribute('markerUnits', 'userSpaceOnUse');
    marker.setAttribute('viewBox', '0 0 12 8');
    marker.setAttribute('markerWidth', '12');
    marker.setAttribute('markerHeight', '8');
    marker.setAttribute('refX', '12');  // tip of the arrow aligns with line end
    marker.setAttribute('refY', '4');
    marker.setAttribute('orient', 'auto');

    const tip = document.createElementNS(svgns, 'path');
    tip.setAttribute('d', 'M0,0 L12,4 L0,8 Z');
    tip.setAttribute('fill', '#9e9e9e');
    //tip.setAttribute('fill-opacity', '0.45'); // head a bit stronger than the line
    tip.setAttribute('stroke', 'none');

    marker.appendChild(tip);
    defs.appendChild(marker);
    svg.appendChild(defs);
  
    const containerRect = abcContainer.getBoundingClientRect();
    const centerOf = (cell: HTMLElement) => {
      const bubble = cell.querySelector('.letter-bubble') as HTMLElement | null;
      const r = (bubble ?? cell).getBoundingClientRect();
      return { x: r.left - containerRect.left + r.width / 2, y: r.top - containerRect.top + r.height / 2 };
    };
    // Draw edge-to-edge so arrowheads are not hidden under the circles
const BUBBLE_RADIUS = 40; // .letter-bubble is 80px, so radius is 40
const PADDING = 6;        // small gap from the edge for nicer look

const edgePoints = (from: {x:number;y:number}, to: {x:number;y:number}) => {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.max(Math.hypot(dx, dy), 1e-6);
  const ux = dx / len;
  const uy = dy / len;
  // start a bit outside the source bubble, end a bit before the target bubble edge
  const x1 = from.x + ux * (BUBBLE_RADIUS + PADDING);
  const y1 = from.y + uy * (BUBBLE_RADIUS + PADDING);
  const x2 = to.x - ux * (BUBBLE_RADIUS + PADDING);
  const y2 = to.y - uy * (BUBBLE_RADIUS + PADDING);
  return { x1, y1, x2, y2 };
};
    const centers: Record<string, { x: number; y: number }> = {
      A: centerOf(cells.A),
      B: centerOf(cells.B),
      C: centerOf(cells.C),
      D: centerOf(cells.D),
      E: centerOf(cells.E),
    };
  
    // Connections: C→A, C→B, B→A, C→D, C→E, D→E
    const edges: Array<[keyof typeof centers, keyof typeof centers]> = [
      ['C','A'], ['C','B'], ['B','A'], ['C','D'], ['C','E'], ['D','E']
    ];
  
    for (const [from, to] of edges) {
      const line = document.createElementNS(svgns, 'line');
      line.setAttribute('class', 'abc-arrow');
      const pts = edgePoints(centers[from], centers[to]);
      line.setAttribute('x1', String(pts.x1));
      line.setAttribute('y1', String(pts.y1));
      line.setAttribute('x2', String(pts.x2));
      line.setAttribute('y2', String(pts.y2));
      line.setAttribute('stroke', '#9e9e9e');
      line.setAttribute('stroke-width', '3');
      line.setAttribute('marker-end', 'url(#abc-arrowhead)');
      line.setAttribute('opacity', '0.25');
      svg.appendChild(line);
    }
  
    abcContainer.appendChild(svg);
  }
}
