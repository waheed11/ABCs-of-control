import { App, Editor, MarkdownView, MarkdownFileInfo, TFile, Notice } from 'obsidian';
import { HighlightData } from '../types';
import { SECTION_HEADERS, HIGHLIGHT_COLORS } from '../constants';
import { getFileFromView, detectArabicContent } from '../utils';
import { ColorPickerModal } from '../modals/ColorPickerModal';
import { PromptModal } from '../modals/PromptModal';

export class HighlightHandler {
	private app: App;
	private settings: any;
	private copiedHighlight: HighlightData | null = null;

	constructor(app: App, settings: any) {
		this.app = app;
		this.settings = settings;
	}

	/**
	 * Handle highlight action
	 */
	async handleHighlight(editor: Editor, view: MarkdownView | MarkdownFileInfo): Promise<void> {
		const selectedText = editor.getSelection();
		if (!selectedText) return;

		const file = getFileFromView(view);
		if (!file) {
			new Notice('Cannot highlight: No file is open');
			return;
		}

		// Open color picker modal
		const color = await this.openColorPicker(HIGHLIGHT_COLORS, this.settings.defaultHighlightColor);
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

	/**
	 * Handle copy highlight action
	 */
	async handleCopyHighlight(editor: Editor, view: MarkdownView | MarkdownFileInfo): Promise<void> {
		const selectedText = editor.getSelection();
		if (!selectedText) return;

		// Open color picker modal
		const color = await this.openColorPicker(HIGHLIGHT_COLORS, this.settings.defaultHighlightColor);
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

	/**
	 * Handle paste highlight action
	 */
	async handlePasteHighlight(editor: Editor, view: MarkdownView | MarkdownFileInfo): Promise<void> {
		if (!this.copiedHighlight) return;
		
		const file = getFileFromView(view);
		if (!file) {
			new Notice('Cannot paste highlight: No file is open');
			return;
		}
		
		// Use the stored highlight data, not the current selection
		await this.addHighlightToNote(file, this.copiedHighlight);
		new Notice('Stored highlight pasted');
	}

	/**
	 * Add highlight to note
	 */
	private async addHighlightToNote(file: TFile, highlightData: HighlightData): Promise<void> {
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
			const isArabic = detectArabicContent(fileContents);
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

	/**
	 * Format highlight with color and comment
	 */
	private formatHighlight(highlightData: HighlightData): string {
		let result = `<mark style="background: ${highlightData.color}">${highlightData.text}</mark>`;
		
		if (highlightData.comment) {
			result += `\n\n**Comment:** ${highlightData.comment}`;
		}
		
		return result;
	}

	/**
	 * Open color picker modal
	 */
	private async openColorPicker(colors: string[], defaultColor: string): Promise<string | null> {
		return new Promise((resolve) => {
			new ColorPickerModal(this.app, colors, defaultColor, resolve).open();
		});
	}

	/**
	 * Open prompt modal
	 */
	private async openPromptModal(promptText: string, defaultValue: string, placeholder: string): Promise<string | null> {
		return new Promise((resolve) => {
			new PromptModal(this.app, promptText, defaultValue, placeholder, resolve).open();
		});
	}

	/**
	 * Get copied highlight data
	 */
	getCopiedHighlight(): HighlightData | null {
		return this.copiedHighlight;
	}
}
