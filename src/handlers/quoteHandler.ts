import { App, Editor, MarkdownView, MarkdownFileInfo , Notice } from 'obsidian';
import { SECTION_HEADERS } from '../constants';
import { getFileFromView, detectArabicContent } from '../utils';

export class QuoteHandler {
	private app: App;

	constructor(app: App) {
		this.app = app;
	}

	/**
	 * Handle quote action
	 */
	async handleQuote(editor: Editor, view: MarkdownView | MarkdownFileInfo): Promise<void> {
		const selectedText = editor.getSelection();
		if (!selectedText) return;

		const file = getFileFromView(view);
		if (!file) {
			new Notice('Cannot add quote: no file is open');
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
			const isArabic = detectArabicContent(fileContents);
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
}
