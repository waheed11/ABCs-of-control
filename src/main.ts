import { App, Editor, MarkdownView, Plugin, MarkdownFileInfo } from 'obsidian';
import { MyPluginSettings } from './types';
import { DEFAULT_SETTINGS } from './constants';
import { ABCsModal } from './modals/ABCsModal';
import { ABCsSettingTab } from './settings';
import { HighlightHandler } from './handlers/highlightHandler';
import { QuoteHandler } from './handlers/quoteHandler';

export default class ABCsOfControlPlugin extends Plugin {
	settings: MyPluginSettings;
	private highlightHandler: HighlightHandler;
	private quoteHandler: QuoteHandler;

	async onload() {
		await this.loadSettings();
		
		// Initialize handlers
		this.highlightHandler = new HighlightHandler(this.app, this.settings);
		this.quoteHandler = new QuoteHandler(this.app);
		
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
							.onClick(() => this.highlightHandler.handleHighlight(editor, view));
					});

					menu.addItem((item) => {
						item.setTitle('ABCs: Copy Highlight')
							.setIcon('copy')
							.onClick(() => this.highlightHandler.handleCopyHighlight(editor, view));
					});

					if (this.highlightHandler.getCopiedHighlight()) {
						menu.addItem((item) => {
							item.setTitle('ABCs: Paste Highlight')
								.setIcon('paste')
								.onClick(() => this.highlightHandler.handlePasteHighlight(editor, view));
						});
					}

					menu.addItem((item) => {
						item.setTitle('ABCs: Quote')
							.setIcon('quote')
							.onClick(() => this.quoteHandler.handleQuote(editor, view));
					});
				}
			})
		);

		// Add settings tab
		this.addSettingTab(new ABCsSettingTab(this.app, this));
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
}
